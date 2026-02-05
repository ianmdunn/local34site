import { z, defineCollection } from 'astro:content';

const metadataDefinition = () =>
  z
    .object({
      title: z.string().optional(),
      ignoreTitleTemplate: z.boolean().optional(),

      canonical: z.string().url().optional(),

      robots: z
        .object({
          index: z.boolean().optional(),
          follow: z.boolean().optional(),
        })
        .optional(),

      description: z.string().optional(),

      openGraph: z
        .object({
          url: z.string().optional(),
          siteName: z.string().optional(),
          images: z
            .array(
              z.object({
                url: z.string(),
                width: z.number().optional(),
                height: z.number().optional(),
              })
            )
            .optional(),
          locale: z.string().optional(),
          type: z.string().optional(),
        })
        .optional(),

      twitter: z
        .object({
          handle: z.string().optional(),
          site: z.string().optional(),
          cardType: z.string().optional(),
        })
        .optional(),
    })
    .optional();

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    publishDate: z
      .union([z.date(), z.string()])
      .transform((v) => (v ? new Date(v) : undefined))
      .optional(),
    pubDate: z
      .union([z.date(), z.string()])
      .transform((v) => (v ? new Date(v) : undefined))
      .optional(),
    updateDate: z.date().optional(),
    updatedDate: z
      .union([z.date(), z.string()])
      .transform((v) => (v ? new Date(v) : undefined))
      .optional(),
    draft: z.boolean().optional(),

    title: z.string(),
    description: z.string().optional(),
    excerpt: z.string().optional(),
    image: z
      .union([
        z.string(),
        z.object({
          src: z.string(),
          width: z.number().optional(),
          height: z.number().optional(),
        }),
      ])
      .optional(),

    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),

    metadata: metadataDefinition(),
  }),
});

// Markdown pages (home, about, contact, etc.) — distinct from src/pages/ (Astro routes)
const sitePagesCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    image: z.string().optional(),
    metadata: metadataDefinition(),
  }),
});

export const collections = {
  blog: blogCollection,
  sitePages: sitePagesCollection,
};
