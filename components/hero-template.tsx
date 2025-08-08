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
    <section className="bg-white dark:bg-gray-950 min-h-screen flex items-center justify-center px-4">
      <div
        className={clsx(
          "container w-full mx-auto flex flex-col-reverse lg:flex-row items-center justify-center gap-12 py-12 lg:py-24",
          { "lg:flex-row-reverse": !isImageLeft }
        )}
      >
        {/* Text column */}
        <div className="text-center lg:text-left max-w-2xl flex-1">
          <span className="text-base lg:text-lg uppercase font-semibold tracking-wider text-blue-600 dark:text-blue-400">
            {name}
          </span>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold mt-4 leading-tight text-gray-900 dark:text-white">
            {badge}
            {/* Mobile image */}
            <div className="block lg:hidden relative w-full max-w-xl sm:max-w-2xl lg:max-w-3xl aspect-[4/3] flex-1">
              <Image
                src={imageUrl}
                alt="Hero Visual"
                fill
                className="object-contain"
                priority
              />
            </div>
            <br />
            <span className="text-blue-600 dark:text-blue-400">{title}</span>
          </h1>

          <p className="mt-6 text-lg lg:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
            {description}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            {cta}
          </div>
        </div>

        {/* Image + overlays */}
        <div className="relative hidden lg:block w-full max-w-3xl aspect-[4/3] flex-1">
          <Image
            src={imageUrl}
            alt="Hero Visual"
            fill
            className="object-contain"
            priority
          />

          {testimonials?.[0] && (
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-md w-[85%] max-w-sm">
              <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                ⭐⭐⭐⭐⭐ {testimonials[0].name}
              </p>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                {testimonials[0].text}
              </p>
            </div>
          )}

          {happyClient && (
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md text-sm text-gray-800 dark:text-gray-200">
              <p className="font-bold">{happyClient.title}</p>
              <p className="text-xs">{happyClient.subtitle}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroWithTestimonialsGeneric;
