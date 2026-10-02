# ==========================================
# 階段 1: Build（編譯前端 React 與後端 Node.js）
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL


RUN npm run build

# ==========================================
# 階段 2: Runner（輕量化生產執行環境）
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

# 前端靜態檔（會被公開）同後端程式（唔會被公開）分開兩個資料夾
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server-dist ./server-dist

RUN mkdir -p /app/public/uploads && chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "server-dist/server.cjs"]
