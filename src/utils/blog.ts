import type { PaginateFunction } from 'astro';
import { getCollection, render } from 'astro:content';
import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import readingTime from 'reading-time';
import type { Post } from '~/types';
import { APP_BLOG } from 'astrowind:config';
import { cleanSlug, trimSlash, BLOG_BASE, POST_PERMALINK_PATTERN, CATEGORY_BASE, TAG_BASE } from './permalinks';

const images = import.meta.glob<ImageMetadata>('~/assets/images/**/*.{jpeg,jpg,png,tiff,webp,gif,svg}');

const generatePermalink = async ({
  id,
  slug,
  publishDate,
  category,
}: {
  id: string;
  slug: string;
  publishDate: Date;
  category: string | undefined;
}) => {
  const year = String(publishDate.getFullYear()).padStart(4, '0');
  const month = String(publishDate.getMonth() + 1).padStart(2, '0');
  const day = String(publishDate.getDate()).padStart(2, '0');
  const hour = String(publishDate.getHours()).padStart(2, '0');
  const minute = String(publishDate.getMinutes()).padStart(2, '0');
  const second = String(publishDate.getSeconds()).padStart(2, '0');

  const permalink = POST_PERMALINK_PATTERN.replace('%slug%', slug)
    .replace('%id%', id)
    .replace('%category%', category || '')
    .replace('%year%', year)
    .replace('%month%', month)
    .replace('%day%', day)
    .replace('%hour%', hour)
    .replace('%minute%', minute)
    .replace('%second%', second);

  return permalink
    .split('/')
    .map((el) => trimSlash(el))
    .filter((el) => !!el)
    .join('/');
};

const getNormalizedPost = async (post: CollectionEntry<'blog'>): Promise<Post> => {
  // Support both { id, data } (file-based) and flat loader entries
  const id = post.id ?? (post as { slug?: string }).slug ?? '';
  const data =
    'data' in post && (post as { data?: unknown }).data != null
      ? (post as { data: Record<string, unknown> }).data
      : (post as Record<string, unknown>);

  let Content: Awaited<ReturnType<typeof render>>['Content'];
  let remarkPluginFrontmatter: Awaited<ReturnType<typeof render>>['remarkPluginFrontmatter'];
  try {
    const rendered = await render(post);
    Content = rendered.Content;
    remarkPluginFrontmatter = rendered.remarkPluginFrontmatter;
  } catch {
    Content = undefined;
    remarkPluginFrontmatter = {};
  }

  // Support both nested (data.image) and flat (post.image) entry shapes; file-based entries use pubDate/description
  const dataRecord = data as Record<string, unknown>;
  const postRecord = post as Record<string, unknown>;
  const rawPublishDate = dataRecord.pubDate ?? dataRecord.publishDate ?? new Date();
  const rawUpdateDate = dataRecord.updatedDate ?? dataRecord.updateDate;
  const title = dataRecord.title;
  const excerpt = dataRecord.excerpt ?? dataRecord.description;
  const rawTags = dataRecord.tags ?? [];
  const rawCategory = dataRecord.category;
  const author = dataRecord.author;
  const draft = dataRecord.draft ?? false;
  const metadata = dataRecord.metadata ?? {};
  const image = dataRecord.image ?? postRecord.image;

  const slug = (post as { slug?: string }).slug ?? cleanSlug(id);
  const publishDate = new Date(rawPublishDate);
  const updateDate = rawUpdateDate ? new Date(rawUpdateDate) : undefined;

  const category = rawCategory
    ? {
        slug: cleanSlug(rawCategory),
        title: rawCategory,
      }
    : undefined;

  const tags = rawTags.map((tag: string) => ({
    slug: cleanSlug(tag),
    title: tag,
  }));

  const dataContent = (data as { content?: string }).content;
  const imageSrc = typeof image === 'string' ? image : (image as { src?: string })?.src;
  const imageObj =
    typeof image === 'object' && image != null
      ? (image as { src?: string; width?: number; height?: number })
      : imageSrc
        ? { src: imageSrc, width: undefined, height: undefined }
        : undefined;
  const globKey =
    imageSrc != null && !imageSrc.startsWith('http')
      ? imageSrc.startsWith('~/')
        ? imageSrc
        : `~/${imageSrc.replace(/^\//, '')}`
      : '';
  const resolvedImage =
    imageSrc != null && imageSrc.length > 0
      ? globKey && images[globKey]
        ? (await images[globKey]()).default
        : imageSrc.startsWith('http') || imageSrc.startsWith('https')
          ? imageSrc
          : imageSrc
            ? imageSrc
            : undefined
      : undefined;

  return {
    id: id,
    slug: slug,
    permalink: await generatePermalink({ id, slug, publishDate, category: category?.slug }),

    publishDate: publishDate,
    updateDate: updateDate,

    title: title,
    excerpt: excerpt,
    image: resolvedImage
      ? {
          src: typeof resolvedImage === 'string' ? resolvedImage : (resolvedImage as { src: string }).src,
          alt: String(title ?? ''),
          width: imageObj?.width ?? (typeof resolvedImage !== 'string' && (resolvedImage as { width?: number }).width),
          height:
            imageObj?.height ?? (typeof resolvedImage !== 'string' && (resolvedImage as { height?: number }).height),
        }
      : undefined,

    category: category,
    tags: tags,
    author: author,

    draft: draft,

    metadata,

    Content: Content as Post['Content'],
    content: dataContent,

    readingTime:
      remarkPluginFrontmatter?.readingTime || (dataContent ? Math.ceil(readingTime(dataContent).minutes) : 0),
  };
};

