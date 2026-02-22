import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    const isProd = mode === 'production';
    const apiTarget = process.env.VITE_API_URL || 'http://127.0.0.1:8000';

    return {
        plugins: [react()],
        server: {
            host: '0.0.0.0',
            port: 3000,
            // Dev-only proxy — in production Vercel sets VITE_API_URL
            ...(!isProd && {
                proxy: {
                    '/auth': { target: apiTarget, changeOrigin: true },
                    '/kyc': { target: apiTarget, changeOrigin: true },
                    '/consent': { target: apiTarget, changeOrigin: true },
                    '/audit': { target: apiTarget, changeOrigin: true },
                }
            }),
        },
        // In production, VITE_API_URL is baked into the bundle by Vercel
        define: isProd ? {} : {},
    };
});
