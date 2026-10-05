import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Pet photos are uploaded through server actions (5 MB max + form fields).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