const load = async function (): Promise<Array<Post>> {
  const posts = await getCollection('blog');
  const normalizedPosts = posts.map(async (post) => await getNormalizedPost(post));

  const results = (await Promise.all(normalizedPosts))
    .sort((a, b) => b.publishDate.valueOf() - a.publishDate.valueOf())
    .filter((post) => !post.draft);

  return results;
};

let _posts: Array<Post>;

/** */
export const isBlogEnabled = APP_BLOG.isEnabled;
export const isRelatedPostsEnabled = APP_BLOG.isRelatedPostsEnabled;
export const isBlogListRouteEnabled = APP_BLOG.list.isEnabled;
export const isBlogPostRouteEnabled = APP_BLOG.post.isEnabled;
export const isBlogCategoryRouteEnabled = APP_BLOG.category.isEnabled;
export const isBlogTagRouteEnabled = APP_BLOG.tag.isEnabled;

export const blogListRobots = APP_BLOG.list.robots;
export const blogPostRobots = APP_BLOG.post.robots;
export const blogCategoryRobots = APP_BLOG.category.robots;
export const blogTagRobots = APP_BLOG.tag.robots;

export const blogPostsPerPage = APP_BLOG?.postsPerPage;

/** */
export const fetchPosts = async (): Promise<Array<Post>> => {
  if (!_posts) {
    _posts = await load();
  }

  return _posts;
};

/** */
export const findPostsBySlugs = async (slugs: Array<string>): Promise<Array<Post>> => {
  if (!Array.isArray(slugs)) return [];

  const posts = await fetchPosts();

  return slugs.reduce(function (r: Array<Post>, slug: string) {
    posts.some(function (post: Post) {
      return slug === post.slug && r.push(post);
    });
    return r;
  }, []);
};

/** */
export const findPostsByIds = async (ids: Array<string>): Promise<Array<Post>> => {
  if (!Array.isArray(ids)) return [];

  const posts = await fetchPosts();

  return ids.reduce(function (r: Array<Post>, id: string) {
    posts.some(function (post: Post) {
      return id === post.id && r.push(post);
    });
    return r;
  }, []);
};

/** */
export const findLatestPosts = async ({ count }: { count?: number }): Promise<Array<Post>> => {
  const _count = count || 4;
  const posts = await fetchPosts();

  return posts ? posts.slice(0, _count) : [];
};

/** */
export const getStaticPathsBlogList = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isBlogEnabled || !isBlogListRouteEnabled) return [];
  return paginate(await fetchPosts(), {
    params: { blog: BLOG_BASE || undefined },
    pageSize: blogPostsPerPage,
  });
};

/** */
export const getStaticPathsBlogPost = async () => {
  if (!isBlogEnabled || !isBlogPostRouteEnabled) return [];
  return (await fetchPosts()).flatMap((post) => ({
    params: {
      blog: post.permalink,
    },
    props: { post },
  }));
};

/** */
export const getStaticPathsBlogCategory = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isBlogEnabled || !isBlogCategoryRouteEnabled) return [];

  const posts = await fetchPosts();
  const categories = {};
  posts.map((post) => {
    if (post.category?.slug) {
      categories[post.category?.slug] = post.category;
    }
  });

  return Array.from(Object.keys(categories)).flatMap((categorySlug) =>
    paginate(
      posts.filter((post) => post.category?.slug && categorySlug === post.category?.slug),
      {
        params: { category: categorySlug, blog: CATEGORY_BASE || undefined },
        pageSize: blogPostsPerPage,
        props: { category: categories[categorySlug] },
      }
    )
  );
};

/** */
export const getStaticPathsBlogTag = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isBlogEnabled || !isBlogTagRouteEnabled) return [];

  const posts = await fetchPosts();
  const tags = {};
  posts.map((post) => {
    if (Array.isArray(post.tags)) {
      post.tags.map((tag) => {
        tags[tag?.slug] = tag;
      });
    }
  });

  return Array.from(Object.keys(tags)).flatMap((tagSlug) =>
    paginate(
      posts.filter((post) => Array.isArray(post.tags) && post.tags.find((elem) => elem.slug === tagSlug)),
      {
        params: { tag: tagSlug, blog: TAG_BASE || undefined },
        pageSize: blogPostsPerPage,
        props: { tag: tags[tagSlug] },
      }
    )
  );
};

/** */
export async function getRelatedPosts(originalPost: Post, maxResults: number = 4): Promise<Post[]> {
  const allPosts = await fetchPosts();
  const originalTagsSet = new Set(originalPost.tags ? originalPost.tags.map((tag) => tag.slug) : []);

  const postsWithScores = allPosts.reduce((acc: { post: Post; score: number }[], iteratedPost: Post) => {
    if (iteratedPost.slug === originalPost.slug) return acc;

    let score = 0;
    if (iteratedPost.category && originalPost.category && iteratedPost.category.slug === originalPost.category.slug) {
      score += 5;
    }

    if (iteratedPost.tags) {
      iteratedPost.tags.forEach((tag) => {
        if (originalTagsSet.has(tag.slug)) {
          score += 1;
        }
      });
    }

    acc.push({ post: iteratedPost, score });
    return acc;
  }, []);

  postsWithScores.sort((a, b) => b.score - a.score);

  const selectedPosts: Post[] = [];
  let i = 0;
  while (selectedPosts.length < maxResults && i < postsWithScores.length) {
    selectedPosts.push(postsWithScores[i].post);
    i++;
  }

  return selectedPosts;
}
