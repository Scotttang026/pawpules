import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // ⚠️ 已核實：呢個設定只影響 `npm run dev`（Vite dev server middleware），
      // 正式部署（npm run build → npm run start）執行嘅係
      // dist/server.cjs，唔會使用呢個 dev server 設定，故此設定唔構成
      // 正式環境嘅安全風險。allowedHosts: true 係配合 AI Studio 雲端
      // 預覽環境嘅 iframe 需要，請勿隨意收窄，除非你將 dev server
      // 部署到 AI Studio 以外並對外公開，屆時應改用明確嘅域名陣列。
      allowedHosts: true as const,
      // HMR is disabled in this cloud preview/iframe environment
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
