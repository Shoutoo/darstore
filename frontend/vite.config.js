import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

function spaFallbackPlugin() {
  return {
    name: 'spa-fallback-generator',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const indexPath = resolve(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        const routes = ['ml', 'valo', 'cek-transaksi'];
        routes.forEach(route => {
          const routeDir = resolve(distDir, route);
          if (!fs.existsSync(routeDir)) {
            fs.mkdirSync(routeDir, { recursive: true });
          }
          fs.copyFileSync(indexPath, resolve(routeDir, 'index.html'));
        });
      }
    }
  };
}

export default defineConfig({
  appType: 'spa',
  plugins: [spaFallbackPlugin()],
  server: {
    port: 5173,
    open: false,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});
