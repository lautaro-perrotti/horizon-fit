import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { host: '127.0.0.1', port: 5178, proxy: { '/v1': 'http://127.0.0.1:8790', '/platform-config.json': 'http://127.0.0.1:8790' } }, build: { outDir: 'dist' } });
