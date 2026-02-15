import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'static',
  server: { port: 8000, host: '0.0.0.0' },
  vite: {
    build: { target: 'esnext' },
  },
});
