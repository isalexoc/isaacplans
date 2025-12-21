"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackSubscribe, trackCompleteRegistration, updateAdvancedMatching } from "@/lib/facebook-pixel";

interface NewsletterSubscriptionFormProps {
  locale: string;
  source?: string;
}

export function NewsletterSubscriptionForm({
  locale,
  source = "newsletter-page",
}: NewsletterSubscriptionFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [statusType, setStatusType] = useState<
    | "pending"
    | "already_subscribed"
    | "confirmation_resent"
    | "resubscribed"
    | "confirmed"
    | "already_confirmed"
    | "unsubscribed"
    | "already_unsubscribed"
    | null
  >(null);

  const isES = locale === "es";

  // Check URL params for status (from confirmation/unsubscribe redirects)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlStatus = params.get("status");
      if (urlStatus) {
        setStatusType(urlStatus as any);
        setStatus("success");
        if (urlStatus === "confirmed") {
          setMessage(
            isES
              ? "¡Suscripción confirmada! Revisa tu correo para el mensaje de bienvenida."
              : "Subscription confirmed! Check your email for a welcome message."
          );
        } else if (urlStatus === "already_confirmed") {
          setMessage(
            isES
              ? "Tu suscripción ya estaba confirmada."
              : "Your subscription was already confirmed."
          );
        } else if (urlStatus === "unsubscribed") {
          setMessage(
            isES
              ? "Has cancelado tu suscripción exitosamente."
              : "You've been unsubscribed successfully."
          );
        } else if (urlStatus === "already_unsubscribed") {
          setMessage(
            isES
              ? "Ya habías cancelado tu suscripción anteriormente."
              : "You were already unsubscribed."
          );
        }
      }
    }
  }, [isES]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, source }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setStatusType(data.status);
        setMessage(data.message);
        
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
            source: source,
          }, userData);
          trackCompleteRegistration({
            contentName: "Newsletter Subscription",
            status: data.status,
            source: source,
          });
        } else if (data.status === "pending") {
          // User submitted but needs to confirm - track Subscribe
          trackSubscribe({
            contentName: "Newsletter Subscription (Pending)",
            source: source,
          }, userData);
        }
        
        if (data.status === "pending" || data.status === "resubscribed") {
          setEmail(""); // Clear email on success
        }
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong");
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

  // Show confirmation success UI for confirmed/already_confirmed statuses
  if (statusType === "confirmed" || statusType === "already_confirmed") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 shadow-lg">
        <div className="text-center space-y-6">
          {/* Success Icon with Animation */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20"></div>
              <div className="relative bg-green-100 dark:bg-green-900/30 rounded-full p-6">
                <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          {/* Success Message */}
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {statusType === "confirmed"
                ? isES
                  ? "¡Suscripción Confirmada!"
                  : "Subscription Confirmed!"
                : isES
                ? "Ya Estás Suscrito"
                : "Already Subscribed"}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {message}
            </p>
          </div>

          {/* Additional Info */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isES
                ? "Revisa tu bandeja de entrada para recibir nuestras últimas actualizaciones."
                : "Check your inbox to receive our latest updates."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show unsubscribe confirmation UI
  if (statusType === "unsubscribed" || statusType === "already_unsubscribed") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 shadow-lg">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-6">
              <Mail className="w-16 h-16 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {isES ? "Suscripción Cancelada" : "Unsubscribed"}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show normal subscription form
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {isES ? "Correo electrónico" : "Email Address"}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                isES ? "tu@correo.com" : "your@email.com"
              }
              required
              disabled={status === "loading"}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={status === "loading" || !email.trim()}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {isES ? "Procesando..." : "Processing..."}
            </>
          ) : (
            <>
              <Mail className="w-5 h-5 mr-2" />
              {isES ? "Suscribirse" : "Subscribe"}
            </>
          )}
        </Button>

        {/* Status Messages */}
        {message && (
          <div
            className={`flex items-start gap-3 p-4 rounded-lg ${
              status === "error"
                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            }`}
          >
            {status === "error" ? (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            )}
            <p
              className={`text-sm ${
                status === "error"
                  ? "text-red-800 dark:text-red-200"
                  : "text-green-800 dark:text-green-200"
              }`}
            >
              {message}
            </p>
          </div>
        )}

        {/* Additional info for pending status */}
        {statusType === "pending" && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {isES
              ? "No olvides revisar tu carpeta de spam si no recibes el correo."
              : "Don't forget to check your spam folder if you don't receive the email."}
          </p>
        )}
      </form>
    </div>
  );
}

