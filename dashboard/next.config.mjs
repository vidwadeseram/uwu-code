/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    ignoreIssue: [
      {
        path: /next\.config\.mjs$/,
        title: "Encountered unexpected file in NFT list",
      },
    ],
  },
  // Allow the app to be served on a custom port via PORT env var
  // Next.js reads PORT automatically when using `next dev` / `next start`
};

export default nextConfig;
