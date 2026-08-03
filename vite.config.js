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
        const web = proxy.web.bind(proxy);
        // Allow per-request target selection: the browser sends the selected
        // "API Proxy Target" (from Settings) as an X-API-Target header. This
        // keeps requests same-origin (no CORS) while letting the target change
        // at runtime without restarting the dev server.
        proxy.web = (req, res, reqOptions) => {
          const dynamicTarget = req.headers['x-api-target'];
          if (dynamicTarget) {
            console.log('[Proxy]', req.method, req.url, '->', dynamicTarget);
            return web(req, res, { ...(reqOptions || {}), target: dynamicTarget });
          }
          console.log('[Proxy]', req.method, req.url, '->', options.target);
          return web(req, res, reqOptions || {});
        };
        proxy.on('proxyReq', (proxyReq, req, res) => {
          console.log('[Proxy Request]', req.method, '->', proxyReq.path);
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