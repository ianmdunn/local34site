import { getImage } from 'astro:assets';
import { transformUrl, parseUrl } from 'unpic';

import type { ImageMetadata } from 'astro';
import type { HTMLAttributes } from 'astro/types';

type Layout = 'fixed' | 'constrained' | 'fullWidth' | 'cover' | 'responsive' | 'contained';

export interface ImageProps extends Omit<HTMLAttributes<'img'>, 'src'> {
  src?: string | ImageMetadata | null;
  width?: string | number | null;
  height?: string | number | null;
  alt?: string | null;
  loading?: 'eager' | 'lazy' | null;
  decoding?: 'sync' | 'async' | 'auto' | null;
  style?: string;
  srcset?: string | null;
  sizes?: string | null;
  fetchpriority?: 'high' | 'low' | 'auto' | null;

  layout?: Layout;
  widths?: number[] | null;
  aspectRatio?: string | number | null;
  objectPosition?: string;

  format?: string;
}

export type ImagesOptimizer = (
  image: ImageMetadata | string,
  breakpoints: number[],
  width?: number,
  height?: number,
  format?: string
) => Promise<Array<{ src: string; width: number }>>;

/* ******* */
const config = {
  // FIXME: Use this when image.width is minor than deviceSizes
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

  deviceSizes: [
    640, // older and lower-end phones
    750, // iPhone 6-8
    828, // iPhone XR/11
    960, // older horizontal phones
    1080, // iPhone 6-8 Plus
    1280, // 720p
    1668, // Various iPads
    1920, // 1080p
    2048, // QXGA
    2560, // WQXGA
    3200, // QHD+
    3840, // 4K
    4480, // 4.5K
    5120, // 5K
    6016, // 6K
  ],

  formats: ['image/webp'],
};

const computeHeight = (width: number, aspectRatio: number) => {
  return Math.floor(width / aspectRatio);
};

const parseAspectRatio = (aspectRatio: number | string | null | undefined): number | undefined => {
  if (typeof aspectRatio === 'number') return aspectRatio;

  if (typeof aspectRatio === 'string') {
    const match = aspectRatio.match(/(\d+)\s*[/:]\s*(\d+)/);

    if (match) {
      const [, num, den] = match.map(Number);
      if (den && !isNaN(num)) return num / den;
    } else {
      const numericValue = parseFloat(aspectRatio);
      if (!isNaN(numericValue)) return numericValue;
    }
  }

  return undefined;
};

/**
 * Gets the `sizes` attribute for an image, based on the layout and width
 */
export const getSizes = (width?: number, layout?: Layout): string | undefined => {
  if (!width || !layout) {
    return undefined;
  }
  switch (layout) {
    // If screen is wider than the max size, image width is the max size,
    // otherwise it's the width of the screen
    case `constrained`:
      return `(min-width: ${width}px) ${width}px, 100vw`;

    // Image is always the same width, whatever the size of the screen
    case `fixed`:
      return `${width}px`;

    // Image is always the width of the screen
    case `fullWidth`:
      return `100vw`;

    default:
      return undefined;
  }
};

const pixelate = (value?: number) => (value !== null && value !== undefined ? `${value}px` : undefined);

