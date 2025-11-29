"use client";

import { useLocale } from "next-intl";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BlogNewsletter() {
  const locale = useLocale();
  const isES = locale === "es";

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
            ? "Recibe consejos de seguros y actualizaciones directamente en tu bandeja de entrada."
            : "Get insurance tips and updates delivered straight to your inbox."}
        </p>
        <form className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            placeholder={isES ? "Tu correo electrónico" : "Your email address"}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            disabled
          />
          <Button
            type="submit"
            disabled
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium px-6 py-2 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isES ? "Suscribirse" : "Subscribe"}
          </Button>
        </form>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          {isES
            ? "Sin spam. Cancela tu suscripción en cualquier momento."
            : "No spam. Unsubscribe anytime."}
        </p>
      </div>
    </div>
  );
}

