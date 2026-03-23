/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_CONFIG_API_URL: process.env.CONFIG_API_URL || 'http://localhost:8090',
    NEXT_PUBLIC_EMPLOYEE_ID: process.env.EMPLOYEE_ID || 'marketing-manager',
    NEXT_PUBLIC_MEETING_AGENT_URL: process.env.MEETING_AGENT_URL || 'http://localhost:8010',
    NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE || 'main',
  },
}

module.exports = nextConfig
