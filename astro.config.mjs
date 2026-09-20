// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @returns {import('astro').AstroIntegration} */
function copySitemapPlugin() {
  return {
    name: 'copy-sitemap',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const sitemap0 = path.join(outDir, 'sitemap-0.xml');
        const sitemap1 = path.join(outDir, 'sitemap-1.xml');
        const sitemapIndex = path.join(outDir, 'sitemap-index.xml');
        const sitemapXml = path.join(outDir, 'sitemap.xml');

        const source = fs.existsSync(sitemap1) ? sitemapIndex : (fs.existsSync(sitemap0) ? sitemap0 : sitemapIndex);
        if (fs.existsSync(source)) {
          fs.copyFileSync(source, sitemapXml);
          logger.info(`Copied ${path.basename(source)} to sitemap.xml`);
        }
      },
    },
  };
}

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

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => new URL(page).pathname !== '/interview/ggj26_organizer/',
    }),
    copySitemapPlugin(),
  ]
});
