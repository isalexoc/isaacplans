/* components/eligibility-section.tsx */
import Image from "next/image";
import clsx from "clsx";
import { CheckCircle } from "lucide-react";

interface EligibilitySectionProps {
  /** main headline (JSX allowed for bold spans / breaks) */
  title: React.ReactNode;
  /** short intro text before the list */
  intro: string;
  /** bullet list requirements */
  bullets: string[];
  /** note or paragraph after the list */
  note?: string;
  /** Cloudinary public ID for the photo */
  imagePublicId: string;
  /** “left” (default) or “right” */
  imagePosition?: "left" | "right";
}

export default function EligibilitySection({
  title,
  intro,
  bullets,
  note,
  imagePublicId,
  imagePosition = "left",
}: EligibilitySectionProps) {
  const isLeft = imagePosition === "left";
  const imgUrl = `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_600,c_fill,g_auto/${imagePublicId}.png`;

  return (
    <section className="py-20 bg-white dark:bg-gray-950 px-4">
      <div
        className={clsx(
          "container mx-auto flex flex-col lg:flex-row items-center justify-center gap-12",
          { "lg:flex-row-reverse": !isLeft }
        )}
      >
        {/* ───────── image (≈ 1/3) ───────── */}
        <div className="w-full lg:w-1/3 flex justify-center">
          <div className="relative w-full max-w-md aspect-[4/3]">
            <Image
              src={imgUrl}
              alt="Eligibility visual"
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="rounded-xl object-cover shadow-2xl"
              priority
            />
          </div>
        </div>

        {/* ───────── text (≈ 2/3) ───────── */}
        <div className="w-full lg:w-2/3 max-w-2xl">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            {title}
          </h2>

          {/* underline */}
          <div className="h-1 w-24 bg-custom my-4" />

          <p className="text-gray-700 dark:text-gray-300 text-lg mb-6">
            {intro}
          </p>

          <ul className="space-y-4 mb-6">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-custom flex-shrink-0 mt-0.5" />
                <span className="text-gray-800 dark:text-gray-200">{item}</span>
              </li>
            ))}
          </ul>

          {note && (
            <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">
              {note}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
