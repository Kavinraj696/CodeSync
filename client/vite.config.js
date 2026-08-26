import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor',
    },
  },
  optimizeDeps: {
    include: [
      'yjs',
      'y-monaco',
      'y-protocols/awareness',
      'monaco-editor',
      '@monaco-editor/react',
      'socket.io-client',
      'axios',
      'lucide-react',
    ],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/terminal': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