const getStyle = ({
  width,
  height,
  aspectRatio,
  layout,
  objectFit = 'cover',
  objectPosition = 'center',
  background,
}: {
  width?: number;
  height?: number;
  aspectRatio?: number;
  objectFit?: string;
  objectPosition?: string;
  layout?: string;
  background?: string;
}) => {
  const styles: Record<string, string | undefined> = {
    'object-fit': objectFit,
    'object-position': objectPosition,
  };

  if (background?.startsWith('https:') || background?.startsWith('http:') || background?.startsWith('data:')) {
    styles['background-image'] = `url(${background})`;
    styles['background-size'] = 'cover';
    styles['background-repeat'] = 'no-repeat';
  } else {
    styles.background = background;
  }

  switch (layout) {
    case 'fixed':
      styles.width = pixelate(width);
      styles.height = pixelate(height);
      styles['object-position'] = 'top left';
      break;
    case 'constrained':
      styles['max-width'] = pixelate(width);
      styles['max-height'] = pixelate(height);
      styles['aspect-ratio'] = aspectRatio ? `${aspectRatio}` : undefined;
      styles.width = '100%';
      break;
    case 'fullWidth':
      styles.width = '100%';
      styles['aspect-ratio'] = aspectRatio ? `${aspectRatio}` : undefined;
      styles.height = pixelate(height);
      break;
    case 'responsive':
      styles.width = '100%';
      styles.height = 'auto';
      styles['aspect-ratio'] = aspectRatio ? `${aspectRatio}` : undefined;
      break;
    case 'contained':
      styles['max-width'] = '100%';
      styles['max-height'] = '100%';
      styles['object-fit'] = 'contain';
      styles['aspect-ratio'] = aspectRatio ? `${aspectRatio}` : undefined;
      break;
    case 'cover':
      styles['max-width'] = '100%';
      styles['max-height'] = '100%';
      break;
    default:
      break;
  }

  return Object.entries(styles)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');
};

const getBreakpoints = ({
  width,
  breakpoints: customBreakpoints,
  layout,
}: {
  width?: number;
  breakpoints?: number[];
  layout: Layout;
}): number[] => {
  switch (layout) {
    case 'fullWidth':
    case 'cover':
    case 'responsive':
    case 'contained':
      return customBreakpoints || config.deviceSizes;
    case 'fixed':
      return width ? [width, width * 2] : [];
    case 'constrained': {
      if (!width) return [];
      const doubleWidth = width * 2;
      return [width, doubleWidth, ...(customBreakpoints || config.deviceSizes).filter((w) => w < doubleWidth)];
    }
    default:
      return [];
  }
};

