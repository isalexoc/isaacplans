"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { Mail, AlertCircle, Loader2, Sparkles, TrendingUp, BookOpen, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackSubscribe, trackCompleteRegistration, updateAdvancedMatching } from "@/lib/facebook-pixel";
import { NewsletterSuccessPanel } from "@/components/newsletter-success-panel";

export default function HomeNewsletter() {
  const locale = useLocale();
  const t = useTranslations("HomePage.newsletter");
  const { resolvedTheme } = useTheme();
  const isES = locale === "es";
  const successTone = resolvedTheme === "dark" ? "dark" : "light";
  
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    setSubscriptionStatus(null);

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, source: "homepage" }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setMessage(data.message);
        setSubscriptionStatus(data.status ?? null);
        
        // Prepare user data for advanced matching
        const userData = email ? { em: email.toLowerCase().trim() } : undefined;
        
        // Update advanced matching with user data
        if (userData) {
          updateAdvancedMatching(userData);
        }
        
        // Track Facebook Pixel events
        if (data.status === "confirmed" || data.status === "already_confirmed") {
          // User is confirmed - track both Subscribe and CompleteRegistration
          trackSubscribe({
            contentName: "Newsletter Subscription",
            source: "homepage",
          });
          trackCompleteRegistration({
            contentName: "Newsletter Subscription",
            status: data.status,
            source: "homepage",
          });
        } else if (data.status === "pending") {
          // User submitted but needs to confirm - track Subscribe
          trackSubscribe({
            contentName: "Newsletter Subscription (Pending)",
            source: "homepage",
          });
        }
        
        if (data.status === "pending" || data.status === "resubscribed") {
          setEmail("");
        }
      } else {
        setStatus("error");
        setMessage(data.error || (isES ? "Algo salió mal" : "Something went wrong"));
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        isES
          ? "Error al procesar tu solicitud. Por favor intenta de nuevo."
          : "Error processing your request. Please try again."
      );
    }
  };

  const benefits = [
    { icon: TrendingUp, text: t("benefits.tips") },
    { icon: BookOpen, text: t("benefits.guides") },
    { icon: Shield, text: t("benefits.updates") },
  ];

  return (
    <section className="relative overflow-hidden py-16 lg:py-24">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.08)] via-[hsl(var(--custom)/0.04)] to-[hsl(var(--custom)/0.12)] dark:from-[hsl(var(--custom)/0.1)] dark:via-[hsl(var(--custom)/0.05)] dark:to-[hsl(var(--custom)/0.14)]" />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[hsl(var(--custom)/0.1)] rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-4xl">
          <Card className="overflow-hidden border border-gray-200/60 bg-white/95 shadow-2xl backdrop-blur-sm dark:border-gray-700/70 dark:bg-gray-950/95 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
            <div className="grid gap-0 lg:grid-cols-2">
              {/* Left side - Content */}
              <div className="flex flex-col justify-center bg-gradient-to-br from-[hsl(var(--custom)/0.05)] to-transparent p-8 dark:from-[hsl(var(--custom)/0.14)] dark:to-transparent lg:p-12">
                <div className="space-y-6">
                  {/* Icon */}
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--custom)/0.2)] to-[hsl(var(--custom)/0.1)] shadow-lg dark:from-[hsl(var(--custom)/0.25)] dark:to-[hsl(var(--custom)/0.08)]">
                    <Mail className="h-8 w-8 text-[hsl(var(--custom))]" />
                  </div>

                  {/* Heading */}
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold leading-tight text-gray-900 dark:text-gray-50 sm:text-4xl lg:text-5xl">
                      {t("title")}
                    </h2>
                    <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 lg:text-xl">
                      {t("description")}
                    </p>
                  </div>

                  {/* Benefits */}
                  <div className="space-y-4 pt-4">
                    {benefits.map((benefit, idx) => {
                      const Icon = benefit.icon;
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 text-gray-700 dark:text-gray-300"
                        >
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--custom)/0.1)] dark:bg-[hsl(var(--custom)/0.18)]">
                            <Icon className="h-5 w-5 text-[hsl(var(--custom))]" />
                          </div>
                          <span className="text-base font-medium">{benefit.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right side - Form with background image */}
              <div className="relative flex min-h-[400px] flex-col bg-gray-50 p-8 dark:bg-gray-950 lg:min-h-full lg:bg-white lg:bg-[url('https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_800/nl_kpg70b.png')] lg:bg-cover lg:bg-center lg:bg-no-repeat dark:lg:bg-gray-950">
                {/* Light / dark overlay over photo for readable form */}
                <div className="pointer-events-none hidden absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent dark:from-gray-950 dark:via-gray-950/92 dark:to-transparent lg:block" />
                
                {/* Form content with proper z-index */}
                <div className="relative z-10">
                  {status === "success" ? (
                    <div className="flex flex-col justify-center min-h-[280px] lg:min-h-[320px] py-4">
                      <NewsletterSuccessPanel
                        isES={isES}
                        message={message}
                        apiStatus={subscriptionStatus}
                        variant="featured"
                        tone={successTone}
                      />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
                          {isES ? "Suscríbete Ahora" : "Subscribe Now"}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t("privacy")}
                        </p>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label
                            htmlFor="newsletter-email"
                            className="sr-only"
                          >
                            {isES ? "Correo electrónico" : "Email Address"}
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" />
                            <input
                              type="email"
                              id="newsletter-email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder={isES ? "tu@correo.com" : "your@email.com"}
                              required
                              disabled={status === "loading"}
                              className="w-full rounded-lg border-2 border-gray-200 bg-white py-3.5 pl-12 pr-4 text-gray-900 shadow-sm placeholder:text-gray-500 transition-all focus:border-[hsl(var(--custom))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--custom))] disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900/90 dark:text-gray-100 dark:placeholder:text-gray-500"
                            />
                          </div>
                        </div>

                        <Button
                          type="submit"
                          disabled={status === "loading" || !email.trim()}
                          className="w-full bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.8)] hover:from-[hsl(var(--custom)/0.9)] hover:to-[hsl(var(--custom)/0.7)] text-white font-semibold py-3.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {status === "loading" ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              {isES ? "Procesando..." : "Processing..."}
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5 mr-2" />
                              {isES ? "Suscribirse Gratis" : "Subscribe Free"}
                            </>
                          )}
                        </Button>
                      </form>

                      {/* Error message */}
                      {status === "error" && message && (
                        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
                          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                          <p className="text-sm text-red-800 dark:text-red-200">{message}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
