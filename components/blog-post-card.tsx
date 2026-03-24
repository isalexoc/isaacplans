import Link from "next/link";
import Image from "next/image";
import { type SanityDocument } from "next-sanity";
import { urlFor } from "@/sanity/lib/image";
import { getBlogCategoryLabel } from "@/lib/blog-category-labels";

type TitleHeading = "h2" | "h3";

export function BlogPostCard({
  post,
  locale,
  featured = false,
  titleAs = "h2",
}: {
  post: SanityDocument;
  locale: string;
  featured?: boolean;
  titleAs?: TitleHeading;
}) {
  const imageUrl = post.image
    ? urlFor(post.image).width(600).height(400).fit("crop").crop("top").url()
    : null;

  const categoryLabel = getBlogCategoryLabel(post.category, locale);
  const TitleTag = titleAs;

  return (
    <Link
      href={`/${locale}/blog/${post.slug.current}`}
      className="group block h-full min-w-0"
    >
      <article className="relative flex h-full min-h-[8.5rem] flex-row overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800 md:min-h-0 md:flex-col">
        {/* Media — horizontal strip on mobile, stacked on md+ */}
        <div className="relative aspect-[4/3] w-[min(42%,11rem)] shrink-0 overflow-hidden bg-slate-100 sm:w-[min(40%,12rem)] md:aspect-auto md:h-48 md:w-full dark:bg-slate-800/80">
          {featured && (
            <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-md sm:text-xs">
              <span aria-hidden>⭐</span>
              {locale === "en" ? "Featured" : "Destacado"}
            </div>
          )}

          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={post.image?.alt || post.title}
                fill
                className="object-cover object-top transition-transform duration-300 group-hover:scale-105 md:group-hover:scale-110"
                sizes="(max-width: 768px) 42vw, (max-width: 1200px) 50vw, 33vw"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent md:from-black/45 md:via-transparent md:to-transparent"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
            </>
          ) : (
            <div className="flex h-full min-h-0 w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600">
              <svg
                className="h-12 w-12 text-slate-300 dark:text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
          )}

          {post.category && categoryLabel && (
            <div className="absolute bottom-0 left-0 right-0 z-10 p-2.5 pt-6 md:p-3 md:pt-10">
              <span className="inline-flex max-w-full items-center rounded-md border border-white/30 bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-800 shadow-sm backdrop-blur-[2px] dark:border-white/15 dark:bg-slate-950/85 dark:text-slate-100 sm:text-[11px]">
                <span className="truncate">{categoryLabel}</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between p-4 sm:p-5 md:p-6">
          <div className="min-w-0">
            <TitleTag className="mb-1.5 line-clamp-2 text-base font-bold leading-snug text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 sm:text-lg md:mb-2 md:text-xl">
              {post.title}
            </TitleTag>

            {post.excerpt && (
              <p className="line-clamp-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400 sm:text-sm md:mb-0">
                {post.excerpt}
              </p>
            )}
          </div>

          <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 pt-3 text-[11px] text-gray-600 dark:border-gray-700 dark:text-gray-400 sm:text-sm md:mt-4 md:pt-4">
            <time
              dateTime={post.publishedAt}
              className="flex min-w-0 items-center gap-1.5"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="truncate">
                {new Date(post.publishedAt).toLocaleDateString(locale, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </time>
            {post.readingTime && (
              <span className="flex shrink-0 items-center gap-1">
                <svg
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {post.readingTime} {locale === "en" ? "min" : "min"}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
