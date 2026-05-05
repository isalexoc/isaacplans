import Image from "next/image";
import clsx from "clsx";

type Testimonial = {
  name: string;
  text: string;
};

type HappyClient = {
  title: string;
  subtitle: string;
};

interface HeroWithTestimonialsProps {
  badge: string;
  name: string;
  title: string;
  description: string;
  imagePublicId: string;
  /** "left" = image left on desktop */
  imagePosition?: "left" | "right";
  /** Pass any JSX (button, link, etc.) */
  cta: React.ReactNode;
  /** Optional second control shown beside `cta` (e.g. anchor to an on-page section) */
  ctaSecondary?: React.ReactNode;
  testimonials?: Testimonial[];
  happyClient?: HappyClient;
}

const HeroWithTestimonialsGeneric: React.FC<HeroWithTestimonialsProps> = ({
  badge,
  name,
  title,
  description,
  imagePublicId,
  imagePosition = "right",
  cta,
  ctaSecondary,
  testimonials,
  happyClient,
}) => {
  const imageUrl = `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_800,c_fill,g_auto/${imagePublicId}.webp`;
  const isImageLeft = imagePosition === "left";

  return (
    <section
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-gray-50/30 to-white px-4 dark:bg-gradient-to-br dark:from-gray-950 dark:via-slate-900 dark:to-gray-950"
    >
      {/* Decorative background elements */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20 dark:opacity-[0.12]"
        aria-hidden="true"
      >
        <div className="absolute left-10 top-20 h-96 w-96 rounded-full bg-[hsl(var(--custom)/0.05)] blur-3xl dark:bg-[hsl(var(--custom)/0.12)]" />
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-[hsl(var(--custom)/0.05)] blur-3xl dark:bg-[hsl(var(--custom)/0.1)]" />
      </div>

      <div
        className={clsx(
          "container w-full mx-auto flex flex-col-reverse lg:flex-row items-center justify-center gap-8 lg:gap-16 py-12 lg:py-24 relative z-10",
          { "lg:flex-row-reverse": !isImageLeft }
        )}
      >
        {/* Text column */}
        <div className="text-center lg:text-left max-w-2xl flex-1 space-y-6 animate-fadeLeft">
          {name && (
            <div
              className="inline-flex items-center space-x-2 rounded-full border border-[hsl(var(--custom)/0.2)] bg-white/90 px-5 py-2.5 text-sm font-semibold text-[hsl(var(--custom))]
                         shadow-lg shadow-[hsl(var(--custom)/0.2)] backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-[hsl(var(--custom)/0.3)]
                         dark:border-[hsl(var(--custom)/0.38)] dark:bg-gray-950/90"
            >
              <span>{name}</span>
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-gray-900 dark:text-white">
            {badge && (
              <span className="block text-[hsl(var(--custom))] mb-2 text-2xl sm:text-3xl lg:text-5xl">
                {badge}
              </span>
            )}
            {/* Mobile image */}
            <div className="relative mx-auto my-6 block aspect-[4/3] w-full max-w-xl sm:max-w-2xl lg:hidden">
              <div className="-z-10 absolute inset-0 rounded-2xl bg-gradient-to-br from-[hsl(var(--custom)/0.2)] to-transparent opacity-50 blur-2xl dark:from-[hsl(var(--custom)/0.14)] dark:opacity-40" />
              <Image
                src={imageUrl}
                alt={title || "Hero Visual"}
                fill
                className="object-contain rounded-2xl"
                priority
                fetchPriority="high"
              />
            </div>
            <span className="block mt-2">{title}</span>
          </h1>

          <p className="text-lg lg:text-xl text-gray-700 dark:text-gray-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
            {description}
          </p>

          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
            {cta}
            {ctaSecondary}
          </div>
        </div>

        {/* Image + overlays */}
        <div className="relative hidden lg:block w-full max-w-3xl aspect-[4/3] flex-1 animate-fadeRight">
          {/* Decorative gradient behind image */}
          <div
            className="-z-10 absolute inset-0 scale-110 rounded-3xl bg-gradient-to-br from-[hsl(var(--custom)/0.2)] via-transparent to-[hsl(var(--custom)/0.1)] blur-3xl dark:from-[hsl(var(--custom)/0.12)] dark:to-[hsl(var(--custom)/0.06)] dark:opacity-90"
            aria-hidden="true"
          />

          <div className="relative h-full w-full">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[hsl(var(--custom)/0.3)] to-transparent opacity-50 blur-2xl dark:from-[hsl(var(--custom)/0.15)] dark:opacity-35" />
            <Image
              src={imageUrl}
              alt={title || "Hero Visual"}
              fill
              className="rounded-3xl border-4 border-white/50 object-contain shadow-2xl dark:border-gray-700/80"
              priority
              fetchPriority="high"
            />
          </div>

          {testimonials?.[0] && (
            <div
              className="absolute -top-12 left-8 w-[85%] max-w-sm rounded-xl border border-gray-200/60 bg-white/95 p-5 shadow-2xl backdrop-blur-sm
                         transition-all duration-300 hover:-translate-y-1 hover:shadow-3xl focus-within:ring-2 focus-within:ring-[hsl(var(--custom))]
                         focus-within:ring-offset-2 focus-within:ring-offset-background dark:border-gray-700/80 dark:bg-gray-950/95"
              role="article"
              aria-label={`Testimonial from ${testimonials[0].name}`}
            >
              <p className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-50">
                ⭐⭐⭐⭐⭐ {testimonials[0].name}
              </p>
              <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                {testimonials[0].text}
              </p>
            </div>
          )}

          {happyClient && (
            <div
              className="absolute bottom-8 right-8 rounded-xl border border-gray-200/60 bg-white/95 p-4 shadow-2xl backdrop-blur-sm
                         transition-all duration-300 hover:-translate-y-1 hover:shadow-3xl focus-within:ring-2 focus-within:ring-[hsl(var(--custom))]
                         focus-within:ring-offset-2 focus-within:ring-offset-background dark:border-gray-700/80 dark:bg-gray-950/95"
              role="region"
              aria-label="Client statistics"
            >
              <p className="text-sm font-bold text-gray-900 dark:text-gray-50">{happyClient.title}</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{happyClient.subtitle}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroWithTestimonialsGeneric;
