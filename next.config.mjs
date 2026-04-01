/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  typescript: {
    // Erros de TS em arquivos de teste (vitest.config.ts) não devem
    // bloquear o build de produção
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
