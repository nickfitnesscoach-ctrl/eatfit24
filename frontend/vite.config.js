/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/app',
  // Fallback values for production build
  // These are used if env vars are not provided during build
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || '/api/v1'
    ),
    'import.meta.env.VITE_TELEGRAM_BOT_NAME': JSON.stringify(
      process.env.VITE_TELEGRAM_BOT_NAME || 'EatFit24_bot'
    ),
    'import.meta.env.VITE_TRAINER_INVITE_LINK': JSON.stringify(
      process.env.VITE_TRAINER_INVITE_LINK || 'https://t.me/EatFit24_bot'
    ),
  },
  server: {
    // Allow access through tunnels for Telegram WebApp testing
    allowedHosts: [
      'localhost',
      '.trycloudflare.com',  // cloudflared quick tunnels (RECOMMENDED)
      '.loca.lt',  // localtunnel domains
      '.ngrok-free.dev',  // ngrok free domains
      '.ngrok.io',  // ngrok legacy domains
    ],
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // 4.4: Bundle optimization - code splitting for better caching
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - separate large dependencies for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-icons': ['lucide-react'],
        }
      }
    },
    // Increase chunk size warning limit (default 500KB)
    chunkSizeWarningLimit: 600,
  },
  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  }
})
