// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://hiro-uni.github.io',
  base: '/',
  redirects: {
    '/ggj_interview/interview': '/interview/ggj25/page',
  },
});
