import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    build: {
        outDir: '../power-server/public',
        emptyOutDir: true,
    },
    server: {
        proxy: {
            '/api': 'http://localhost:3002',
            '/ws': {
                target: 'ws://localhost:3002',
                ws: true,
            },
        },
    },
});
