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
  testimonials,
  happyClient,
}) => {
  const imageUrl = `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_800,c_fill,g_auto/${imagePublicId}.webp`;
  const isImageLeft = imagePosition === "left";

  return (
    <section
      className="relative bg-gradient-to-br from-white via-gray-50/30 to-white dark:bg-gray-950 
                 min-h-screen flex items-center justify-center px-4 overflow-hidden"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-20 left-10 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
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
              className="inline-flex items-center space-x-2 bg-white/90 backdrop-blur-sm text-[hsl(var(--custom))] 
                         px-5 py-2.5 rounded-full text-sm font-semibold
                         shadow-lg shadow-[hsl(var(--custom)/0.2)] border border-[hsl(var(--custom)/0.2)]
                         hover:shadow-xl hover:shadow-[hsl(var(--custom)/0.3)] transition-all duration-300"
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
            <div className="block lg:hidden relative w-full max-w-xl sm:max-w-2xl mx-auto aspect-[4/3] my-6">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.2)] to-transparent rounded-2xl blur-2xl opacity-50 -z-10" />
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

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
            {cta}
          </div>
        </div>

        {/* Image + overlays */}
        <div className="relative hidden lg:block w-full max-w-3xl aspect-[4/3] flex-1 animate-fadeRight">
          {/* Decorative gradient behind image */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.2)] via-transparent to-[hsl(var(--custom)/0.1)] rounded-3xl blur-3xl -z-10 transform scale-110"
            aria-hidden="true"
          />

          <div className="relative w-full h-full">
            <div className="absolute -inset-4 bg-gradient-to-br from-[hsl(var(--custom)/0.3)] to-transparent rounded-3xl blur-2xl opacity-50" />
            <Image
              src={imageUrl}
              alt={title || "Hero Visual"}
              fill
              className="object-contain rounded-3xl shadow-2xl border-4 border-white/50"
              priority
              fetchPriority="high"
            />
          </div>

          {testimonials?.[0] && (
            <div
              className="absolute -top-12 left-8 bg-white/95 backdrop-blur-sm rounded-xl p-5 shadow-2xl 
                         border border-gray-200/60 w-[85%] max-w-sm
                         hover:shadow-3xl transition-all duration-300 hover:-translate-y-1
                         focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2"
              role="article"
              aria-label={`Testimonial from ${testimonials[0].name}`}
            >
              <p className="font-bold text-sm text-gray-900 mb-2">
                ⭐⭐⭐⭐⭐ {testimonials[0].name}
              </p>
              <p className="text-xs text-gray-700 leading-relaxed">
                {testimonials[0].text}
              </p>
            </div>
          )}

          {happyClient && (
            <div
              className="absolute bottom-8 right-8 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-2xl 
                         border border-gray-200/60
                         hover:shadow-3xl transition-all duration-300 hover:-translate-y-1
                         focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2"
              role="region"
              aria-label="Client statistics"
            >
              <p className="font-bold text-sm text-gray-900">{happyClient.title}</p>
              <p className="text-xs text-gray-600 mt-1">{happyClient.subtitle}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroWithTestimonialsGeneric;
