"use client";

import { useEffect } from "react";
import { useBlogModalKind } from "@/components/blog-modal-context";
import { getBlogCategoryModalKind } from "@/lib/header-quote-modal";

export function BlogModalOverride({ category }: { category: string }) {
  const { setBlogModalKind } = useBlogModalKind();

  useEffect(() => {
    setBlogModalKind(getBlogCategoryModalKind(category));
    return () => setBlogModalKind(null);
  }, [category, setBlogModalKind]);

  return null;
}
