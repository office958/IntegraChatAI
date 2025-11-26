/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy pentru backend FastAPI (port 8000)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/:path*',
      },
      // Proxy pentru endpoint-urile de admin (NU pentru /chat care sunt pagini Next.js)
      {
        source: '/admin/:path*',
        destination: 'http://127.0.0.1:8000/admin/:path*',
      },
      {
        source: '/ask',
        destination: 'http://127.0.0.1:8000/ask',
      },
    ];
  },
  // Permite imagini externe dacă e necesar
  images: {
    domains: [],
  },
};

module.exports = nextConfig;

