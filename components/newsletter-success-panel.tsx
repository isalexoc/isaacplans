"use client";

import { CheckCircle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

/** API statuses where the user must confirm via email */
export function newsletterNeedsEmailConfirmation(status: string | null): boolean {
  return (
    status === "pending" ||
    status === "resubscribed" ||
    status === "confirmation_resent"
  );
}

interface NewsletterSuccessPanelProps {
  isES: boolean;
  message: string;
  apiStatus: string | null;
  /** Visual density for different placements */
  variant?: "featured" | "default" | "compact" | "footer";
  /** Use on dark backgrounds (e.g. site footer) */
  tone?: "light" | "dark";
  className?: string;
}

export function NewsletterSuccessPanel({
  isES,
  message,
  apiStatus,
  variant = "default",
  tone = "light",
  className,
}: NewsletterSuccessPanelProps) {
  const needsConfirm = newsletterNeedsEmailConfirmation(apiStatus);
  const isDark = tone === "dark";

  const spamHint = isES
    ? "Si no ves el correo en unos minutos, revisa spam o promociones."
    : "If you don't see it within a few minutes, check spam or promotions.";

  const title = isES ? "¡Gracias!" : "Thank You!";

  if (needsConfirm) {
    const isFeatured = variant === "featured";
    const isFooter = variant === "footer";

    return (
      <div
        className={cn(
          "text-center",
          isFeatured && "space-y-6 py-4",
          variant === "default" && "space-y-5",
          variant === "compact" && "space-y-4",
          isFooter && "space-y-3 text-left",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div
          className={cn(
            "flex flex-col items-center",
            isFooter && "items-stretch"
          )}
        >
          <div className="relative mb-1">
            <div
              className={cn(
                "absolute inset-0 rounded-full animate-ping opacity-25",
                isDark ? "bg-white" : "bg-[hsl(var(--custom))]"
              )}
            />
            <div
              className={cn(
                "relative rounded-full flex items-center justify-center text-[hsl(var(--custom))]",
                isDark ? "bg-white/10" : "bg-[hsl(var(--custom)/0.15)]",
                isFeatured ? "p-5" : "p-4",
                isFooter && "p-3 self-center"
              )}
            >
              <Mail
                className={cn(isFeatured ? "w-10 h-10" : "w-8 h-8", isFooter && "w-7 h-7")}
                strokeWidth={2}
              />
            </div>
          </div>

          <h3
            className={cn(
              "font-bold tracking-tight",
              isDark ? "text-white" : "text-gray-900 dark:text-white",
              isFeatured && "text-3xl sm:text-4xl",
              variant === "default" && "text-2xl sm:text-3xl",
              variant === "compact" && "text-xl sm:text-2xl",
              isFooter && "text-lg font-semibold text-center"
            )}
          >
            {title}
          </h3>
        </div>

        <div
          className={cn(
            "rounded-2xl border-2 shadow-md text-left",
            !isDark &&
              "border-[hsl(var(--custom)/0.35)] bg-gradient-to-br from-[hsl(var(--custom)/0.12)] via-white to-amber-50/80 dark:from-[hsl(var(--custom)/0.2)] dark:via-gray-900/80 dark:to-gray-900/40 dark:border-[hsl(var(--custom)/0.45)]",
            isDark &&
              "border-gray-600 bg-gradient-to-br from-gray-800/90 via-gray-800/70 to-gray-900/80",
            isFeatured && "p-6 sm:p-8",
            variant === "default" && "p-6",
            variant === "compact" && "p-5",
            isFooter && "p-4 rounded-xl"
          )}
        >
          <p
            className={cn(
              "font-semibold leading-snug",
              isDark ? "text-white" : "text-gray-900 dark:text-gray-50",
              isFeatured && "text-xl sm:text-2xl",
              variant === "default" && "text-lg sm:text-xl",
              variant === "compact" && "text-base sm:text-lg",
              isFooter && "text-sm sm:text-base"
            )}
          >
            {message}
          </p>
          <p
            className={cn(
              "mt-3 leading-relaxed",
              isDark ? "text-gray-300" : "text-gray-600 dark:text-gray-400",
              isFeatured && "text-base",
              variant === "default" && "text-sm sm:text-base",
              variant === "compact" && "text-sm",
              isFooter && "text-xs sm:text-sm"
            )}
          >
            {spamHint}
          </p>
        </div>
      </div>
    );
  }

  /* Already subscribed or other success without double opt-in emphasis */
  const isCompactFooter = variant === "footer";

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center gap-3",
        isCompactFooter && "items-stretch text-left",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 justify-center">
        <div
          className={cn(
            "rounded-full p-2 shrink-0",
            isDark ? "bg-green-500/20" : "bg-green-100 dark:bg-green-900/40"
          )}
        >
          <CheckCircle
            className={cn(
              "w-6 h-6",
              isDark ? "text-green-400" : "text-green-600 dark:text-green-400"
            )}
          />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "font-bold text-lg",
              isDark ? "text-white" : "text-gray-900 dark:text-white"
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "mt-1",
              isDark ? "text-gray-300" : "text-gray-600 dark:text-gray-400",
              isCompactFooter ? "text-xs sm:text-sm" : "text-sm sm:text-base"
            )}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
