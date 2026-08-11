import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.API_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 워크스페이스 루트의 shared/ 를 import 할 수 있도록 허용
    fs: { allow: ['..'] },
    proxy: { '/api': API_TARGET },
  },
  build: { outDir: 'dist', sourcemap: true },
});
