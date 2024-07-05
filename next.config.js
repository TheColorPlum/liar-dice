/** @type {import('next').NextConfig} */

const nextConfig = {reactStrictMode: true,
  swcMinify: true,
};

const securityHeaders = [
    {
      key: 'X-XSS-Protection',
      value: '1; mode=block'
    },
    {
      key: 'X-Frame-Options',
      value: 'SAMEORIGIN'
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff'
    }
  ];
  
  module.exports = {
    async headers() {
      return [
        {
          source: '/:path*',
          headers: securityHeaders,
        },
      ]
    },
    swcMinify: true,
  };

module.exports = nextConfig;