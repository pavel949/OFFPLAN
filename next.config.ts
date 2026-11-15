import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/admin/methodology", destination: "/owner/methodology", permanent: false },
      { source: "/admin/methodology/:id", destination: "/owner/methodology/:id", permanent: false },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "35mb",
    },
  },
};

export default nextConfig;
