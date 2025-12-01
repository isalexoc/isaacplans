"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Mail, CheckCircle, AlertCircle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewsletterFooter() {
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const isES = locale === "es";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, source: "footer" }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setMessage(data.message);
        setEmail("");
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
    <div className="mt-6 pt-6 border-t border-gray-800">
      <h3 className="text-sm font-semibold text-white mb-3">
        {isES ? "Suscríbete a nuestro boletín" : "Subscribe to our newsletter"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isES ? "tu@correo.com" : "your@email.com"}
              required
              disabled={status === "loading"}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-gray-700 bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--custom))] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <Button
            type="submit"
            disabled={status === "loading" || !email.trim()}
            size="sm"
            className="bg-[hsl(var(--custom))] hover:bg-[hsl(var(--custom))/0.9] text-white px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "loading" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        {message && (
          <div
            className={`flex items-start gap-2 text-xs ${
              status === "error"
                ? "text-red-400"
                : "text-green-400"
            }`}
          >
            {status === "error" ? (
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            )}
            <p className="leading-tight">{message}</p>
          </div>
        )}
      </form>
    </div>
  );
}

