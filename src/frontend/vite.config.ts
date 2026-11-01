import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: FE chạy ở 5173, gọi /api được proxy sang backend 3000 → cùng origin, cookie httpOnly hoạt động.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // tách thư viện ra chunk riêng để trình duyệt cache lâu dài
        manualChunks: {
          react: ['react', 'react-dom', 'react-router', '@tanstack/react-query'],
        },
      },
    },
  },
});
