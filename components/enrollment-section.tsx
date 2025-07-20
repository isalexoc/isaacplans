/* components/enrollment-section.tsx */
import Image from "next/image";
import clsx from "clsx";
import { CheckCircle } from "lucide-react";
import ACAButton from "@/components/ACAButton";

interface EnrollmentSectionProps {
  title: React.ReactNode;
  intro: string;
  steps: [string, string];
  subHeading: string;
  bullets: string[];
  note?: string;
  imagePublicId: string;
  imagePosition?: "left" | "right";
  cta?: React.ReactNode;
}

export default function EnrollmentSection({
  title,
  intro,
  steps,
  subHeading,
  bullets,
  note,
  imagePublicId,
  imagePosition = "right",
  cta = <ACAButton />,
}: EnrollmentSectionProps) {
  const isLeft = imagePosition === "left";
  const imgUrl = `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_600,c_fill,g_auto/${imagePublicId}.png`;

  return (
    <section className="py-24 bg-white dark:bg-gray-950 px-4">
      <div
        className={clsx(
          "container mx-auto flex flex-col lg:flex-row items-center justify-center gap-16",
          { "lg:flex-row-reverse": isLeft } // flip when image should be on the left
        )}
      >
        {/* ─────────── text (≈ 2⁄3) ─────────── */}
        <div className="w-full lg:w-2/3 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            {title}
          </h2>

          <div className="h-1 w-24 bg-custom my-4" />

          <p className="text-gray-700 dark:text-gray-300 text-lg mb-6">
            {intro}
          </p>

          <ol className="list-decimal list-inside space-y-2 mb-8 text-gray-800 dark:text-gray-200">
            <li dangerouslySetInnerHTML={{ __html: steps[0] }} />
            <li dangerouslySetInnerHTML={{ __html: steps[1] }} />
          </ol>

          <p className="font-semibold mb-4 text-gray-900 dark:text-white">
            {subHeading}
          </p>
          <ul className="space-y-3 mb-6">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-custom mt-0.5" />
                <span className="text-gray-800 dark:text-gray-200">{item}</span>
              </li>
            ))}
          </ul>

          {note && (
            <p className="italic text-gray-700 dark:text-gray-300 mb-10">
              {note}
            </p>
          )}

          <div className="flex justify-center lg:justify-start">{cta}</div>
        </div>

        {/* ─────────── image (≈ 1⁄3) ─────────── */}
        <div className="w-full lg:w-1/3 flex justify-center">
          <div className="relative w-full max-w-sm aspect-[3/4]">
            <Image
              src={imgUrl}
              alt="Enrollment visual"
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="rounded-xl object-cover shadow-2xl"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
