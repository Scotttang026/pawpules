# 階段 1: Build 階段 (安裝套件並編譯 TypeScript / Vite)
FROM node:20-slim AS builder
WORKDIR /app

# 複製 package 檔案並安裝全套依賴
COPY package*.json ./
RUN npm ci

# 複製其餘原始碼並進行 build
COPY . .
RUN npm run build

# 階段 2: Runner 階段 (正式上線輕量化環境)
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/server.cjs"]