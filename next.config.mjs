/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so it can be hosted directly on Cloudflare Pages.
  // Remove `output: 'export'` when integrating into a larger Next.js app.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
