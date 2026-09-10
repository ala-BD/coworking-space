import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  server: {
    host: true,
  },
  plugins: [
    react(),
    // Gzip — compatible avec tous les serveurs/CDN
    compression({
      algorithm: 'gzip',
      exclude: [/\.(png|jpe?g|gif|webp|svg|ico|woff2?)$/i],
      threshold: 1024, // compresser uniquement les fichiers > 1 KB
    }),
    // Brotli — meilleure compression pour les navigateurs modernes
    compression({
      algorithm: 'brotliCompress',
      exclude: [/\.(png|jpe?g|gif|webp|svg|ico|woff2?)$/i],
      threshold: 1024,
    }),
  ],
  build: {
    sourcemap: false,
    // Réduire la taille du CSS inline (Tailwind v4 génère beaucoup de classes)
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'charts';
            if (id.includes('exceljs')) return 'excel';
            if (id.includes('qrcode.react')) return 'qr';
            if (id.includes('socket.io-client')) return 'socket';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('react-router-dom') || id.includes('react-router')) return 'router';
            if (id.includes('react-dom') || id.includes('react')) return 'react';
          }
        },
      },
    },
  },
});
