"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BlogNewsletter() {
  const locale = useLocale();
  const isES = locale === "es";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, source: "blog" }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setMessage(data.message);
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

  return (
    <div className="my-8 pt-8 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-md mx-auto text-center">
        <div className="flex items-center justify-center mb-3">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isES ? "Suscríbete a nuestro boletín" : "Subscribe to our newsletter"}
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {isES
            ? "Recibe consejos de seguros, guías y actualizaciones directamente en tu bandeja de entrada."
            : "Get insurance tips, guides, and updates delivered straight to your inbox."}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isES ? "Tu correo electrónico" : "Your email address"}
            required
            disabled={status === "loading"}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Button
            type="submit"
            disabled={status === "loading" || !email.trim()}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium px-6 py-2 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "loading" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              isES ? "Suscribirse" : "Subscribe"
            )}
          </Button>
        </form>
        
        {/* Status Messages */}
        {message && (
          <div
            className={`mt-3 flex items-start gap-2 p-3 rounded-lg text-sm ${
              status === "error"
                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
            }`}
          >
            {status === "error" ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            )}
            <p>{message}</p>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          {isES
            ? "Sin spam. Cancela tu suscripción en cualquier momento."
            : "No spam. Unsubscribe anytime."}
        </p>
      </div>
    </div>
  );
}

