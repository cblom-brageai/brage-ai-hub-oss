/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_CONFIG_API_URL: process.env.CONFIG_API_URL || 'http://localhost:8090',
    NEXT_PUBLIC_EMPLOYEE_ID: process.env.EMPLOYEE_ID || 'marketing-manager',
    NEXT_PUBLIC_MEETING_AGENT_URL: process.env.MEETING_AGENT_URL || 'http://localhost:8010',
    NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE || 'main',
  },
  async headers() {
    return [
      {
        // Allow the Chrome extension (chrome-extension:// origin) to POST to API routes.
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
