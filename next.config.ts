import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.3"],

  outputFileTracingIncludes: {
    "/api/app-download": [
      "./public/downloads/new-city-style.apk",
    ],
  },

  async headers() {
    return [
      {
        source: "/api/app-download",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
