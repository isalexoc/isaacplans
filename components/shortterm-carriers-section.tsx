import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";

export type CarrierItem = {
  id: string;
  name: string;
  blurb: string;
  /** Optional routing hints (shown under blurb). */
  bestFor?: string;
  notIdeal?: string;
  timeNote?: string;
  href: string;
  /** Full URL to hero / background image (e.g. Cloudinary). */
  heroSrc?: string;
  /** Full URL to logo (e.g. Cloudinary). Preferred over logoPublicId. */
  logoSrc?: string;
  /** Legacy: Cloudinary public id without extension (builds .png URL). */
  logoPublicId?: string;
};

/** Build a cropped hero URL from a Cloudinary public id (f_auto format, q_auto quality). */
export function stmCarrierHeroUrl(
  imagePublicId: string,
  width = 900,
  height = 320
): string {
  return `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_${width},h_${height},c_fill,g_auto/${imagePublicId}`;
}

interface ShortTermCarriersSectionProps {
  label?: string;
  title: string | React.ReactNode;
  subtitle?: string;
  ctaLabel: string;
  /** Shorter label for small screens (e.g. “View plans” vs “View plans & enroll”). */
  ctaLabelMobile?: string;
  carriers: CarrierItem[];
}

function buildLegacyLogoUrl(publicId?: string): string | null {
  if (!publicId) return null;
  return `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_320/${publicId}.png`;
}

function resolveLogoSrc(c: CarrierItem): string | null {
  if (c.logoSrc) return c.logoSrc;
  return buildLegacyLogoUrl(c.logoPublicId);
}

/** Renders carrier display name with finance/insurance-style hierarchy (no copy changes). */
function CarrierNameHeading({ name }: { name: string }) {
  const match = name.match(/^(.+?)\s*(\([^)]+\))\s*$/);
  const heading =
    "mt-2 text-balance text-left text-[1.0625rem] font-bold leading-snug tracking-[-0.03em] text-slate-900 sm:text-xl sm:leading-tight md:mt-0 md:text-center dark:text-white";
  const primary = "text-slate-900 dark:text-white";
  const secondary =
    "font-semibold text-slate-500 dark:text-slate-400 text-[0.9em] sm:text-[1.05rem]";

  if (match) {
    const [, main, paren] = match;
    return (
      <h3 className={heading}>
        <span className={primary}>{main.trim()}</span>
        <span className={secondary}> {paren}</span>
      </h3>
    );
  }

  return (
    <h3 className={heading}>
      <span className={primary}>{name}</span>
    </h3>
  );
}

