import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env vars (including non-VITE_ prefixed ones from the project root).
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://localhost:48888'

  const proxy = {
    '/api': {
      target,
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

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy,
    },
    preview: {
      port: 4173,
      proxy,
    }
  }
})