/* components/about-section-generic.tsx */
"use client";

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
    <section className="py-24 bg-white dark:bg-gray-950 px-4">
      <div
        className={clsx(
          "container mx-auto flex flex-col lg:flex-row items-center justify-center gap-16",
          { "lg:flex-row-reverse": !isLeft }
        )}
      >
        {/* ─── photo (≈ 1/3) ─── */}
        <div className="w-full lg:w-1/3 flex justify-center">
          <div className="relative w-60 h-60 sm:w-72 sm:h-72 lg:w-80 lg:h-80">
            <Image
              src={imgUrl}
              alt={name}
              fill
              sizes="(max-width: 1024px) 240px, 320px"
              className="rounded-full object-cover shadow-2xl"
              priority
            />
          </div>
        </div>

        {/* ─── text block (≈ 2/3) ─── */}
        <div className="w-full lg:w-2/3 max-w-2xl text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-custom">
            {badge}
          </p>

          <h2 className="mt-3 font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-tight text-gray-900 dark:text-white">
            {headline}
          </h2>

          <div className="h-1 w-24 bg-custom my-4 mx-auto" />

          <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
            {description}
          </p>

          <div className="mt-8">
            <p className="font-bold text-lg text-gray-900 dark:text-white">
              {name}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              {role}
              {credential && (
                <>
                  <br />
                  NPN: {credential}
                </>
              )}
            </p>
          </div>

          <div className="mt-8 flex justify-center">{cta}</div>
        </div>
      </div>
    </section>
  );
};

export default AboutSectionGeneric;
