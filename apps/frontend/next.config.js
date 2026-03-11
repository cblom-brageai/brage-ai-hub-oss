/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_CONFIG_API_URL: process.env.CONFIG_API_URL || 'http://localhost:8090',
    NEXT_PUBLIC_EMPLOYEE_ID: process.env.EMPLOYEE_ID || 'marketing-manager',
  },
}

module.exports = nextConfig
