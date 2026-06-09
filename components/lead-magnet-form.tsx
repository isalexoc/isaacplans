"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LeadMagnetFormProps {
  slug: string;
  category: string;
  leadFormSettings: {
    ctaHeadline: string;
    ctaSubtext: string;
    ctaButtonText: string;
    successMessage: string;
  };
}

export function LeadMagnetForm({ slug, leadFormSettings }: LeadMagnetFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const contactPhone = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/lead-magnets/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, slug }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setPdfUrl(data.data.pdfUrl);
      setSuccess(true);
      window.open(data.data.pdfUrl, "_blank");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (success && pdfUrl) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="flex justify-center">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900">{leadFormSettings.successMessage}</h3>
        <p className="text-gray-600">
          Your download should open automatically. If not,{" "}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            click here to download
          </a>
          .
        </p>
        {contactPhone && (
          <p className="text-gray-600 pt-2">
            While you wait, would you like a free consultation?{" "}
            <a href={`tel:${contactPhone}`} className="text-blue-600 hover:underline font-medium">
              Call us now
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="lm-name">Full name</Label>
        <Input
          id="lm-name"
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="lm-email">Email address</Label>
        <Input
          id="lm-email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="lm-phone">
          Phone number{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <Input
          id="lm-phone"
          type="tel"
          placeholder="Phone number (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-base font-semibold"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </span>
        ) : (
          leadFormSettings.ctaButtonText
        )}
      </Button>
      <p className="text-xs text-gray-500 text-center">
        We respect your privacy. No spam, ever. Unsubscribe anytime.
      </p>
    </form>
  );
}