/* ** */
export const astroAssetsOptimizer: ImagesOptimizer = async (
  image,
  breakpoints,
  _width,
  _height,
  format = undefined
) => {
  if (!image) {
    return [];
  }

  // If format is not provided, infer from the image source extension so remote URLs
  // work when the server doesn't send Content-Type
  let inferredFormat = format;
  const imageSrc = typeof image === 'string' ? image : (image as { src?: string })?.src;

  if (!inferredFormat && typeof imageSrc === 'string') {
    const extension = imageSrc.split('.').pop()?.split(/[?#]/)[0].toLowerCase();
    if (extension && ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'tiff'].includes(extension)) {
      inferredFormat = extension === 'jpg' ? 'jpeg' : extension;
    }
  }

  // getImage() accepts: (1) ImageMetadata from imports, (2) http(s) URL string. It rejects local file paths (e.g. /@fs/...).
  const rawSrc = typeof image === 'string' ? image : (image as { src?: string })?.src;
  const isUrlString = typeof rawSrc === 'string' && (rawSrc.startsWith('http://') || rawSrc.startsWith('https://'));
  const isLocalPathString = typeof image === 'string' && !isUrlString;

  // Internal/unreachable URLs at build time; skip getImage and use URL as-is to avoid fetch errors.
  // - localhost: dev services
  // - Directus image proxy: returns images server-side, getImage can't fetch dimensions
  const isUnreachableUrl =
    typeof rawSrc === 'string' &&
    (rawSrc.includes('localhost') ||
      rawSrc.includes('127.0.0.1') ||
      rawSrc.includes('proxydirectusimage') ||
      (rawSrc.includes('run.app') && rawSrc.includes('?id=')));

  if (isUnreachableUrl && typeof rawSrc === 'string') {
    return breakpoints.map((width) => ({
      src: rawSrc,
      width,
      height: _height || 0,
    }));
  }

  if (isLocalPathString && typeof rawSrc === 'string') {
    return breakpoints.map((width) => ({
      src: rawSrc,
      width,
      height: _height || 0,
    }));
  }

  // Pass ImageMetadata object for imported images; pass URL string only for remote. Never pass file path string.
  const srcForGetImage = typeof image === 'string' ? image : isUrlString ? rawSrc : image;

  return Promise.all(
    breakpoints.map(async (w: number) => {
      try {
        const result = await getImage({
          src: srcForGetImage,
          width: w,
          inferSize: true,
          ...(inferredFormat ? { format: inferredFormat as 'avif' | 'png' | 'webp' | 'jpeg' | 'svg' } : {}),
        });

        return {
          src: result?.src,
          width: result?.attributes?.width ?? w,
          height: result?.attributes?.height,
        };
      } catch (e) {
        console.error('Error optimizing image:', image, e instanceof Error ? e.message : e);
        return {
          src: typeof image === 'string' ? image : image.src,
          width: w,
          height: _height || 0,
        };
      }
    })
  );
};

export const isUnpicCompatible = (image: string) => {
  return typeof parseUrl(image) !== 'undefined';
};

/* ** */
export const unpicOptimizer: ImagesOptimizer = async (image, breakpoints, width, height, format = undefined) => {
  if (!image || typeof image !== 'string') {
    return [];
  }

  const urlParsed = parseUrl(image);
  if (!urlParsed) {
    return [];
  }

  return Promise.all(
    breakpoints.map(async (w: number) => {
      const _height = width && height ? computeHeight(w, width / height) : height;
      const url =
        transformUrl({
          url: image,
          width: w,
          height: _height,
          cdn: urlParsed.cdn,
          ...(format ? { format: format } : {}),
        }) || image;
      return {
        src: String(url),
        width: w,
        height: _height,
      };
    })
  );
};

/* ** */
export async function getImagesOptimized(
  image: ImageMetadata | string,
  {
    src: _,
    width,
    height,
    sizes,
    aspectRatio,
    objectPosition,
    widths,
    layout = 'constrained',
    style = '',
    format,
    ...rest
  }: ImageProps,
  transform: ImagesOptimizer = () => Promise.resolve([])
): Promise<{ src: string; attributes: HTMLAttributes<'img'> }> {
  if (typeof image !== 'string') {
    width ||= Number(image.width) || undefined;
    height ||= typeof width === 'number' ? computeHeight(width, image.width / image.height) : undefined;
  }

  width = (width && Number(width)) || undefined;
  height = (height && Number(height)) || undefined;

  widths ||= config.deviceSizes;
  sizes ||= getSizes(Number(width) || undefined, layout);
  aspectRatio = parseAspectRatio(aspectRatio);

  // Helper for logging errors
  const logImageError = (message: string, imageInfo: ImageMetadata | string) => {
    console.error(message);
    console.error('Image', imageInfo);
  };

  // Calculate dimensions from aspect ratio
  if (aspectRatio) {
    if (width) {
      if (height) {
        /* empty */
      } else {
        height = width / aspectRatio;
      }
    } else if (height) {
      width = Number(height * aspectRatio);
    } else if (layout !== 'fullWidth') {
      // Fullwidth images have 100% width, so aspectRatio is applicable
      logImageError('When aspectRatio is set, either width or height must also be set', image);
    }
  } else if (width && height) {
    aspectRatio = width / height;
  } else if (layout !== 'fullWidth') {
    // Fullwidth images don't need dimensions
    logImageError('Either aspectRatio or both width and height must be set', image);
  }

  let breakpoints = getBreakpoints({ width: width, breakpoints: widths, layout: layout });
  breakpoints = [...new Set(breakpoints)].sort((a, b) => a - b);

  const srcset = (await transform(image, breakpoints, Number(width) || undefined, Number(height) || undefined, format))
    .map(({ src, width }) => `${src} ${width}w`)
    .join(', ');

  return {
    src: typeof image === 'string' ? image : image.src,
    attributes: {
      width: width,
      height: height,
      srcset: srcset || undefined,
      sizes: sizes,
      style: `${getStyle({
        width: width,
        height: height,
        aspectRatio: aspectRatio,
        objectPosition: objectPosition,
        layout: layout,
      })}${style ?? ''}`,
      ...rest,
    },
  };
}
