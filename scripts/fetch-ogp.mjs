import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_DIR = path.resolve(__dirname, '../src/content');
const PAGES_DIR = path.resolve(__dirname, '../src/pages');
const CACHE_FILE = path.resolve(__dirname, '../src/data/ogp-cache.json');
const DATA_DIR = path.dirname(CACHE_FILE);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load existing cache
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
    const content = fs.readFileSync(CACHE_FILE, 'utf-8');
    try {
        const parsed = JSON.parse(content);
        cache = Array.isArray(parsed) ? {} : parsed;
    } catch (e) {
        cache = {};
    }
}

function getFilesRecursively(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(file));
        } else if (file.endsWith('.md') || file.endsWith('.mdx')) {
            results.push(file);
        }
    });
    return results;
}

async function fetchOgp(url) {
    try {
        console.log(`Fetching OGP for: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();

        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
        const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i) || html.match(/<meta name="description" content="([^"]+)"/i);
        const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
        const siteNameMatch = html.match(/<meta property="og:site_name" content="([^"]+)"/i);

        let image = imageMatch ? imageMatch[1] : '';
        // Handle relative image paths
        if (image && !image.startsWith('http')) {
            const urlObj = new URL(url);
            image = new URL(image, urlObj.origin).toString();
        }

        // Clean up entities in values (like &amp;)
        const clean = (str) => str ? str.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'") : '';

        return {
            title: clean(titleMatch ? titleMatch[1].trim() : ''),
            description: clean(descMatch ? descMatch[1].trim() : ''),
            image: clean(image),
            siteName: clean(siteNameMatch ? siteNameMatch[1].trim() : new URL(url).hostname),
        };
    } catch (error) {
        console.error(`Failed to fetch OGP for ${url}:`, error.message);
        return null;
    }
}

async function main() {
    const files = [
        ...getFilesRecursively(CONTENT_DIR),
        ...getFilesRecursively(PAGES_DIR)
    ];

    const urls = new Set();

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');

        // Legacy [ogp:URL] syntax
        const legacyMatches = content.matchAll(/\[ogp:(https?:\/\/[^\]\s]+)\]/g);
        for (const match of legacyMatches) {
            urls.add(match[1]);
        }

        // New <OGP url="URL" /> syntax
        const newMatches = content.matchAll(/<OGP\s+url=["'](https?:\/\/[^"'\s]+)["']/g);
        for (const match of newMatches) {
            urls.add(match[1]);
        }
    }

    let updated = false;
    for (const url of urls) {
        if (!cache[url]) {
            const metadata = await fetchOgp(url);
            if (metadata) {
                cache[url] = metadata;
                updated = true;
            }
        }
    }

    if (updated) {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        console.log(`OGP cache updated with ${Object.keys(cache).length} entries.`);
    } else {
        console.log('No new OGP links found.');
    }
}

main();

