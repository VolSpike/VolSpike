/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable StrictMode only in development so we catch issues
    // locally without double-running effects in production.
    reactStrictMode: process.env.NODE_ENV === 'development',
    outputFileTracingRoot: __dirname,
    images: {
        // Allow common avatar hosts. Keep domains for backward compat
        domains: [
            'localhost',
            'lh1.googleusercontent.com',
            'lh2.googleusercontent.com',
            'lh3.googleusercontent.com',
            'lh4.googleusercontent.com',
            'lh5.googleusercontent.com',
            'lh6.googleusercontent.com',
            'avatars.githubusercontent.com',
            'assets.coingecko.com',
            'coin-images.coingecko.com',
            'cryptologos.cc',
            'cryptoicons.org',
            'raw.githubusercontent.com',
        ],
        // Be robust to any googleusercontent subdomain in production
        remotePatterns: [
            { protocol: 'https', hostname: '**.googleusercontent.com' },
            { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
            { protocol: 'https', hostname: 'assets.coingecko.com' },
            { protocol: 'https', hostname: 'coin-images.coingecko.com' },
            { protocol: 'https', hostname: 'cryptologos.cc' },
            { protocol: 'https', hostname: 'cryptoicons.org' },
            { protocol: 'https', hostname: 'raw.githubusercontent.com' },
        ],
    },
    env: {
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
        NEXT_PUBLIC_SOCKET_IO_URL: process.env.NEXT_PUBLIC_SOCKET_IO_URL,
        // Used by useBuildVersionGuard to detect when a tab is running an
        // old bundle and should be reloaded. Prefer a stable commit SHA
        // when available, otherwise fall back to an explicit env value.
        NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA,
    },
    webpack: (config) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            '@react-native-async-storage/async-storage': false,
            'react-native': false,
        };
        // Ensure tweetnacl is resolved correctly (CommonJS module)
        config.resolve.alias = {
            ...config.resolve.alias,
        };
        // Mark tweetnacl as external for client-side only (it's a browser-compatible module)
        if (!config.resolve.extensionAlias) {
            config.resolve.extensionAlias = {};
        }
        return config;
    },
    async headers() {
        const isDev = process.env.NODE_ENV === 'development'
        return [
            {
                // Scope narrowly to avoid breaking public/marketing pages
                source: '/(dashboard|admin)/:path*',
                headers: isDev
                    ? [
                        // Base Account SDK requires COOP not be 'same-origin'
                        { key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' },
                        // Disable COEP in dev to avoid cross-origin restrictions
                        { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
                        { key: 'Origin-Agent-Cluster', value: '?1' },
                    ]
                    : [
                    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                    { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
                    { key: 'Origin-Agent-Cluster', value: '?1' },
                ],
            },
            {
                // Helpful for your own static assets when using COEP
                source: '/_next/(.*)',
                headers: [
                    { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
                ],
            },
        ];
    },
    async rewrites() {
        const isDev = process.env.NODE_ENV === 'development'
        const backendUrl = 'http://localhost:3001'
        if (isDev) {
            return [
                // Proxy ONLY the backend under /backend to avoid touching NextAuth's /api/auth/*
                { source: '/backend/:path*', destination: `${backendUrl}/api/:path*` },
            ]
        }
        return []
    },
};

module.exports = nextConfig;
