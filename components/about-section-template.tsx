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
      className="relative py-16 lg:py-24 bg-gradient-to-br from-[hsl(var(--custom)/0.06)] via-white to-[hsl(var(--custom)/0.04)] 
                 dark:bg-gray-950 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-20 left-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
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
              className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.3)] to-transparent 
                         rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
              aria-hidden="true"
            />
            <div className="relative w-60 h-60 sm:w-72 sm:h-72 lg:w-80 lg:h-80">
              <Image
                src={imgUrl}
                alt={name}
                fill
                sizes="(max-width: 1024px) 240px, 320px"
                className="rounded-full object-cover shadow-2xl border-4 border-white/50
                           group-hover:shadow-3xl transition-all duration-300"
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
              className="inline-flex items-center bg-white/90 backdrop-blur-sm text-[hsl(var(--custom))] 
                         px-5 py-2.5 rounded-full text-sm font-semibold mb-4
                         shadow-lg shadow-[hsl(var(--custom)/0.2)] border border-[hsl(var(--custom)/0.2)]
                         hover:shadow-xl hover:shadow-[hsl(var(--custom)/0.3)] transition-all duration-300"
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
              {credential && (
                <>
                  <br />
                  <span className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
                    NPN: {credential}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="mt-8 lg:mt-10 flex justify-center lg:justify-start">{cta}</div>
        </div>
      </div>
    </section>
  );
};

export default AboutSectionGeneric;
