import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/api': {
    target: 'http://192.168.15.21:48888',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => {
      // Pass through already-versioned API paths (upstream OpenMeter API v1)
      if (path.startsWith('/api/v1') || path.startsWith('/api/v2') || path.startsWith('/api/v3')) {
        return path;
      }
      // Default gateway routes are mounted under /api/v3
      return path.replace(/^\/api/, '/api/v3');
    },
    configure: (proxy, options) => {
      proxy.on('proxyReq', (proxyReq, req, res) => {
        console.log('[Proxy]', req.method, req.url, '->', proxyReq.path);
      });
      proxy.on('proxyRes', (proxyRes, req, res) => {
        console.log('[Proxy Response]', proxyRes.statusCode, req.url);
      });
    },
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy,
  },
  preview: {
    port: 4173,
    proxy,
  }
})
