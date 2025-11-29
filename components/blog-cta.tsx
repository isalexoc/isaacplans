"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { QuoteModalGeneral } from "@/components/form-modal-general";
import { Calendar } from "lucide-react";
import { useLocale } from "next-intl";
import { Link as I18nLink, useRouter } from "@/i18n/navigation";
import { BlogLeadMagnetModal } from "@/components/blog-lead-magnet-modal";

interface BlogCTAProps {
  ctaType: string;
  ctaText?: string;
  ctaLink?: string;
  position?: "top" | "middle" | "bottom" | "floating";
  leadMagnet?: {
    title?: string;
    description?: string;
    file?: any;
    type?: string;
    guideId?: string;
  };
  postTitle?: string;
  postSlug?: string;
  postCategory?: string;
}

export default function BlogCTA({
  ctaType,
  ctaText,
  ctaLink,
  position = "bottom",
  leadMagnet,
  postTitle = "",
  postSlug = "",
  postCategory,
}: BlogCTAProps) {
  const locale = useLocale();
  const router = useRouter();
  const [openModal, setOpenModal] = useState(false);
  const [openLeadMagnetModal, setOpenLeadMagnetModal] = useState(false);

  // Don't render if position is floating (will be handled separately)
  if (position === "floating") {
    return null;
  }

  const getCTAContent = () => {
    switch (ctaType) {
      case "quote":
        return {
          text: ctaText || (locale === "en" ? "Get Free Quote" : "Obtener Cotización Gratis"),
          action: () => setOpenModal(true),
          icon: "💬",
        };
      case "consultation":
        return {
          text:
            ctaText ||
            (locale === "en"
              ? "Schedule Consultation"
              : "Programar Consulta"),
          action: () => {
            window.location.href = `/${locale}/contact`;
          },
          icon: "📅",
        };
      case "guide":
        return {
          text:
            
            (locale === "en"
              ? "Download Free Guide"
              : "Descargar Guía Gratis"),
          action: () => {
            // If guideId is provided, redirect to consumer guide page using locale-aware routing
            if (leadMagnet?.guideId) {
              // Use the router for proper locale handling with dynamic params
              router.push({
                pathname: "/consumer-guides/[guideId]",
                params: { guideId: leadMagnet.guideId },
              } as any);
            }
            // Otherwise, show lead magnet modal if file exists
            else if (leadMagnet?.file?.asset?.url) {
              setOpenLeadMagnetModal(true);
            }
          },
          icon: "📥",
        };
      case "contact":
        return {
          text: ctaText || (locale === "en" ? "Contact Us" : "Contáctanos"),
          action: () => {
            window.location.href = `/${locale}/contact`;
          },
          icon: "✉️",
        };
      case "custom":
        return {
          text: ctaText || (locale === "en" ? "Learn More" : "Saber Más"),
          action: () => {
            if (ctaLink) {
              window.location.href = ctaLink.startsWith("/")
                ? `/${locale}${ctaLink}`
                : ctaLink;
            }
          },
          icon: "→",
        };
      default:
        return null;
    }
  };

  const ctaContent = getCTAContent();
  if (!ctaContent) return null;


  return (
    <>
      <div
        className={`my-8 p-6 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 ${
          position === "top" ? "mb-8" : position === "middle" ? "my-12" : "mt-8"
        }`}
      >
        {leadMagnet && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {leadMagnet.title}
            </h3>
            {leadMagnet.description && (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {leadMagnet.description}
              </p>
            )}
          </div>
        )}
        <Button
          size="lg"
          onClick={ctaContent.action}
          className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-lg"
        >
          <span className="mr-2">{ctaContent.icon}</span>
          {ctaContent.text}
        </Button>
      </div>
      {ctaType === "quote" && (
        <QuoteModalGeneral open={openModal} setOpen={setOpenModal} />
      )}
      {ctaType === "guide" && leadMagnet && leadMagnet.type !== "guide" && leadMagnet.file && (
        <BlogLeadMagnetModal
          open={openLeadMagnetModal}
          setOpen={setOpenLeadMagnetModal}
          leadMagnet={leadMagnet}
          postTitle={postTitle}
          postSlug={postSlug}
          postCategory={postCategory}
          onDownloadSuccess={(fileUrl) => {
            // Optional: Track successful download
            console.log("Download successful:", fileUrl);
          }}
        />
      )}
    </>
  );
}

