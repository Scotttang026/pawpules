# PawPulse — 流浪動物即時通報與 AI 救援媒合平台

市民影相通報受傷／流浪動物 → Gemini 分析傷勢同緊急度（P0/P1/P2）→ 按距離、物種、容量配對 NGO → 管理員跟進派送。

## 語言規範

- **主要語言係廣東話（繁體中文）**。UI 文字、錯誤訊息、程式註解一律用廣東話書面語（例如「唔」「嘅」「喺」「冇」），同現有程式碼風格一致。
- 預設語系 `zh-HK`。地址、區名同 Gemini 分析結果會跟市民瀏覽器語言（`src/utils/locale.ts` / `server.ts` 嘅 `resolveLang`）。
- Firestore collection 名、type 名、API 路徑用英文。

## 技術棧

- **前端**：React 19 + Vite 6 + Tailwind CSS 4 + `motion` + `lucide-react` + Leaflet（地圖）
- **後端**：Express 4（`server.ts` 單一檔案），部署喺 **Google Cloud Run**（Docker，port 8080）
- **Firebase**：Firestore（非 default database）、Cloud Storage、Auth（Google 登入）
- **AI**：`@google/genai`（Gemini Developer API，`vertexai: false`），model 寫喺 `server.ts` 嘅 `GEMINI_MODEL`
- **地圖／地址**：Google Geocoding + Places API (New)；Nominatim 做 reverse geocode 後備；香港 18 區用政府 ALS API (`als.gov.hk`)
- 原本由 Google AI Studio 生成（`metadata.json`、`firebase-applet-config.json`）

## 常用指令

```bash
npm install
npm run dev     # tsx server.ts：Express + Vite middleware，http://localhost:3000
npm run lint    # tsc --noEmit（唯一嘅檢查，暫時冇測試）
npm run build   # vite build → dist/；esbuild server.ts → server-dist/server.cjs
npm run start   # node server-dist/server.cjs（需要 NODE_ENV=production 先會 serve dist/）
```

- 本機用 Firebase Admin SDK 前要先 `gcloud auth application-default login`；Cloud Run 會自動用服務帳戶。
- 環境變數放 `.env.local`（優先）或 `.env`，參考 `.env.example`。
- Repo 同時有 `bun.lock` 同 `package-lock.json`，但 **Dockerfile 用 `npm ci`**，改依賴之後一定要更新 `package-lock.json`。

## 目錄結構

```
server.ts                  # 全部 API：rate limit、geocode、places、上傳、AI 分析、確認信、NGO 派送、admin 刪除
src/
  App.tsx                  # 主畫面、tab 切換、報案流程（建立案件 → 呼叫 AI → 寄確認信）
  firebase.ts              # client SDK 初始化（讀 firebase-applet-config.json）
  types.ts                 # StrayReport / NGOOrganization / AIAnalysisResult 等型別
  contexts/AuthContext.tsx # Google 登入；isAdmin = adminuser/{uid} 文件是否存在
  services/
    caseService.ts         # Firestore 讀寫、NGO 排名（rankFirestoreNGOs）
    api.ts                 # apiFetch：自動帶 Firebase ID token + VITE_API_BASE_URL
    places.ts              # 地址自動完成
  components/              # ReportForm、AdminDashboard、CaseFeed、InteractiveMap、NGODirectory 等
  utils/                   # imageCompressor（壓縮 + HEIC 轉 JPEG + 上傳）、location、locale、monitoring
  config/emergency.ts      # 各地區緊急熱線
firestore.rules / storage.rules   # 安全規則（核心安全邏輯喺度）
firebase-blueprint.json    # Firestore 資料結構說明
security_spec.md           # 威脅模型（Dirty Dozen payloads）
```

## Firestore 資料結構

| 路徑 | 讀 | 寫 |
|---|---|---|
| `case/{caseId}` | 公開 | 新建：任何人（嚴格驗證）；更新／刪除：admin |
| `case/{caseId}/private/contact` | admin | 只可以同案件喺同一個 batch 新建 |
| `ngodatail/{ngoId}` | 公開 | admin |
| `adminuser/{uid}` | 本人 | **禁止**（只可以喺 Firebase Console 手動新增） |
| `serverLocks/{kind}_{caseId}` | — | 只限 server（Admin SDK） |

## 報案流程（改動前必讀）

