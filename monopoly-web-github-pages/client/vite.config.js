import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  base: './', // relative asset paths: works on https://user.github.io/<repo>/ without extra config
  plugins: [react()],
  css: { postcss: path.resolve(here, '..') },
  server: { port: 5173, fs: { allow: [path.resolve(here, '..')] } },
  build: { outDir: 'dist', emptyOutDir: true },
});