export default function ShortTermCarriersSection({
  label,
  title,
  subtitle,
  ctaLabel,
  ctaLabelMobile,
  carriers,
}: ShortTermCarriersSectionProps) {
  const headingId = "stm-carriers-heading";

  return (
    <section
      id="stm-carriers"
      className="scroll-mt-20 relative overflow-hidden border-y border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-slate-50/90 py-16 dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:py-24 md:scroll-mt-24 lg:py-28"
      aria-labelledby={headingId}
    >
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-[hsl(var(--custom)/0.12)] blur-3xl dark:bg-[hsl(var(--custom)/0.08)]" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/5" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          {label && (
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--custom)/0.25)] bg-white/90 px-4 py-2 text-sm font-semibold text-[hsl(var(--custom))] shadow-sm backdrop-blur dark:bg-slate-900/90 dark:text-[hsl(var(--custom)/0.95)]">
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              <span>{label}</span>
            </div>
          )}
          <h2
            id={headingId}
            className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-[2.35rem] lg:leading-tight"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-4 text-pretty text-lg leading-relaxed text-slate-600 dark:text-slate-300 lg:text-xl">
              {subtitle}
            </p>
          )}
        </div>

        {/* Cards — 1 col until md (matches blog categories); horizontal row layout on small screens */}
        <ul
          className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 sm:mt-14 md:grid-cols-2 md:gap-7 lg:mt-16 lg:gap-8"
          role="list"
          aria-label="Insurance carriers"
        >
          {carriers.map((c, idx) => {
            const logo = resolveLogoSrc(c);
            const isExternal = c.href.startsWith("http");
            const ctaShort = ctaLabelMobile ?? ctaLabel;

            return (
              <li
                key={c.id}
                className="h-full animate-fadeUp"
                style={{ animationDelay: `${idx * 0.08}s` }}
              >
                <article className="group relative flex h-full min-h-[8.5rem] flex-row overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:border-[hsl(var(--custom)/0.35)] hover:shadow-[0_20px_40px_-12px_rgba(15,23,42,0.15)] focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2 dark:border-slate-700/90 dark:bg-slate-900/80 dark:ring-white/5 dark:hover:border-[hsl(var(--custom)/0.4)] md:min-h-0 md:flex-col">
                  {/* Hero: photo + overlay + logo upper-left (full-width strip from md+) */}
                  <div className="relative aspect-[4/3] w-[min(42%,11rem)] shrink-0 overflow-hidden bg-slate-100 sm:w-[min(40%,12rem)] md:aspect-auto md:h-[12.5rem] md:w-full dark:bg-slate-800/50">
                    {c.heroSrc ? (
                      <>
                        <Image
                          src={c.heroSrc}
                          alt=""
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          sizes="(max-width: 768px) 42vw, (max-width: 1200px) 50vw, 33vw"
                          priority={idx < 2}
                        />
                        {/* Scrim: bottom + left emphasis for logo zone */}
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/25"
                          aria-hidden
                        />
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/15 to-transparent"
                          aria-hidden
                        />
                      </>
                    ) : (
                      <div
                        className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.35)] via-slate-700/90 to-slate-900"
                        aria-hidden
                      />
                    )}

                    <div className="relative z-10 hidden h-full flex-col items-start justify-start p-3 sm:p-4 md:flex md:p-5">
                      {logo ? (
                        <div
                          className="inline-flex max-w-[min(100%,18rem)] items-center rounded-full border border-white/30 bg-white/95 px-3 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur-md dark:bg-white/92 sm:px-4 sm:py-2.5 md:px-5 md:py-3"
                        >
                          <Image
                            src={logo}
                            alt={`${c.name} logo`}
                            width={280}
                            height={96}
                            className="h-9 w-auto max-h-9 max-w-[min(100%,9.5rem)] object-contain object-left sm:h-10 sm:max-h-10 sm:max-w-[11rem] md:h-11 md:max-h-11 md:max-w-[min(100%,15.5rem)] lg:h-12 lg:max-h-12 lg:max-w-[17rem]"
                            sizes="(max-width: 768px) 160px, 280px"
                            priority={idx < 2}
                          />
                        </div>
                      ) : (
                        <div
                          aria-hidden
                          className="flex h-10 min-w-10 items-center justify-center rounded-full border border-white/30 bg-white/90 px-2.5 text-base font-bold text-slate-800 shadow-md md:h-12 md:min-w-12 md:px-3 md:text-lg"
                        >
                          {c.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5 md:px-6 md:pb-6 md:pt-5">
                    <div className="min-w-0 md:hidden">
                      {logo ? (
                        <div className="inline-flex max-w-full items-center rounded-full border border-slate-200/90 bg-white/95 px-2.5 py-1.5 shadow-sm ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-800/95">
                          <Image
                            src={logo}
                            alt=""
                            width={280}
                            height={96}
                            className="h-7 w-auto max-h-7 max-w-[min(100%,10rem)] object-contain object-left sm:h-8 sm:max-h-8 sm:max-w-[12rem]"
                            sizes="(max-width: 768px) 180px, 280px"
                          />
                        </div>
                      ) : (
                        <div
                          aria-hidden
                          className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-slate-200/90 bg-slate-100 px-2 text-sm font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                          {c.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    <CarrierNameHeading name={c.name} />
                    <p className="mt-2 flex-1 text-left text-sm leading-relaxed text-slate-600 line-clamp-4 dark:text-slate-400 md:mt-3 md:text-center md:line-clamp-none">
                      {c.blurb}
                    </p>
                    {(c.bestFor || c.notIdeal || c.timeNote) && (
                      <ul className="mt-3 space-y-1.5 text-left text-xs leading-snug text-slate-500 dark:text-slate-400 md:text-center">
                        {c.bestFor && <li>{c.bestFor}</li>}
                        {c.notIdeal && <li>{c.notIdeal}</li>}
                        {c.timeNote && <li className="text-slate-500">{c.timeNote}</li>}
                      </ul>
                    )}

                    <div className="mt-4 md:mt-6">
                      <Button
                        asChild
                        size="lg"
                        className="w-full gap-2 rounded-xl bg-[hsl(var(--custom))] font-semibold text-white shadow-md transition hover:bg-[hsl(var(--custom)/0.92)] hover:shadow-lg"
                      >
                        <a
                          href={c.href}
                          className="inline-flex items-center justify-center"
                          {...(isExternal && {
                            target: "_blank",
                            rel: "noopener noreferrer",
                          })}
                        >
                          <span className="sr-only">{c.name}: </span>
                          <span className="md:hidden">{ctaShort}</span>
                          <span className="hidden md:inline">{ctaLabel}</span>
                          {isExternal ? (
                            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                          ) : (
                            <ArrowRight
                              className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                              aria-hidden
                            />
                          )}
                        </a>
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
