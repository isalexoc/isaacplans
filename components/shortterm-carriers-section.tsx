/* components/StmCarriersSection.tsx */
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

type CarrierItem = {
  id: string;
  name: string;
  blurb: string;
  href: string; // locale-specific path or external URL
  logoPublicId?: string; // optional Cloudinary logo id
};

interface StmCarriersSectionProps {
  label?: string;
  title: string | React.ReactNode;
  subtitle?: string;
  /** Plain text, e.g. "View plans" (no variables) */
  ctaLabel: string;
  carriers: CarrierItem[];
}

export default function StmCarriersSection({
  label,
  title,
  subtitle,
  ctaLabel,
  carriers,
}: StmCarriersSectionProps) {
  const headingId = "stm-carriers-heading";

  const logoUrl = (publicId?: string) =>
    publicId
      ? `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_120/${publicId}.png`
      : null;

  return (
    <section
      className="relative py-16 lg:py-24 bg-gradient-to-br from-[hsl(var(--custom)/0.06)] via-white to-[hsl(var(--custom)/0.04)] 
                 dark:bg-gray-950 px-4 sm:px-6 lg:px-8 overflow-hidden"
      aria-labelledby={headingId}
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-20 left-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          {label && (
            <div
              className="inline-flex items-center bg-white/90 backdrop-blur-sm text-[hsl(var(--custom))] 
                         px-5 py-2.5 rounded-full text-sm font-semibold mb-6
                         shadow-lg shadow-[hsl(var(--custom)/0.2)] border border-[hsl(var(--custom)/0.2)]
                         hover:shadow-xl hover:shadow-[hsl(var(--custom)/0.3)] transition-all duration-300"
            >
              <span>{label}</span>
            </div>
          )}
          <h2
            id={headingId}
            className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-4 text-lg lg:text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Cards */}
        <ul
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          role="list"
          aria-label="Insurance carriers"
        >
          {carriers.map((c, idx) => {
            const logo = logoUrl(c.logoPublicId);
            const aria = `${ctaLabel} — ${c.name}`;
            const isExternal = c.href.startsWith("http");

            return (
              <li
                key={c.id}
                className="h-full animate-fadeUp"
                style={{ animationDelay: `${idx * 0.1}s` }}
                role="listitem"
              >
                <article
                  className="h-full relative rounded-2xl bg-white/95 backdrop-blur-sm dark:bg-gray-900/95 
                             border-2 border-gray-200/60 dark:border-gray-700/60 p-6 lg:p-8 shadow-lg 
                             flex flex-col hover:shadow-2xl hover:-translate-y-1 transition-all duration-300
                             focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2"
                >
                  {/* Decorative gradient accent */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(var(--custom))] via-[hsl(var(--custom)/0.6)] to-[hsl(var(--custom))] rounded-t-2xl"
                    aria-hidden="true"
                  />

                  {/* Logo + Name */}
                  <div className="flex items-center gap-3 mb-4">
                    {logo ? (
                      <div className="relative w-12 h-12 lg:w-14 lg:h-14 shrink-0 bg-gradient-to-br from-[hsl(var(--custom)/0.1)] to-[hsl(var(--custom)/0.05)] rounded-xl p-2 shadow-sm">
                        <Image
                          src={logo}
                          alt={`${c.name} logo`}
                          fill
                          sizes="(max-width: 1024px) 48px, 56px"
                          className="object-contain"
                          priority
                          fetchPriority="high"
                        />
                      </div>
                    ) : (
                      <div
                        aria-hidden="true"
                        className="w-12 h-12 lg:w-14 lg:h-14 shrink-0 rounded-xl bg-gradient-to-br from-[hsl(var(--custom)/0.15)] to-[hsl(var(--custom)/0.1)] 
                                   flex items-center justify-center text-gray-900 dark:text-white font-bold text-lg lg:text-xl shadow-sm"
                      >
                        {c.name.charAt(0)}
                      </div>
                    )}
                    <h3 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
                      {c.name}
                    </h3>
                  </div>

                  {/* Blurb */}
                  <p className="mt-2 text-sm lg:text-base text-gray-700 dark:text-gray-300 flex-1 leading-relaxed">
                    {c.blurb}
                  </p>

                  {/* CTA */}
                  <div className="mt-6">
                    <Button
                      asChild
                      className="w-full 
                                 bg-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.9)] 
                                 text-white font-semibold
                                 shadow-md hover:shadow-lg
                                 transition-all duration-300 hover:-translate-y-0.5
                                 focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                    >
                      <a
                        href={c.href}
                        aria-label={aria}
                        className="inline-flex items-center justify-center gap-2"
                        {...(isExternal && {
                          target: "_blank",
                          rel: "noopener noreferrer",
                        })}
                      >
                        {ctaLabel}
                        {isExternal && (
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        )}
                        <span className="sr-only"> — {c.name}</span>
                      </a>
                    </Button>
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
