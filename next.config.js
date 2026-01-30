/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Headers pentru a bloca script-uri externe nedorite (CORS errors)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn-icons-png.flaticon.com",
              "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000 https://fonts.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "frame-src 'self' http://127.0.0.1:3000 http://localhost:3000",
            ].join('; '),
          },
        ],
      },
    ];
  },
  // Proxy pentru backend FastAPI (port 8000)
  async rewrites() {
    return [
      // Proxy explicit pentru endpoint-urile de autentificare (înainte de ruta generică)
      {
        source: '/api/auth/:path*',
        destination: 'http://127.0.0.1:8000/auth/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/:path*',
      },
      // Proxy pentru endpoint-urile de admin
      {
        source: '/admin/:path*',
        destination: 'http://127.0.0.1:8000/admin/:path*',
      },
      {
        source: '/ask',
        destination: 'http://127.0.0.1:8000/ask',
      },
      // Proxy pentru endpoint-urile de API ale chat-ului (sessions, history, etc.)
      // Acestea trebuie să fie înainte de ruta generică /chat/:path* pentru pagini Next.js
      {
        source: '/chat/:chatId/sessions',
        destination: 'http://127.0.0.1:8000/chat/:chatId/sessions',
      },
      {
        source: '/chat/:chatId/session/:sessionId',
        destination: 'http://127.0.0.1:8000/chat/:chatId/session/:sessionId',
      },
      {
        source: '/chat/:chatId/history',
        destination: 'http://127.0.0.1:8000/chat/:chatId/history',
      },
      {
        source: '/chat/:chatId/config',
        destination: 'http://127.0.0.1:8000/chat/:chatId/config',
      },
      {
        source: '/chat/:chatId/ask',
        destination: 'http://127.0.0.1:8000/chat/:chatId/ask',
      },
      {
        source: '/chat/:chatId/clear',
        destination: 'http://127.0.0.1:8000/chat/:chatId/clear',
      },
      {
        source: '/chat/:chatId/session/:sessionId/create',
        destination: 'http://127.0.0.1:8000/chat/:chatId/session/:sessionId/create',
      },
    ];
  },
  // Permite imagini externe dacă e necesar
  images: {
    domains: [],
  },
};

module.exports = nextConfig;

