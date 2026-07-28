/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Existe um package-lock.json na home do usuário; sem isto o Next infere a
  // raiz errada. Fixa a raiz de tracing neste projeto (importa no build Docker).
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
