import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ICON_PATHS = [
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
];

const ICON_MIME = {
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

function devIconsPlugin() {
  const devDir = path.resolve(__dirname, 'public/dev');

  return {
    name: 'echochat-dev-icons',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? '';
        if (!ICON_PATHS.includes(pathname)) return next();

        const file = path.join(devDir, path.basename(pathname));
        if (!fs.existsSync(file)) return next();

        res.setHeader('Content-Type', ICON_MIME[path.extname(file)] ?? 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

function stripDevIconsPlugin() {
  return {
    name: 'echochat-strip-dev-icons',
    apply: 'build',
    closeBundle() {
      fs.rmSync(path.resolve(__dirname, 'dist/dev'), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devIconsPlugin(), stripDevIconsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
