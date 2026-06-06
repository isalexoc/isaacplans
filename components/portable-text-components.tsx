import Image from "next/image";
import Link from "next/link";
import { urlFor } from "@/sanity/lib/image";
import type { PortableTextComponents } from "@portabletext/react";
import { Children, isValidElement, cloneElement } from "react";

export const portableTextComponents: PortableTextComponents = {
  types: {
    image: ({ value }) => {
      if (!value?.asset) return null;
      const imageUrl = urlFor(value)
        .width(840)
        .fit('max')
        .auto('format')
        .quality(85)
        .url();
      return (
        <figure className="my-10 flex flex-col items-center">
          <div className="max-w-[420px] w-full overflow-hidden rounded-2xl shadow-md ring-1 ring-gray-200 dark:ring-gray-700 transition-shadow hover:shadow-xl">
            <Image
              src={imageUrl}
              alt={value.alt || "Blog post image"}
              width={840}
              height={560}
              className="w-full h-auto block"
              sizes="(max-width: 640px) 90vw, 420px"
            />
          </div>
          {value.caption && (
            <figcaption className="mt-3 text-sm text-gray-500 dark:text-gray-400 text-center italic max-w-[420px] px-2">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
  block: {
    h1: ({ children }) => (
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-10 mb-4 leading-snug">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-3 leading-snug">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-2 leading-snug">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2 leading-snug">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-3 mb-1">
        {children}
      </h6>
    ),
    // Paragraphs
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-500 pl-6 py-4 my-8 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent rounded-r-lg italic text-gray-700 dark:text-gray-300 shadow-sm">
        {children}
      </blockquote>
    ),
    // Normal paragraph
    normal: ({ children }) => (
      <p className="mb-6 text-lg leading-relaxed text-gray-700 dark:text-gray-300">
        {children}
      </p>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-none space-y-2 my-5 pl-1">
        {children}
      </ul>
    ),
    number: ({ children }) => {
      const childrenArray = Children.toArray(children);
      return (
        <ol className="list-none space-y-2 my-5 pl-1">
          {childrenArray.map((child, index) => {
            if (isValidElement(child)) {
              return cloneElement(child, { index } as any);
            }
            return child;
          })}
        </ol>
      );
    },
  },
  listItem: {
    bullet: ({ children }) => (
      <li className="flex items-start gap-3">
        <span className="mt-2.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
        <span className="flex-1 text-lg leading-relaxed text-gray-700 dark:text-gray-300">
          {children}
        </span>
      </li>
    ),
    number: ({ children, index }: any) => (
      <li className="flex items-start gap-3">
        <span className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
          {(index ?? 0) + 1}
        </span>
        <span className="flex-1 text-lg leading-relaxed text-gray-700 dark:text-gray-300">
          {children}
        </span>
      </li>
    ),
  },
  marks: {
    // Links
    link: ({ value, children }) => {
      const target = (value?.href || "").startsWith("http")
        ? "_blank"
        : undefined;
      return (
        <Link
          href={value?.href || "#"}
          target={target}
          rel={target === "_blank" ? "noopener noreferrer" : undefined}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-medium transition-colors"
        >
          {children}
        </Link>
      );
    },
    // Strong/Bold
    strong: ({ children }) => (
      <strong className="font-bold text-gray-900 dark:text-white">
        {children}
      </strong>
    ),
    // Emphasis/Italic
    em: ({ children }) => (
      <em className="italic text-gray-700 dark:text-gray-300">{children}</em>
    ),
    // Code
    code: ({ children }) => (
      <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
        {children}
      </code>
    ),
  },
};

