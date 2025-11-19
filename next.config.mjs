/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['cheerio', 'undici'],
  },
  serverRuntimeConfig: {
    // File 객체 폴리필
  },
};

export default nextConfig;

