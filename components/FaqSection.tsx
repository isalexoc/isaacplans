import Image from "next/image";
import clsx from "clsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Faq = {
  question: string;
  answer: string;
};

interface FaqSectionProps {
  label?: string;
  title: React.ReactNode;
  faqs: Faq[];
  imagePublicId?: string;
  imagePosition?: "left" | "right";
}

export default function FaqSection({
  label,
  title,
  faqs,
  imagePublicId,
  imagePosition = "left",
}: FaqSectionProps) {
  const isLeft = imagePosition === "left";
  const imgUrl =
    imagePublicId &&
    `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_600,c_fill,g_face/${imagePublicId}.png`;

  return (
    <section className="py-24 px-4 bg-white dark:bg-gray-950">
      <div
        className={clsx(
          "container mx-auto flex flex-col lg:flex-row items-center gap-16",
          { "lg:flex-row-reverse": !isLeft }
        )}
      >
        {/* ▸ Image block */}
        {imgUrl && (
          <div className="w-full lg:w-1/2 flex justify-center relative">
            <div className="absolute inset-0 -translate-x-4 translate-y-4 rounded-xl border-4 border-dashed border-gray-300 dark:border-gray-700" />
            <Image
              src={imgUrl}
              alt="FAQ visual"
              width={500}
              height={500}
              className="relative rounded-xl shadow-xl object-cover w-full max-w-md"
              priority
            />
          </div>
        )}

        {/* ▸ FAQ block */}
        <div className="w-full lg:w-1/2 max-w-xl mx-auto">
          {label && (
            <p className="text-sm uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-4">
              {label}
            </p>
          )}

          {/* Headline + blue separator */}
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            {title}
          </h2>
          <div className="w-24 h-1 bg-blue-600 dark:bg-blue-400 mt-2 mb-8" />

          {/* Accordion (first item open by default) */}
          <Accordion
            type="single"
            collapsible
            defaultValue={faqs.length ? "item-0" : undefined}
            className="space-y-4"
          >
            {faqs.map((f, i) => (
              <AccordionItem key={f.question} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-lg font-semibold text-gray-900 dark:text-white">
                  {f.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {f.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
