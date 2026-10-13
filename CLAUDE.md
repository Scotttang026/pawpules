# PawPulse — 流浪動物即時通報與 AI 救援媒合平台

市民影相通報受傷／流浪動物 → Gemini 分析傷勢同緊急度（P0/P1/P2）→ 按距離、物種、容量配對 NGO → NGO 接手跟進，報案人喺「我的案件」睇進度。

## 語言規範

- **程式註解用廣東話書面語**（例如「唔」「嘅」「喺」「冇」），同現有風格一致。
- **UI 文字唔可以喺元件入面寫死**，一律放 `src/locales/zh.json` 同 `src/locales/en.json`，用 `t('...')` 讀。兩個檔嘅結構必須一致，否則 `satisfies Translation` 會 lint 失敗。
- 用 `utils/caseLabels.ts`（`statusLabel` 等）嘅元件一定要 call `useTranslation()`，否則轉語言唔會即時更新。
- 錯誤狀態儲翻譯 key 而唔係文字，咁中途轉語言都會跟住轉。
- 介面語言由用戶揀（zh / en，存 localStorage `pawpulse-lang`）；地區由瀏覽器判斷。`getApiLang()` 合併兩者（例如 `en-HK`），用嚟做地址搜尋同 Gemini 回應語言。
- Server 錯誤訊息暫時係中文；Firestore collection 名、type 名、API 路徑用英文。

## 技術棧

- **前端**：React 19 + Vite 6 + Tailwind CSS 4 + i18next / react-i18next + `lucide-react` + Leaflet
- **後端**：Express（`server.ts` 單一檔案），部署喺 **Google Cloud Run**（Docker，port 8080）
- **Firebase**：Firestore（**非 default database**）、Cloud Storage、Auth（電郵密碼 + Google 登入）
- **AI**：`@google/genai`（Gemini Developer API，`vertexai: false`），model 寫喺 `server.ts` 嘅 `GEMINI_MODEL`
- **寄信**：nodemailer + Gmail SMTP（App Password）；未設定就喺 terminal 模擬
- **地圖／地址**：Google Geocoding + Places API (New)；Nominatim 做 reverse geocode 後備；香港 18 區用政府 ALS API

## 常用指令

```bash
npm install
npm run dev     # tsx server.ts：Express + Vite middleware，http://localhost:3000
npm run lint    # tsc --noEmit（唯一嘅檢查，暫時冇測試）
npm run build   # vite build → dist/；esbuild server.ts → server-dist/server.cjs
npm run start   # node server-dist/server.cjs（要 NODE_ENV=production 先會 serve dist/）
npx firebase-tools deploy --only firestore:rules   # 部署 Firestore rules（firebase.json 已指定非 default database）
```

- 本機用 Firebase Admin SDK 前要先 `gcloud auth application-default login`。
- 環境變數放 `.env.local`（優先）或 `.env`。
- **Dockerfile 用 `npm ci --omit=dev`**：server 用到嘅套件（例如 nodemailer）一定要喺 dependencies；改依賴後要 commit `package-lock.json`。

## 用戶身份

| 身份 | 判斷方法 | 可以做 |
|---|---|---|
| user | 已登入，但唔係 admin / ngo | 報案；「我的案件」睇自己報過嘅案件 |
| ngo | Firestore 有 `ngouser/{uid}`（入面有 `ngoId`） | NGO 工作台：接手案件、更新自己機構接手咗嘅案件、睇該案件聯絡資料 |
| admin | Firestore 有 `adminuser/{uid}` | 全部案件同機構；建立／移除 NGO 帳戶 |

- 前端 `AuthContext` 同 server `getAuthInfo` 都係 **fail-closed**：讀取失敗就當普通 user。
- Server 用 `verifyIdToken(token, true)`；移除 NGO 帳戶會 `revokeRefreshTokens`，即刻失效。
- Admin 只可以喺 Firebase Console 手動新增 `adminuser/{uid}` 文件（文件 ID = UID）。
- NGO 帳戶由 admin 喺後台建立，server 寄「設定密碼連結」（`generatePasswordResetLink`），唔會寄明文密碼。每間機構最多 5 個帳戶。
- 報案人帳戶：寄確認信時 server 用報案電郵搵或者建立 Auth 帳戶，案件記入 `usercases/{uid}.caseIds`；新帳戶嘅確認信附設定密碼連結。
- Sidebar 按身份顯示分頁（`ROLE_NAV_ITEM`），冇固定 admin 入口。

