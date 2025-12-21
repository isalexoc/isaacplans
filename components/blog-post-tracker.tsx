"use client";

import { useEffect } from "react";
import { trackViewContent } from "@/lib/facebook-pixel";

interface BlogPostTrackerProps {
  postTitle: string;
  postSlug: string;
  postCategory?: string;
}

/**
 * Client component to track ViewContent events on blog posts
 * Should be placed at the top of blog post page components
 */
export default function BlogPostTracker({
  postTitle,
  postSlug,
  postCategory,
}: BlogPostTrackerProps) {
  useEffect(() => {
    trackViewContent({
      contentName: postTitle,
      contentCategory: "Blog Post",
      contentIds: [postSlug],
    });
  }, [postTitle, postSlug, postCategory]);

  return null; // This component doesn't render anything
}
