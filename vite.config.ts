import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['school-logo.png'],
            manifest: {
                name: 'School ERP',
                short_name: 'School ERP',
                description: 'School ERP — Student, Fee & Staff Management System',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
                icons: [
                    {
                        src: '/school-logo.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: '/school-logo.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: '/school-logo.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            },
            devOptions: {
                enabled: true
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
