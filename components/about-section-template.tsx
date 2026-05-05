import Image from "next/image";
import clsx from "clsx";

interface AboutSectionProps {
  badge: string;
  headline: React.ReactNode;
  description: string;
  imagePublicId: string;
  /** "left" = image left on desktop */
  imagePosition?: "left" | "right";
  name: string;
  role: string;
  credential?: string;
  /** Pass any JSX (button, link, etc.) */
  cta: React.ReactNode;
}

const AboutSectionGeneric: React.FC<AboutSectionProps> = ({
  badge,
  headline,
  description,
  imagePublicId,
  imagePosition = "left",
  name,
  role,
  credential,
  cta,
}) => {
  const imgUrl = `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_500,h_500,c_fill,g_face/${imagePublicId}.png`;
  const isLeft = imagePosition === "left";

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--custom)/0.06)] via-white to-[hsl(var(--custom)/0.04)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24
                 dark:bg-gradient-to-br dark:from-gray-950 dark:via-slate-900 dark:to-gray-950"
    >
      {/* Decorative background elements */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25 dark:opacity-[0.14]"
        aria-hidden="true"
      >
        <div className="absolute left-10 top-20 h-96 w-96 rounded-full bg-[hsl(var(--custom)/0.08)] blur-3xl dark:bg-[hsl(var(--custom)/0.14)]" />
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-[hsl(var(--custom)/0.08)] blur-3xl dark:bg-[hsl(var(--custom)/0.11)]" />
      </div>

      <div
        className={clsx(
          "container mx-auto flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 relative z-10",
          { "lg:flex-row-reverse": !isLeft }
        )}
      >
        {/* ─── photo (≈ 1/3) ─── */}
        <div className="w-full lg:w-1/3 flex justify-center animate-fadeUp">
          <div className="relative group">
            {/* Decorative gradient behind image */}
            <div
              className="-z-10 absolute inset-0 rounded-full bg-gradient-to-br from-[hsl(var(--custom)/0.3)] to-transparent opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 dark:from-[hsl(var(--custom)/0.14)] dark:group-hover:opacity-70"
              aria-hidden="true"
            />
            <div className="relative w-60 h-60 sm:w-72 sm:h-72 lg:w-80 lg:h-80">
              <Image
                src={imgUrl}
                alt={name}
                fill
                sizes="(max-width: 1024px) 240px, 320px"
                className="rounded-full border-4 border-white/50 object-cover shadow-2xl transition-all duration-300 group-hover:shadow-3xl dark:border-gray-700/80"
                priority
                fetchPriority="high"
              />
            </div>
          </div>
        </div>

        {/* ─── text block (≈ 2/3) ─── */}
        <div className="w-full lg:w-2/3 max-w-2xl text-center lg:text-left animate-fadeUp" style={{ animationDelay: "0.1s" }}>
          {badge && (
            <div
              className="mb-4 inline-flex items-center rounded-full border border-[hsl(var(--custom)/0.2)] bg-white/90 px-5 py-2.5 text-sm font-semibold text-[hsl(var(--custom))]
                         shadow-lg shadow-[hsl(var(--custom)/0.2)] backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-[hsl(var(--custom)/0.3)]
                         dark:border-[hsl(var(--custom)/0.38)] dark:bg-gray-950/90"
            >
              <span>{badge}</span>
            </div>
          )}

          <h2 className="mt-4 font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-tight text-gray-900 dark:text-white">
            {headline}
          </h2>

          <div className="h-1.5 w-24 bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.6)] 
                          my-6 mx-auto lg:mx-0 rounded-full shadow-md shadow-[hsl(var(--custom)/0.3)]" />

          <p className="text-gray-700 dark:text-gray-300 text-lg lg:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0">
            {description}
          </p>

          <div className="mt-8 lg:mt-10 space-y-2">
            <p className="font-bold text-xl lg:text-2xl text-gray-900 dark:text-white">
              {name}
            </p>
            <p className="text-gray-700 dark:text-gray-300 text-base lg:text-lg">
              {role}
            </p>
          </div>

          <div className="mt-8 lg:mt-10 flex justify-center lg:justify-start">{cta}</div>
        </div>
      </div>
    </section>
  );
};

export default AboutSectionGeneric;
