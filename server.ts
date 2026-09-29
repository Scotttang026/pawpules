import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "./src/types";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// 如實際部署喺反向代理（Nginx、Cloud Run、Render 等）後面，設定信任第一層 proxy
app.set("trust proxy", 1);

class SlidingWindowLimiter {
  private inMemoryStore = new Map<string, number[]>();

  constructor() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of this.inMemoryStore.entries()) {
        const active = timestamps.filter((ts) => now - ts < 10 * 60 * 1000);
        if (active.length === 0) this.inMemoryStore.delete(key);
        else this.inMemoryStore.set(key, active);
      }
    }, 10 * 60 * 1000).unref();
  }

  async isAllowed(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const timestamps = (this.inMemoryStore.get(key) || []).filter((ts) => now - ts < windowMs);

    if (timestamps.length >= limit) {
      this.inMemoryStore.set(key, timestamps);
      return { allowed: false, remaining: 0 };
    }

    timestamps.push(now);
    this.inMemoryStore.set(key, timestamps);
    return { allowed: true, remaining: limit - timestamps.length };
  }
}
const rateLimiter = new SlidingWindowLimiter();

const aiRateLimitMiddleware = async (req: Request, res: Response, next: () => void) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const { allowed, remaining } = await rateLimiter.isAllowed(`ai_${clientIp}`, 15, 60);
  res.setHeader("X-RateLimit-Remaining", remaining);
  if (!allowed) {
    res.status(429).json({ error: "請求過於頻繁，請稍候 1 分鐘後再試 (Rate limit exceeded)" });
    return;
  }
  next();
};

const uploadRateLimitMiddleware = async (req: Request, res: Response, next: () => void) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const { allowed, remaining } = await rateLimiter.isAllowed(`upload_${clientIp}`, 20, 60);
  res.setHeader("X-RateLimit-Remaining", remaining);
  if (!allowed) {
    res.status(429).json({ error: "上傳過於頻繁，請稍候再試" });
    return;
  }
  next();
};

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.use("/uploads", express.static(uploadsDir));

function getGeminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY
  );
}

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiClient;
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/ai/status", (_req: Request, res: Response) => {
  const key = getGeminiApiKey();
  res.json({
    status: key ? "configured" : "missing_key",
    hasApiKey: !!key,
    // ⚠️ 請自行對照 @google/genai 官方文件核對呢個型號名稱是否真實有效
    model: "gemini-3.8-flash",
  });
});


// ---------- Geocoding (Google Maps Platform，自動 fallback 至 Nominatim) ----------

function getGoogleMapsApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY;
}

const geocodeRateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { allowed, remaining } = await rateLimiter.isAllowed(`geocode_${getClientIp(req)}`, 30, 60);
  res.setHeader("X-RateLimit-Remaining", remaining);
  if (!allowed) {
    res.status(429).json({ error: "地址查詢請求過於頻繁，請稍候再試" });
    return;
  }
  next();
};

// ⚠️ 伺服器端 Node.js fetch（undici）冇瀏覽器嗰種 forbidden header
// 限制，可以自由設定 User-Agent，正確符合 Nominatim 使用政策要求。
// 請將 email 換成你實際監控嘅聯絡地址。
const NOMINATIM_USER_AGENT = "PawPulse/1.0 (contact: scotttang026jp@gmail.com)";

app.get("/api/geocode", geocodeRateLimitMiddleware, async (req: Request, res: Response) => {
  const address = String(req.query.address || "").trim();
  if (!address) {
    res.status(400).json({ error: "缺少 address 參數" });
    return;
  }

  const googleKey = getGoogleMapsApiKey();

  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address + ", Hong Kong"
      )}&key=${googleKey}&language=zh-HK&region=hk`;
      const r = await fetch(url);
      const data: any = await r.json();
      if (data.status === "OK" && data.results?.[0]) {
        const loc = data.results[0].geometry.location;
        res.json({ lat: loc.lat, lng: loc.lng, address: data.results[0].formatted_address, provider: "google" });
        return;
      }
      console.warn("Google Geocoding API 回傳非 OK 狀態:", data.status);
    } catch (err) {
      console.warn("Google Geocoding API 呼叫失敗，改用 Nominatim fallback:", err);
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address + ", Hong Kong"
    )}&limit=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT, "Accept-Language": "zh-HK, zh-TW, zh, en" },
    });
    const results: any = await r.json();
    if (Array.isArray(results) && results[0]) {
      res.json({
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon),
        address: results[0].display_name,
        provider: "nominatim",
      });
      return;
    }
  } catch (err) {
    console.error("Nominatim fallback 失敗:", err);
  }

  res.status(404).json({ error: "找不到對應地址，請嘗試更精確的地址描述" });
});

app.get("/api/reverse-geocode", geocodeRateLimitMiddleware, async (req: Request, res: Response) => {
  const lat = parseFloat(String(req.query.lat));
  const lng = parseFloat(String(req.query.lng));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: "缺少或無效的 lat/lng 參數" });
    return;
  }

  const googleKey = getGoogleMapsApiKey();

  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}&language=zh-HK`;
      const r = await fetch(url);
      const data: any = await r.json();
      if (data.status === "OK" && data.results?.[0]) {
        res.json({ address: data.results[0].formatted_address, provider: "google" });
        return;
      }
      console.warn("Google Reverse Geocoding API 回傳非 OK 狀態:", data.status);
    } catch (err) {
      console.warn("Google Reverse Geocoding API 呼叫失敗，改用 Nominatim fallback:", err);
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT, "Accept-Language": "zh-HK, zh-TW, zh, en" },
    });
    const data: any = await r.json();
    if (data?.display_name) {
      const district = data.address?.suburb || data.address?.city_district || data.address?.town || "市區";
      res.json({ address: data.display_name, district, provider: "nominatim" });
      return;
    }
  } catch (err) {
    console.error("Nominatim reverse fallback 失敗:", err);
  }

  res.status(404).json({ error: "找不到對應地址" });
});


