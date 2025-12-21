"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mail, CheckCircle, AlertCircle, Loader2, Sparkles, TrendingUp, BookOpen, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomeNewsletter() {
  const locale = useLocale();
  const t = useTranslations("HomePage.newsletter");
  const isES = locale === "es";
  
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

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
    <section className="relative py-16 lg:py-24 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.08)] via-[hsl(var(--custom)/0.04)] to-[hsl(var(--custom)/0.12)]" />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[hsl(var(--custom)/0.1)] rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/95 backdrop-blur-sm border border-gray-200/60 shadow-2xl overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-0">
              {/* Left side - Content */}
              <div className="p-8 lg:p-12 flex flex-col justify-center bg-gradient-to-br from-[hsl(var(--custom)/0.05)] to-transparent">
                <div className="space-y-6">
                  {/* Icon */}
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[hsl(var(--custom)/0.2)] to-[hsl(var(--custom)/0.1)] rounded-2xl shadow-lg">
                    <Mail className="w-8 h-8 text-[hsl(var(--custom))]" />
                  </div>

                  {/* Heading */}
                  <div className="space-y-3">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                      {t("title")}
                    </h2>
                    <p className="text-lg lg:text-xl text-gray-700 leading-relaxed">
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
                          className="flex items-center gap-3 text-gray-700"
                        >
                          <div className="flex-shrink-0 w-10 h-10 bg-[hsl(var(--custom)/0.1)] rounded-lg flex items-center justify-center">
                            <Icon className="w-5 h-5 text-[hsl(var(--custom))]" />
                          </div>
                          <span className="text-base font-medium">{benefit.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right side - Form with background image */}
              <div className="relative p-8 lg:p-12 bg-white lg:bg-[url('https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_800/nl_kpg70b.png')] bg-cover bg-center bg-no-repeat flex flex-col min-h-[400px] lg:min-h-full">
                {/* White gradient overlay from left to right - hidden on mobile */}
                <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent pointer-events-none" />
                
                {/* Form content with proper z-index */}
                <div className="relative z-10">
                  {status === "success" ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-8">
                      <div className="relative">
                        <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20" />
                        <div className="relative bg-green-100 rounded-full p-4">
                          <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-gray-900">
                          {isES ? "¡Gracias!" : "Thank You!"}
                        </h3>
                        <p className="text-gray-600">{message}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          {isES ? "Suscríbete Ahora" : "Subscribe Now"}
                        </h3>
                        <p className="text-gray-600 text-sm">
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
                            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="email"
                              id="newsletter-email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder={isES ? "tu@correo.com" : "your@email.com"}
                              required
                              disabled={status === "loading"}
                              className="w-full pl-12 pr-4 py-3.5 rounded-lg border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--custom))] focus:border-[hsl(var(--custom))] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
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
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-800">{message}</p>
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
