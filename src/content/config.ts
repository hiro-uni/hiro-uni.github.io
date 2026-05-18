import { defineCollection, z } from 'astro:content';

const newsCollection = defineCollection({
	type: 'content',
	schema: ({ image }) => z.object({
		title: z.string(),
		pubDate: z.date(),
		description: z.string(),
		author: z.string().optional(),
		image: image().optional(),
		tags: z.array(z.string()).optional(),
	}),
});

export const collections = {
	'news': newsCollection,
};
