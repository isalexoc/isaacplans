"use client";

import Image from "next/image";
import clsx from "clsx";
import ACAButton from "@/components/ACAButton";

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
  imagePosition?: "left" | "right";
  cta?: React.ReactNode;
  testimonials?: Testimonial[];
  happyClient?: HappyClient;
}

const HeroWithTestimonials: React.FC<HeroWithTestimonialsProps> = ({
  badge,
  name,
  title,
  description,
  imagePublicId,
  imagePosition = "right",
  cta = <ACAButton />,
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
          {
            "lg:flex-row-reverse": !isImageLeft,
          }
        )}
      >
        {/* Left - Text */}
        <div className="text-center lg:text-left max-w-2xl flex-1">
          <span className="text-base lg:text-lg uppercase font-semibold tracking-wider text-blue-600 dark:text-blue-400">
            {name}
          </span>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold mt-4 leading-tight text-gray-900 dark:text-white">
            {badge}
            <div className="block lg:hidden relative w-full max-w-xl sm:max-w-2xl lg:max-w-3xl aspect-[4/3] flex-1">
              <Image
                src={imageUrl}
                alt="Health Insurance Visual"
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

        {/* Right - Image with optional testimonials */}
        <div className="relative hidden lg:block w-full max-w-3xl aspect-[4/3] flex-1">
          <Image
            src={imageUrl}
            alt="Hero Visual"
            fill
            className="rounded-2xl object-contain ring-1 ring-black/5 dark:ring-white/10"
            priority
          />

          {testimonials?.[0] && (
            <div className="absolute left-4 top-4 w-[85%] max-w-sm rounded-lg border border-gray-200/60 bg-white/90 p-4 shadow-md backdrop-blur-sm dark:border-gray-700/80 dark:bg-gray-950/95">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-50">
                ⭐⭐⭐⭐⭐ {testimonials[0].name}
              </p>
              <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                {testimonials[0].text}
              </p>
            </div>
          )}

          {happyClient && (
            <div className="absolute bottom-4 right-4 rounded-lg border border-gray-200/60 bg-white/90 p-3 text-sm shadow-md backdrop-blur-sm dark:border-gray-700/80 dark:bg-gray-950/95">
              <p className="font-bold text-gray-800 dark:text-gray-50">{happyClient.title}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">{happyClient.subtitle}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroWithTestimonials;
