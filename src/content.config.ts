import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const newsCollection = defineCollection({
	loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/news' }),
	schema: ({ image }) => z.object({
		title: z.string(),
		pubDate: z.coerce.date(),
		description: z.string(),
		author: z.string().optional(),
		image: image().optional(),
		tags: z.array(z.string()).optional(),
	}),
});

export const collections = {
	'news': newsCollection,
};
