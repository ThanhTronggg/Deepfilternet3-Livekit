const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Add COOP/COEP headers for SharedArrayBuffer support
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });

  // Proxy DeepFilter assets through same-origin and ensure CORP header
  app.use(
    '/dfcdn',
    createProxyMiddleware({
      target: 'https://cdn.jsdelivr.net',
      changeOrigin: true,
      pathRewrite: {
        // /dfcdn/<package@version>/dist/... → /npm/<package@version>/dist/...
        '^/dfcdn': '/npm',
      },
      onProxyRes: (proxyRes) => {
        // Allow embedding cross-origin resources under COEP
        try { proxyRes.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'; } catch {}
        // Optional: cache busting during dev
        try { proxyRes.headers['Cache-Control'] = 'no-store'; } catch {}
      },
    })
  );
};