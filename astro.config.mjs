// @ts-check
import { defineConfig } from 'astro/config';

import fs from 'node:fs';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function rehypeOgpCard() {
  const cachePath = path.resolve(__dirname, 'src/data/ogp-cache.json');
  let cache = {};
  if (fs.existsSync(cachePath)) {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }

  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'p') {
        // Look for the pattern [ogp: <a> ]
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];

          // Pattern: text("[ogp:") + element("a") + text("]")
          if (
            i + 2 < node.children.length &&
            node.children[i].type === 'text' && node.children[i].value.includes('[ogp:') &&
            node.children[i + 1].type === 'element' && node.children[i + 1].tagName === 'a' &&
            node.children[i + 2].type === 'text' && node.children[i + 2].value.includes(']')
          ) {
            const url = node.children[i + 1].properties.href;
            const data = cache[url] || cache[url + '/'] || (url && url.endsWith('/') ? cache[url.slice(0, -1)] : null);

            if (data) {
              const cardHtml = `
<a href="${url}" class="ogp-card" target="_blank" rel="noopener noreferrer">
  <div class="ogp-card-content">
    <div class="ogp-card-info">
      <p class="ogp-site-name">${data.siteName || new URL(url).hostname}</p>
      <h3 class="ogp-card-title">${data.title}</h3>
      ${data.description ? `<p class="ogp-card-description">${data.description}</p>` : ''}
    </div>
    ${data.image ? `
    <div class="ogp-card-image">
      <img src="${data.image}" alt="" loading="lazy" />
    </div>` : ''}
  </div>
</a>`.trim();

              // Replace the nodes
              const prevValue = node.children[i].value;
              const prevText = prevValue.slice(0, prevValue.lastIndexOf('[ogp:'));

              const nextValue = node.children[i + 2].value;
              const nextText = nextValue.slice(nextValue.indexOf(']') + 1);

              const newNodes = [];
              if (prevText) newNodes.push({ type: 'text', value: prevText });
              newNodes.push({ type: 'raw', value: cardHtml });
              if (nextText) newNodes.push({ type: 'text', value: nextText });

              node.children.splice(i, 3, ...newNodes);
              i += newNodes.length - 1;
            }
          }
        }
      }
    });
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
    rehypePlugins: [rehypeOgpCard],
  },
});
