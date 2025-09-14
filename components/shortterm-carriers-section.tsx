/* components/StmCarriersSection.tsx */
import Image from "next/image";
import { Button } from "@/components/ui/button";

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
      className="py-20 bg-white dark:bg-gray-950 px-4"
      aria-labelledby={headingId}
    >
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10">
          {label && (
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-400">
              {label}
            </p>
          )}
          <h2
            id={headingId}
            className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-3 text-lg text-gray-700 dark:text-gray-300">
              {subtitle}
            </p>
          )}
        </div>

        {/* Cards */}
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {carriers.map((c) => {
            const logo = logoUrl(c.logoPublicId);
            const aria = `${ctaLabel} — ${c.name}`;

            return (
              <li key={c.id} className="h-full">
                <article className="h-full rounded-2xl border bg-card p-6 shadow-sm flex flex-col">
                  {/* Logo + Name */}
                  <div className="flex items-center gap-3">
                    {logo ? (
                      <div className="relative w-10 h-10 shrink-0">
                        <Image
                          src={logo}
                          alt={`${c.name} logo`}
                          fill
                          sizes="40px"
                          className="object-contain"
                          priority
                        />
                      </div>
                    ) : (
                      <div
                        aria-hidden="true"
                        className="w-10 h-10 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 font-semibold"
                      >
                        {c.name.charAt(0)}
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {c.name}
                    </h3>
                  </div>

                  {/* Blurb */}
                  <p className="mt-3 text-sm text-muted-foreground flex-1">
                    {c.blurb}
                  </p>

                  {/* CTA */}
                  <div className="mt-5">
                    <Button asChild className="w-full">
                      <a href={c.href} aria-label={aria}>
                        {ctaLabel}
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