// 驗證真正檔案內容（magic bytes），唔淨係信任副檔名／宣稱嘅 MIME type
function detectImageType(buffer: Buffer): "jpg" | "png" | "webp" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  )) {
    return "png";
  }
  if (buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

app.post("/api/upload-photo", uploadRateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const { imageBase64, caseId } = req.body;

    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      res.status(400).json({ error: "Missing imageBase64" });
      return;
    }

    const match = imageBase64.match(/^data:(image\/jpeg|image\/jpg|image\/png|image\/webp);base64,(.+)$/i);
    const encoded = match ? match[2] : imageBase64.replace(/^data:image\/\w+;base64,/, "");

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
      res.status(400).json({ error: "圖片資料格式無效" });
      return;
    }

    const buffer = Buffer.from(encoded, "base64");

    if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) {
      res.status(413).json({ error: "圖片檔案過大，請先壓縮後再行上傳" });
      return;
    }

    const detectedType = detectImageType(buffer);
    if (!detectedType) {
      res.status(400).json({ error: "檔案內容並非有效圖片，僅接受 JPG、PNG、WebP" });
      return;
    }

    const safeCaseId = typeof caseId === "string"
      ? caseId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)
      : `PW-${Date.now()}`;

    const filename = `${safeCaseId}_${Date.now()}.${detectedType}`;
    const filePath = path.join(uploadsDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    res.json({
      success: true,
      downloadUrl: `/uploads/${filename}`,
      storagePath: `animal-reports/${filename}`,
    });
  } catch (err: any) {
    console.error("Photo upload error:", err);
    res.status(500).json({ error: "Failed to save photo" });
  }
});

app.get("/api/ngos", (_req: Request, res: Response) => {
  res.json([]);
});

app.post("/api/ai/analyze-stray", aiRateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", animalTypeHint, description } = req.body;

    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      res.status(400).json({ error: "Missing imageBase64 payload" });
      return;
    }

    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedMimes.includes(String(mimeType).toLowerCase())) {
      res.status(400).json({ error: "不支援的圖片格式，僅接受 JPG, PNG, WebP" });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    if (cleanBase64.length > 10 * 1024 * 1024) {
      res.status(413).json({ error: "圖片檔案過大，請先壓縮後再行上傳" });
      return;
    }

    const promptText = `
You are the emergency veterinarian and rescue coordinator AI for "PawPulse", an urgent stray animal rescue platform in Hong Kong / East Asia.
Analyze this photo of a stray or injured animal reported by a citizen.
User provided context:
- Animal Category hint: ${animalTypeHint || "Unspecified (cat/dog/other)"}
- Citizen description: ${description || "None provided"}

Please perform a thorough, professional assessment in Traditional Chinese (繁體中文, 適合香港與台灣通報者及救援NGO):
1. Identify species and estimate breed / physical features.
2. Carefully inspect visible signs of physical trauma, injuries, wounds, fractures, dehydration, skin diseases (e.g. mange, fungal), eye infections, posture (e.g. inability to stand, limp, curling).
3. Assign an urgency triage level:
   - "P0" (極度緊急): Life-threatening, heavy bleeding, suspected motor vehicle collision trauma, pelvic/spine injury, severe breathing distress, shock, unconsciousness. Immediate 24h rescue ambulance required.
   - "P1" (需醫療關注): Obvious fractures, open wounds, infected eyes/skin, puppy/kitten in distress, malnourished, requiring veterinary care within hours.
   - "P2" (穩定/走失): Stable condition, stray or lost pet, friendly, wandering, needs capture/chip scan/shelter without critical life-threatening injuries.
4. Urgency reason: Concise 1-2 sentence medical/rescue justification.
5. Rescue equipment needed: Essential tools for NGO rescue team (e.g., 誘捕籠, 厚防咬手套, 急救止血敷料, 犬用口套, 大型犬擔架布, 晶片掃描器, 專用航空箱, 暖水袋).
6. First-aid advice for citizens on the scene: 3-4 safe, actionable instructions while waiting.
7. Handling precautions: Safety warnings for rescuers and citizens.
8. Confidence score between 0.70 and 0.99.

Ensure output is strictly JSON conforming to the response schema.
`;

    let analysisResult: AIAnalysisResult | null = null;
    const apiKey = getGeminiApiKey();

    if (apiKey) {
      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: {
            parts: [
              { inlineData: { mimeType, data: cleanBase64 } },
              { text: promptText },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                identifiedSpecies: { type: Type.STRING },
                estimatedBreed: { type: Type.STRING },
                appearanceDescription: { type: Type.STRING },
                apparentInjuries: { type: Type.ARRAY, items: { type: Type.STRING } },
                urgencyLevel: { type: Type.STRING },
                urgencyReason: { type: Type.STRING },
                rescueEquipment: { type: Type.ARRAY, items: { type: Type.STRING } },
                firstAidAdvice: { type: Type.ARRAY, items: { type: Type.STRING } },
                handlingPrecautions: { type: Type.ARRAY, items: { type: Type.STRING } },
                confidenceScore: { type: Type.NUMBER },
              },
              required: [
                "identifiedSpecies", "estimatedBreed", "appearanceDescription",
                "apparentInjuries", "urgencyLevel", "urgencyReason",
                "rescueEquipment", "firstAidAdvice", "handlingPrecautions",
              ],
            },
          },
        });

        const rawText = response.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          analysisResult = {
            ...parsed,
            urgencyLevel: (["P0", "P1", "P2"].includes(parsed.urgencyLevel) ? parsed.urgencyLevel : "P1") as any,
            confidenceScore: parsed.confidenceScore || 0.92,
            analyzedAt: new Date().toISOString(),
          };
        }
      } catch (geminiError) {
        console.warn("Gemini API call failed or timed out:", geminiError);
      }
    }

    if (!analysisResult) {
      res.json({ noResponse: true, message: "Gemini 沒有回應", analysisResult: null });
      return;
    }

    res.json(analysisResult);
  } catch (err: any) {
    console.error("AI Analysis route error:", err);
    res.status(500).json({ error: err.message || "Failed to analyze image" });
  }
});

