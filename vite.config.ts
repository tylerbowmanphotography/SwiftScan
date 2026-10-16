import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {adsenseClientId} from './src/utils/adsense';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const adsenseClient = adsenseClientId(env.VITE_ADSENSE_CLIENT_ID);

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'adsense-html',
        transformIndexHtml() {
          if (!adsenseClient) return;
          return [
            {
              tag: 'meta',
              attrs: {name: 'google-adsense-account', content: adsenseClient},
              injectTo: 'head',
            },
            {
              tag: 'script',
              attrs: {
                async: true,
                src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`,
                crossorigin: 'anonymous',
              },
              injectTo: 'head',
            },
          ];
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
