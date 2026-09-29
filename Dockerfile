# ==========================================
# 階段 1: Build 階段 (編譯前端 React 與後端 Node.js)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# ==========================================
# 階段 2: Runner 階段 (極輕量化生產執行環境)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
# ⚠️ 已由過時嘅 --only=production 改為 --omit=dev
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# ⚠️ 新增：預先建立 uploads 目錄並將整個 /app 擁有權交給
# node 使用者，避免下面切換成非 root 使用者後，server.ts
# 執行期呼叫 fs.mkdirSync() 時因權限不足而失敗。
RUN mkdir -p /app/public/uploads && chown -R node:node /app

# ⚠️ 新增：切換至 Node 官方映像內建嘅非 root 使用者，
# 遵循容器最小權限原則。
USER node

EXPOSE 8080

# ⚠️ 新增：健康檢查，對應 server.ts 已存在嘅 /api/health 端點。
# Cloud Run 本身有獨立嘅 startup probe，此設定主要方便本地
# docker run 或其他非 Cloud Run 環境驗證容器狀態。
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "dist/server.cjs"]
