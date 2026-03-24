import Link from "next/link";
import Image from "next/image";

export function BlogCategoryCard({
  href,
  label,
  description,
  postCount,
  imageUrl,
  locale,
}: {
  href: string;
  label: string;
  description: string;
  postCount: number;
  imageUrl: string | null;
  locale: string;
}) {
  const postsLabel =
    locale === "en"
      ? postCount === 1
        ? "post"
        : "posts"
      : postCount === 1
        ? "publicación"
        : "publicaciones";

  return (
    <Link href={href} className="group block h-full min-w-0">
      <article className="relative flex h-full min-h-[8.5rem] flex-row overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800 md:min-h-0 md:flex-col">
        <div className="relative aspect-[4/3] w-[min(42%,11rem)] shrink-0 overflow-hidden bg-slate-100 sm:w-[min(40%,12rem)] md:aspect-auto md:h-48 md:w-full dark:bg-slate-800/80">
          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={label}
                fill
                className="object-cover object-center transition-transform duration-300 group-hover:scale-105 md:group-hover:scale-110"
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 z-10 hidden p-2.5 pt-6 md:block md:p-3 md:pt-10">
            <span className="inline-flex max-w-full items-center rounded-md border border-white/30 bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-800 shadow-sm backdrop-blur-[2px] dark:border-white/15 dark:bg-slate-950/85 dark:text-slate-100 sm:text-[11px]">
              <span className="truncate">{label}</span>
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between p-4 sm:p-5 md:p-6">
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-snug text-gray-900 line-clamp-3 dark:text-white md:sr-only">
              {label}
            </h2>
            {description ? (
              <p className="mt-0 hidden text-sm leading-relaxed text-gray-600 dark:text-gray-400 md:mt-0 md:block md:line-clamp-3">
                {description}
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 pt-3 text-[11px] text-gray-600 dark:border-gray-700 dark:text-gray-400 sm:text-sm md:mt-4 md:pt-4">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <svg
                className="h-3.5 w-3.5 shrink-0 text-gray-400 sm:h-4 sm:w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
              <span>
                {postCount} {postsLabel}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 font-medium text-blue-600 transition-colors group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300">
              {locale === "en" ? "View" : "Ver"}
              <svg
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 sm:h-4 sm:w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
