import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['node-pty', 'ws', 'electron-updater', './daemon-launcher', './daemon-client', './daemon'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      {
        entry: 'electron/daemon-launcher.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['node-pty', 'ws', 'electron'],
            },
          },
        },
      },
      {
        entry: 'electron/daemon-client.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // protocol.ts is bundled inline (it's just types + constants)
              external: ['node-pty', 'ws', 'electron'],
            },
          },
        },
      },
      {
        entry: 'daemon/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['node-pty', 'ws', 'electron'],
              output: {
                // Output as daemon.js so require('./daemon') resolves correctly
                entryFileNames: 'daemon.js',
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
