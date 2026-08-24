/** @type {import('next').NextConfig} */
const nextConfig = {
  // STATIC EXPORT. The dashboard builds to plain HTML/CSS/JS in `out/` and is
  // served from a private S3 bucket behind CloudFront — there is no Node server
  // anywhere in the deployment. See `binly-backend/cdk/stacks/frontend_stack.py`
  // and the "Hosting" section of this repo's CLAUDE.md.
  //
  // TWO THINGS THIS FORBIDS, and both had to be removed to turn it on:
  //   - `middleware.ts`   — Next refuses to build an export that has one at all.
  //                         The auth redirect it did now lives in
  //                         `lib/auth/auth-gate.tsx`, client-side.
  //   - route handlers    — `app/docs/product-vision/route.ts` read a file off
  //                         disk per request; the file moved to
  //                         `public/docs/product-vision.html`.
  //
  // It also forbids dynamic route segments without `generateStaticParams`.
  // There are ZERO `[param]` directories under `app/` — every detail view is
  // client-side — which is the reason this export is viable at all. **Adding one
  // breaks the build**, so reach for a query parameter instead.
  output: 'export',

  images: {
    // No Next image optimizer without a server. Sources are already sized
    // assets out of `public/`, so this costs nothing here.
    unoptimized: true,
  },

  // Emit `about/index.html` rather than `about.html`, so CloudFront's default
  // root object resolves a directory-style URL without a rewrite function.
  trailingSlash: true,

  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
