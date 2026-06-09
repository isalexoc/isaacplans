"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { HeaderQuoteModalKind } from "@/lib/header-quote-modal";

type BlogModalContextType = {
  blogModalKind: HeaderQuoteModalKind | null;
  setBlogModalKind: (kind: HeaderQuoteModalKind | null) => void;
};

const BlogModalContext = createContext<BlogModalContextType>({
  blogModalKind: null,
  setBlogModalKind: () => {},
});

export function BlogModalProvider({ children }: { children: ReactNode }) {
  const [blogModalKind, setBlogModalKind] = useState<HeaderQuoteModalKind | null>(null);
  return (
    <BlogModalContext.Provider value={{ blogModalKind, setBlogModalKind }}>
      {children}
    </BlogModalContext.Provider>
  );
}

export function useBlogModalKind() {
  return useContext(BlogModalContext);
}
