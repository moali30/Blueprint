import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true';
  return {
    base: mode === 'production' && isGitHubPagesBuild ? '/Blueprint/' : '/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.MISTRAL_API_KEY': JSON.stringify(env.MISTRAL_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
