// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://hiro-uni.github.io',
  base: '/',

  redirects: {
    '/ggj25_interview/interview': '/interview/ggj25/page',
  },

  markdown: {
    rehypePlugins: [],
  },

  integrations: [mdx()]
});