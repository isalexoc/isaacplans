"use client";

import { SignInButton, UserButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

export function BlogUserAuth() {
  const locale = useLocale();
  const { user, isLoaded, isSignedIn } = useUser();
  // Initialize with current pathname immediately if available
  const [currentUrl, setCurrentUrl] = useState<string>(
    typeof window !== "undefined" ? window.location.pathname : "/"
  );

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
    if (typeof window !== "undefined" && isSignedIn && isLoaded) {
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
  }, [isSignedIn, isLoaded]);

  // Update URL if it changes (e.g., navigation)
  useEffect(() => {
    if (typeof window !== "undefined") {
      // window.location.pathname already includes the locale (e.g., "/en/blog/actual-slug")
      setCurrentUrl(window.location.pathname);
      
      // Listen for navigation changes
      const handleLocationChange = () => {
        setCurrentUrl(window.location.pathname);
      };
      
      window.addEventListener('popstate', handleLocationChange);
      return () => window.removeEventListener('popstate', handleLocationChange);
    }
  }, []);

  // Get user's display name
  const fullDisplayName = user?.fullName || 
                          (user?.firstName && user?.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user?.firstName || 
                              user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 
                              'User');
  
  // Truncate to 12 characters with ellipsis
  const displayName = fullDisplayName.length > 12 
    ? `${fullDisplayName.substring(0, 12)}...` 
    : fullDisplayName;

  return (
    <div className="flex items-center min-w-[120px] h-10">
      {/* @ts-ignore - SignedOut works correctly with React 19, TypeScript types need update */}
      <SignedOut>
        <SignInButton 
          mode="modal"
          forceRedirectUrl={currentUrl}
          signUpForceRedirectUrl={currentUrl}
          fallbackRedirectUrl={currentUrl}
          signUpFallbackRedirectUrl={currentUrl}
        >
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors h-10">
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-sm font-medium">
              {locale === "en" ? "Sign In" : "Iniciar Sesión"}
            </span>
          </button>
        </SignInButton>
      </SignedOut>
      {/* @ts-ignore - SignedIn works correctly with React 19, TypeScript types need update */}
      <SignedIn>
        {!isLoaded ? (
          // Skeleton loader to prevent layout shift
          <div className="flex items-center gap-3 h-10">
            <div className="flex flex-col items-end justify-center gap-1 w-28 h-10">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
          </div>
        ) : (
          <div className="flex items-center gap-3 h-10">
            <div className="flex flex-col items-end justify-center w-28 h-10">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap leading-tight">
                {locale === "en" ? "My Account" : "Mi Cuenta"}
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate w-full text-right leading-tight">
                {displayName}
              </span>
            </div>
            <div className="w-10 h-10 flex-shrink-0">
              <UserButton 
                afterSignOutUrl={currentUrl}
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10",
                  },
                }}
              />
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  );
}

