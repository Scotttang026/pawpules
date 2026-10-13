# ==========================================
# 階段 1: Build（編譯前端 React 同後端 Node.js）
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# 網頁版留空；手機 app 先填 Cloud Run 網址
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ==========================================
# 階段 2: Runner（輕量 production 環境）
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 前端靜態檔（公開）同後端程式（唔公開）分開兩個資料夾
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server-dist ./server-dist

# 程式檔由 root 擁有，node 用戶只可以讀唔可以改；server 唔會寫本機檔案（相片全部上 Storage）
USER node

EXPOSE 8080

CMD ["node", "server-dist/server.cjs"]
