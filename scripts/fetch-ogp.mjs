import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NEWS_DIR = path.resolve(__dirname, '../src/content/news');
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

async function fetchOgp(url) {
    try {
        console.log(`Fetching OGP for: ${url}`);
        const response = await fetch(url);
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

        return {
            title: titleMatch ? titleMatch[1].trim() : '',
            description: descMatch ? descMatch[1].trim() : '',
            image: image,
            siteName: siteNameMatch ? siteNameMatch[1].trim() : new URL(url).hostname,
        };
    } catch (error) {
        console.error(`Failed to fetch OGP for ${url}:`, error.message);
        return null;
    }
}

async function main() {
    const files = fs.readdirSync(NEWS_DIR).filter(file => file.endsWith('.md'));
    const urls = new Set();

    for (const file of files) {
        const content = fs.readFileSync(path.join(NEWS_DIR, file), 'utf-8');
        const matches = content.matchAll(/\[ogp:(https?:\/\/[^\]]+)\]/g);
        for (const match of matches) {
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
        console.log('OGP cache updated.');
    } else {
        console.log('No new OGP links found.');
    }
}

main();
