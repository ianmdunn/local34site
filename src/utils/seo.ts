import type { ImageMetadata } from 'astro';
import type { MetaDataImage, MetaDataOpenGraph } from '~/types';

type OpenGraphImageInput = string | ImageMetadata | MetaDataImage;

export interface OpenGraphOptions {
  url?: string;
  siteName?: string;
  locale?: string;
  type?: string;
  images?: OpenGraphImageInput[];
  imageAlt?: string;
}

const isImageMetadata = (value: OpenGraphImageInput): value is ImageMetadata =>
  typeof value === 'object' && value !== null && 'src' in value;

const normalizeOpenGraphImage = (image: OpenGraphImageInput, fallbackAlt?: string): MetaDataImage | null => {
  if (typeof image === 'string') {
    const url = image.trim();
    return url ? { url, alt: fallbackAlt } : null;
  }

  if (isImageMetadata(image)) {
    return {
      url: image.src,
      width: image.width,
      height: image.height,
      alt: fallbackAlt,
    };
  }

  if (typeof image.url !== 'string' || !image.url.trim()) {
    return null;
  }

  return {
    ...image,
    url: image.url.trim(),
    alt: image.alt ?? fallbackAlt,
  };
};

export const generateOpenGraphMeta = (options: OpenGraphOptions = {}): MetaDataOpenGraph => {
  const {
    url,
    siteName,
    locale,
    type = 'website',
    images = [],
    imageAlt,
  } = options;

  const normalizedImages = images
    .map((image) => normalizeOpenGraphImage(image, imageAlt))
    .filter((image): image is MetaDataImage => Boolean(image));

  return {
    ...(url ? { url } : {}),
    ...(siteName ? { siteName } : {}),
    ...(locale ? { locale } : {}),
    ...(type ? { type } : {}),
    ...(normalizedImages.length ? { images: normalizedImages } : {}),
  };
};