## 目錄結構

```
server.ts                  # 全部 API：rate limit、geocode、places、上傳、AI 分析、確認信、NGO 帳戶、接手、更新進度、刪除
src/
  App.tsx                  # 主畫面、tab 切換、報案流程（建立案件 → AI → 確認信）、接手／更新進度
  i18n.ts                  # i18next 設定、getAppLang / getBrowserRegion / getApiLang
  locales/zh.json, en.json # 全部 UI 文字
  firebase.ts              # client SDK 初始化（讀 firebase-applet-config.json）
  types.ts                 # StrayReport / CasePhoto / CaseAcceptance / NGOOrganization / UserProfile 等
  contexts/AuthContext.tsx # 登入、身份判斷（adminuser / ngouser）
  services/
    caseService.ts         # Firestore 讀寫、NGO 排名、acceptCase / updateCaseStatus / subscribeToMyCaseIds
    api.ts                 # apiFetch：自動帶 Firebase ID token + VITE_API_BASE_URL
    places.ts              # 地址自動完成
  components/              # ReportForm、MyCases、NgoWorkspace、AdminDashboard、LoginModal、Sidebar、PhotoGallery 等
  utils/                   # imageCompressor、casePhotos、caseLabels、location、locale
  config/emergency.ts      # 各地區緊急熱線（按地區，唔按語言）
firestore.rules / storage.rules   # 安全規則（核心安全邏輯）
firebase-blueprint.json    # Firestore 資料結構說明（文件，code 唔會讀）
security_spec.md           # 威脅模型（Dirty Dozen payloads）
```

## Firestore 資料結構

| 路徑 | 讀 | 寫 |
|---|---|---|
| `case/{caseId}` | 公開 | 新建：任何人（嚴格驗證）；更新／刪除：admin；NGO 接手同更新進度經 server API |
| `case/{caseId}/private/contact` | admin、接手咗嘅 NGO | 只可以同案件喺同一個 batch 新建 |
| `ngodatail/{ngoId}` | 公開 | admin |
| `adminuser/{uid}` | 本人 | **禁止**（只可以喺 Console 手動新增） |
| `ngouser/{uid}` | 本人、admin | 只限 server |
| `usercases/{uid}` | 本人 | 只限 server |
| `serverLocks/{kind}_{caseId}` | — | 只限 server |

## 報案流程（改動前必讀）

1. `ReportForm` 生成 Case ID：`PW-<base36 時間>-<4 位隨機>`（storage.rules：資料夾 `^PW-[A-Z0-9]{1,20}-[A-Z0-9]{1,8}$`、檔名 `^[0-4][.]jpg$`）。
2. 最多 5 張相，經 `compressImage` 轉成 JPEG（≤1280px），用 `uploadCasePhotos` 上傳去 `animal-reports/{caseId}/{0-4}.jpg`；失敗就 fallback 去 `POST /api/upload-photo`（帶 `index`）。第 1 張係封面，同時寫入 `photoUrl` / `storagePath`；全部相寫入 `photos[]`。
3. `createCaseInFirestore` 用 **writeBatch** 同時寫 `case/{id}` 同 `private/contact`。Rules 強制：`status == 'pending'`、`urgency == 'P1'`、`createdAt == request.time`、`aiAnalysis` / `geminiResponse` / `dispatchedToNGO` 係 null、唔可以有 `acceptedBy`。
4. `POST /api/cases/:caseId/analyze`：server 由 Storage 讀全部相（唔信前端傳嘅圖），放入同一個 Gemini request → 逐個欄位清洗 → 寫返 `aiAnalysis` 同 `urgency`。
5. `POST /api/cases/send-confirmation-email`：server 由 `private/contact` 讀電郵（唔信前端）→ `linkCaseToReporter` 搵／建帳戶並寫 `usercases` → 寄確認信。開帳戶失敗都照寄信。
6. NGO `POST /api/cases/:caseId/accept`：transaction 防止兩間機構同時接手 → 寫 `acceptedBy`、狀態轉 `in_progress` → 寄信通知報案人（附機構公開資料）。
7. `POST /api/cases/:caseId/status`：admin 可以改任何案件；NGO 只可以改自己機構接手咗嘅，而且唔可以改返 `pending`。

