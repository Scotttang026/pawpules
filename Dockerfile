# 階段 1: Build 階段 (編譯 React 前端與 Node.js 後端)
FROM node:20-slim AS builder
WORKDIR /app

# 1. 複製 package 檔並執行一般安裝 (自動容許無 package-lock.json)
COPY package*.json ./
RUN npm install

# 2. 複製剩餘原始碼並進行編譯打包
COPY . .
RUN npm run build

# 階段 2: Runner 階段 (輕量化 Cloud Run 執行環境)
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/server.cjs"]