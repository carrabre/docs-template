/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Link",
            value:
              '</llms.txt>; rel="llms-txt", </llms-full.txt>; rel="llms-full-txt"',
          },
          {
            key: "X-Llms-Txt",
            value: "/llms.txt",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/:path*.md",
        destination: "/api/markdown/:path*",
      },
    ];
  },
};

export default nextConfig;