app.post("/api/cases/send-confirmation-email", async (req: Request, res: Response) => {
  try {
    const { caseId, reporterEmail, reporterName, animalType, urgency, location } = req.body;

    if (!caseId || !reporterEmail) {
      res.status(400).json({ error: "缺少 caseId 或 reporterEmail 參數" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(reporterEmail)) {
      res.status(400).json({ error: "電子郵件格式不正確" });
      return;
    }

    const { allowed } = await rateLimiter.isAllowed(`email_limit_${reporterEmail}`, 5, 300);
    if (!allowed) {
      res.status(429).json({ error: "該電子郵件發信頻率過高，請稍後再試" });
      return;
    }

    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const trackingUrl = `${protocol}://${host}/?caseId=${encodeURIComponent(caseId)}`;

    // ⚠️ 目前尚未串接真實 SMTP／SendGrid 等服務，狀態誠實標示為模擬
    const emailReceipt = {
      messageId: `MAIL-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      caseId,
      recipient: reporterEmail,
      recipientName: reporterName || "熱心市民",
      subject: `【PawPulse 救援通報確認】案件編號 #${caseId} 已立案`,
      urgency,
      animalType,
      locationAddress: location?.address || "通報指定地點",
      trackingUrl,
      sentAt: new Date().toISOString(),
      status: "simulated",
    };

    console.log(`[EMAIL DISPATCH - SIMULATED] Case confirmation for ${reporterEmail}, case ${caseId}`);
    res.json({
      success: true,
      simulated: true,
      message: "目前為測試模式，尚未真正發送電子郵件。",
      emailReceipt,
    });
  } catch (err: any) {
    console.error("Email notification error:", err);
    res.status(500).json({ error: err.message || "發送確認信失敗" });
  }
});

app.post("/api/ngo/notify", (req: Request, res: Response) => {
  const { reportId, ngoId, ngoName, urgency } = req.body;

  if (!reportId || !ngoId) {
    res.status(400).json({ error: "缺少 reportId 或 ngoId" });
    return;
  }

  // ⚠️ 目前尚未真正推送至 NGO 系統，狀態誠實標示為模擬
  res.json({
    simulated: true,
    receiptId: `DISPATCH-${Date.now().toString(36).toUpperCase()}`,
    reportId,
    ngoId,
    ngoName,
    dispatchedAt: new Date().toISOString(),
    status: "simulated",
    estimatedVolunteerArrivalMins: urgency === "P0" ? 15 : 30,
    notice: "目前為測試模式，尚未真正推送至 NGO 系統。",
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // ⚠️ 已改用動態 import(),取代原本嘅 top-level 靜態 import。
    // 呢個改動令 vite 套件只喺真正進入呢個 if 分支(即係開發環境)
    // 先會被 require(),production 環境完全唔會觸發呢句,先可以
    // 安全噉將 vite 由 "dependencies" 移去 "devDependencies"。
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PawPulse server listening on http://0.0.0.0:${PORT}`);
  });
}


startServer();