**15 分鐘時限**：AI 分析、確認信、報案人派送 NGO 都只可以喺案件建立後 15 分鐘內做，而且每宗案件每種動作只做一次（`claimOnce` 用 `serverLocks`）。

## 重要規則同注意事項

- **改 Case 欄位要同步**：`src/types.ts`、`firestore.rules`（`isValidCase` 嘅 `hasOnly` 白名單）、`caseService.ts`（`casePayload` 同 `docToReport`）、`firebase-blueprint.json`。漏咗 rules 會令成個 batch 寫入失敗。
- `CaseStatus` 只可以係 `pending | in_progress | rescued | closed`；`AnimalType` 係 `cat | dog | bird | other`。
- 報案人聯絡資料**絕對唔可以**放入公開嘅 `case` 文件；`acceptedBy` 都唔可以放 NGO 職員電郵。
- NGO 登入電郵放 `ngouser`，公開電郵放 `ngodatail.publicEmail`，兩者分開。
- Gemini 輸出唔可以直接信：保留 `cleanStr` / `cleanList` 清洗同 P0/P1/P2 驗證；用戶描述喺 prompt 入面當 untrusted input。
- AI 失敗或者超出 `AI_DAILY_LIMIT` 唔可以阻止報案，案件維持 P1。
- Rate limiter 同 AI 每日額度都係**記憶體內、每個 Cloud Run instance 各自計**；`windowSeconds` 唔好超過 600。
- `config/emergency.ts`：只加入親自核實過嘅熱線號碼，打錯緊急熱線比冇更危險。
- `vite.config.ts` 嘅 `allowedHosts: true` / `hmr: false` 係 AI Studio 預覽需要，只影響 dev server。
- 未定義嘅 `/api/*` 一律回 JSON 404。
- 設定密碼連結用 `PUBLIC_BASE_URL` 做 continue URL，該網域要加入 Firebase Authentication → Authorized domains。

## 未完成／模擬中

- **NGO 派送**（`/api/ngo/notify`）目前只係 `console.log` 模擬（`simulated: true`），有 `TODO` 標記。
- 未設定 `GMAIL_*` 時，全部電郵只會印喺 terminal（**包括設定密碼連結，production 一定要設定**）。
- `GET /api/ngos` 回傳空陣列；前端直接由 Firestore 讀 NGO。
- 冇自動化測試。Rules 用 `npx firebase-tools deploy --only firestore:rules`（或 `--only storage`）部署，部署前可以加 `--dry-run` 檢查語法。
- dev 同 PRD 共用同一個 Firestore 同 Storage，Publish rules 會即刻影響 PRD。

## 環境變數（Cloud Run）

| 變數 | 用途 |
|---|---|
| `GEMINI_API_KEY` | Gemini（Secret Manager：`gemini-api-key`） |
| `GOOGLE_MAPS_API_KEY` | Geocoding 同 Places（Secret Manager：`google-maps-api-key`） |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail SMTP 寄信；App Password 要放 Secret Manager |
| `FIREBASE_PROJECT_ID` / `FIRESTORE_DATABASE_ID` / `FIREBASE_STORAGE_BUCKET` | Admin SDK。**`FIRESTORE_DATABASE_ID` 一定要設**，值同 `firebase-applet-config.json` 嘅 `firestoreDatabaseId` 一樣 |
| `PUBLIC_BASE_URL` | 電郵入面嘅連結（防 Host header 偽造），每個 service 填自己嘅網址 |
| `AI_DAILY_LIMIT` | 每個 instance 每日 AI 分析上限（預設 500） |
| `EXTRA_CORS_ORIGINS` | 額外 CORS 來源（逗號分隔） |
| `VITE_API_BASE_URL` | **Build 時**注入（Docker `ARG`）；網頁版留空，手機 app 填 Cloud Run 網址 |

一般變數：`gcloud run services update <服務> --region asia-northeast1 --update-env-vars KEY=VALUE`
Secret：`gcloud run services update <服務> --region asia-northeast1 --update-secrets KEY=secret-name:latest`（服務帳戶要有 `roles/secretmanager.secretAccessor`）
