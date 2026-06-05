import createImageUrlBuilder from '@sanity/image-url'
import { SanityImageSource } from "@sanity/image-url/lib/types/types";

import { dataset, projectId } from '../env'

// https://www.sanity.io/docs/image-url
const builder = createImageUrlBuilder({ projectId, dataset })

export const urlFor = (source: SanityImageSource) => {
  return builder.image(source)
}

/**
 * Returns a Sanity CDN URL optimised for Open Graph images:
 *   1200×630 px, JPEG, quality 80 — consistently under 300 KB.
 *
 * JPEG is used instead of WebP because some social crawlers (LinkedIn,
 * iMessage) still don't support WebP for og:image.
 */
export function sanityOgImageUrl(source: SanityImageSource): string {
  return builder
    .image(source)
    .width(1200)
    .height(630)
    .fit("crop")
    .format("jpg")
    .quality(80)
    .url();
}