1. `ReportForm` 生成 Case ID：`PW-<base36 時間>-<4 位隨機>`（要符合 `storage.rules` 嘅 `^PW-[A-Z0-9]{1,20}-[A-Z0-9]{1,8}\.jpg$`）。
2. 相片經 `compressImage` 轉成 JPEG（≤1280px），上傳去 `animal-reports/{caseId}.jpg`；失敗就 fallback 去 `POST /api/upload-photo`。
3. `createCaseInFirestore` 用 **writeBatch** 同時寫 `case/{id}` 同 `private/contact`。Rules 強制：`status == 'pending'`、`urgency == 'P1'`、`createdAt == request.time`、`aiAnalysis`/`geminiResponse`/`dispatchedToNGO` 要係 null。
4. `POST /api/cases/:caseId/analyze`：server 由 Storage 讀相片（唔信前端傳嘅圖）→ Gemini → 逐個欄位清洗 → 用 Admin SDK 寫返 `aiAnalysis` 同 `urgency`。
5. 有電郵就 `POST /api/cases/send-confirmation-email`。

**15 分鐘時限**：AI 分析、確認信、報案人派送 NGO 都只可以喺案件建立後 15 分鐘內做，而且每宗案件每種動作只做一次（`claimOnce` 用 `serverLocks`）。

## 重要規則同注意事項

- **改 Case 欄位要同步四個地方**：`src/types.ts`、`firestore.rules`（`isValidCase` 嘅 `hasOnly` 白名單）、`firebase-blueprint.json`、`caseService.ts` 嘅 `casePayload`。漏咗 rules 會令整個 batch 寫入失敗。
- `CaseStatus` 只可以係 `pending | in_progress | rescued | closed`；`AnimalType` 係 `cat | dog | bird | other`。
- 報案人聯絡資料（姓名／電話／電郵）**絕對唔可以**放入公開嘅 `case` 文件，只可以放 `private/contact`。`docToReport` 永遠回傳空嘅聯絡欄位。
- Admin 判斷係 fail-closed：讀取失敗就當非管理員。Server 端用 `getAdminUid`（驗 ID token + 查 `adminuser`）。
- `simulateAdminMode` 只限 `import.meta.env.DEV`，唔好移除呢個檢查。
- Gemini 輸出唔可以直接信：保留 `cleanStr` / `cleanList` 清洗同 P0/P1/P2 驗證。用戶描述喺 prompt 入面當 untrusted input 處理。
- AI 失敗或者超出每日額度（`AI_DAILY_LIMIT`）唔可以阻止報案，案件維持 P1。
- Rate limiter 同 AI 每日額度都係**記憶體內、每個 Cloud Run instance 各自計**。`windowSeconds` 唔好超過 600。
- `config/emergency.ts`：只加入親自核實過嘅熱線號碼，打錯緊急熱線比冇更危險。
- `vite.config.ts` 嘅 `allowedHosts: true` / `hmr: false` 係 AI Studio 預覽需要，只影響 dev server，唔好隨便改。
- 未定義嘅 `/api/*` 一律回 JSON 404，唔會跌落 SPA fallback。

## 未完成／模擬中

- **確認信**同 **NGO 派送**目前只係 `console.log` 模擬（`simulated: true`），`server.ts` 有 `TODO` 標記。
- `GET /api/ngos` 回傳空陣列；前端直接由 Firestore `ngodatail` 讀 NGO。
- 冇自動化測試；Repo 冇 `firebase.json`，`firestore.rules` / `storage.rules` 要另外部署去 Firebase。

## 環境變數（Cloud Run）

| 變數 | 用途 |
|---|---|
| `GEMINI_API_KEY` | Gemini（亦接受 `API_KEY` / `GOOGLE_API_KEY` / `GOOGLE_GENAI_API_KEY`） |
| `GOOGLE_MAPS_API_KEY` | Geocoding；未設 `GOOGLE_PLACES_API_KEY` 時亦用於 Places |
| `FIREBASE_PROJECT_ID` / `FIRESTORE_DATABASE_ID` / `FIREBASE_STORAGE_BUCKET` | Admin SDK。**`FIRESTORE_DATABASE_ID` 一定要設**（用嘅係非 default database），值同 `firebase-applet-config.json` 嘅 `firestoreDatabaseId` 一樣 |
| `PUBLIC_BASE_URL` | 確認信追蹤連結（防 Host header 偽造） |
| `AI_DAILY_LIMIT` | 每個 instance 每日 AI 分析上限（預設 500） |
| `EXTRA_CORS_ORIGINS` | 額外 CORS 來源（逗號分隔）；預設已容許 Capacitor iOS/Android |
| `VITE_API_BASE_URL` | **Build 時**注入（Docker `ARG`）；網頁版留空，手機 app 填 Cloud Run 網址 |

Cloud Run 例子：`gcloud run services update <服務> --region=asia-northeast1 --update-env-vars KEY=VALUE`
