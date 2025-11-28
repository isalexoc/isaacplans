"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { useUser, SignInButton } from "@clerk/nextjs";
import { Skeleton } from "@/components/ui/skeleton";

interface BlogSocialActionsProps {
  postId: string;
  postTitle: string;
  postSlug: string;
  postUrl: string;
  initialLikes?: number;
  initialComments?: number;
}

export function BlogSocialActions({
  postId,
  postTitle,
  postSlug,
  postUrl,
  initialLikes = 0,
  initialComments = 0,
}: BlogSocialActionsProps) {
  const locale = useLocale();
  const { user, isSignedIn } = useUser();
  // Initialize with current pathname immediately if available
  const [currentUrl, setCurrentUrl] = useState<string>(
    typeof window !== "undefined" ? window.location.pathname : "/"
  );
  const [likes, setLikes] = useState(initialLikes);
  const [comments, setComments] = useState(initialComments);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isLoadingLikes, setIsLoadingLikes] = useState(true);

  // Store current URL before authentication for redirect after sign-up (OAuth flow)
  useEffect(() => {
    if (typeof window !== "undefined" && !isSignedIn) {
      // Store the current URL before authentication starts (only if not already on home/sign-in/sign-up)
      const url = window.location.pathname;
      // Store if it's a content page (has locale prefix like /en/blog/... or /es/blog/...)
      // Don't store if it's root, sign-in, or sign-up pages
      if (url !== "/" && !url.startsWith("/sign-in") && !url.startsWith("/sign-up")) {
        localStorage.setItem("clerk_redirect_url", url);
      }
    }
  }, [isSignedIn]);

  // Handle redirect after authentication (especially for OAuth sign-ups)
  useEffect(() => {
    if (typeof window !== "undefined" && isSignedIn && !isLoadingLikes) {
      const storedUrl = localStorage.getItem("clerk_redirect_url");
      const currentPath = window.location.pathname;
      
      // If we're on home page (root) and have a stored URL from a content page, redirect there
      // This handles the case where OAuth sign-up redirects to home instead of the original page
      if (storedUrl && storedUrl !== currentPath) {
        // Only redirect if:
        // 1. We're on the root home page, OR
        // 2. We're on a sign-in/sign-up page
        if (currentPath === "/" || currentPath.startsWith("/sign-in") || currentPath.startsWith("/sign-up")) {
          localStorage.removeItem("clerk_redirect_url");
          // Use a small delay to ensure Clerk has finished processing
          setTimeout(() => {
            window.location.href = storedUrl;
          }, 100);
        }
      }
    }
  }, [isSignedIn, isLoadingLikes]);

  // Update URL if it changes (e.g., navigation)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.pathname);
      
      // Listen for navigation changes
      const handleLocationChange = () => {
        setCurrentUrl(window.location.pathname);
      };
      
      window.addEventListener('popstate', handleLocationChange);
      return () => window.removeEventListener('popstate', handleLocationChange);
    }
  }, []);

  // Load initial like state when component mounts
  useEffect(() => {
    if (postId) {
      fetch(`/api/blog/likes?postId=${postId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setLikes(data.count);
            setIsLiked(data.liked);
          }
        })
        .catch(error => {
          console.error("Error fetching likes:", error);
        })
        .finally(() => {
          setIsLoadingLikes(false);
        });
    } else {
      setIsLoadingLikes(false);
    }
  }, [postId, isSignedIn]);

  const handleLike = async () => {
    if (!isSignedIn) {
      // This should not be called when wrapped in SignInButton, but keeping as safety check
      return;
    }

    // Optimistic update - update UI immediately
    const previousLiked = isLiked;
    const previousCount = likes;
    
    setIsLiked(!isLiked);
    setLikes(prev => previousLiked ? prev - 1 : prev + 1);

    try {
      const response = await fetch("/api/blog/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          postSlug,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Update with server response (source of truth)
        setLikes(data.count);
        setIsLiked(data.liked);
      } else {
        // Rollback on error
        setIsLiked(previousLiked);
        setLikes(previousCount);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      // Rollback on error
      setIsLiked(previousLiked);
      setLikes(previousCount);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: postTitle,
          url: postUrl,
        });
      } catch (err) {
        // User cancelled or error occurred
        console.log("Share cancelled");
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(postUrl);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      } catch (err) {
        console.error("Failed to copy URL", err);
      }
    }
  };

  const handleSave = async () => {
    if (!isSignedIn) {
      // This should not be called when wrapped in SignInButton, but keeping as safety check
      setShowMenu(false);
      return;
    }

    try {
      const response = await fetch("/api/blog/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          postSlug,
          email: user?.primaryEmailAddress?.emailAddress,
          userId: user?.id,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setIsSaved(data.saved);
        setShowMenu(false);
      }
    } catch (error) {
      console.error("Error toggling save:", error);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.menu-container')) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  return (
    <>
      <div className="border-t border-b border-gray-200 dark:border-gray-700 py-4 my-8">
        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isSignedIn ? (
            <SignInButton 
              mode="modal" 
              forceRedirectUrl={currentUrl}
              signUpForceRedirectUrl={currentUrl}
              fallbackRedirectUrl={currentUrl}
              signUpFallbackRedirectUrl={currentUrl}
            >
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700`}
                aria-label={locale === "en" ? "Like this post" : "Me gusta esta publicación"}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                {isLoadingLikes ? (
                  <Skeleton className="h-4 w-3" />
                ) : (
                  <span className="text-sm font-medium">{likes}</span>
                )}
              </button>
            </SignInButton>
          ) : (
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                isLiked
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                  : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              aria-label={locale === "en" ? "Like this post" : "Me gusta esta publicación"}
            >
              <svg
                className="w-5 h-5"
                fill={isLiked ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {isLoadingLikes ? (
                <Skeleton className="h-4 w-3" />
              ) : (
                <span className="text-sm font-medium">{likes}</span>
              )}
            </button>
          )}

          {!isSignedIn ? (
            <SignInButton 
              mode="modal" 
              forceRedirectUrl={currentUrl}
              signUpForceRedirectUrl={currentUrl}
              fallbackRedirectUrl={currentUrl}
              signUpFallbackRedirectUrl={currentUrl}
            >
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                aria-label={locale === "en" ? "Comment on this post" : "Comentar en esta publicación"}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span className="text-sm font-medium">{comments}</span>
              </button>
            </SignInButton>
          ) : (
            <button
              onClick={() => {
                // TODO: Open comment form/modal when implemented
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label={locale === "en" ? "Comment on this post" : "Comentar en esta publicación"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="text-sm font-medium">{comments}</span>
            </button>
          )}

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label={locale === "en" ? "Share this post" : "Compartir esta publicación"}
          >
            <span className="text-sm font-medium">
              {locale === "en" ? "Share" : "Compartir"}
            </span>
          </button>

          <div className="relative menu-container">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label={locale === "en" ? "More options" : "Más opciones"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                {!isSignedIn ? (
                  <SignInButton 
              mode="modal" 
              forceRedirectUrl={currentUrl}
              signUpForceRedirectUrl={currentUrl}
              fallbackRedirectUrl={currentUrl}
              signUpFallbackRedirectUrl={currentUrl}
            >
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                        />
                      </svg>
                      <span>{locale === "en" ? "Save" : "Guardar"}</span>
                    </button>
                  </SignInButton>
                ) : (
                  <button
                    onClick={handleSave}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    <svg
                      className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`}
                      fill={isSaved ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                    <span>{isSaved 
                      ? (locale === "en" ? "Saved" : "Guardado")
                      : (locale === "en" ? "Save" : "Guardar")
                    }</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast notification for copied URL */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom-2">
          {locale === "en" ? "Link copied to clipboard!" : "¡Enlace copiado al portapapeles!"}
        </div>
      )}
    </>
  );
}

