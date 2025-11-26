"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import GuideUnlockFormCustom from "@/components/guide-unlock-form-custom";

interface BlogLeadMagnetModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  leadMagnet: {
    title?: string;
    description?: string;
    file?: any;
  };
  postTitle: string;
  postSlug: string;
  postCategory?: string;
  onDownloadSuccess?: (fileUrl: string) => void;
}

export const BlogLeadMagnetModal = ({
  open,
  setOpen,
  leadMagnet,
  postTitle,
  postSlug,
  postCategory,
  onDownloadSuccess,
}: BlogLeadMagnetModalProps) => {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFormSubmit = async (formData: any) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Store user info in localStorage for future visits
      localStorage.setItem("blog_user_email", formData.email);
      localStorage.setItem("blog_user_phone", formData.phone);

      // Submit to Agent CRM
      const agentCrmResponse = await fetch("/api/create-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          guideName: leadMagnet.title || postTitle,
          leadMagnet: true,
          source: "blog_post",
          campaign: `blog_${postSlug}`,
          postTitle,
          postCategory,
        }),
      });

      if (!agentCrmResponse.ok) {
        const errorData = await agentCrmResponse.json();
        throw new Error(errorData.error || "Failed to submit to Agent CRM");
      }

      // Track the download
      const analyticsResponse = await fetch("/api/guide-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guideId: `blog_${postSlug}`,
          eventType: "download",
          email: formData.email,
          phone: formData.phone,
          source: "blog_post",
          campaign: `blog_${postSlug}`,
          postTitle,
          postCategory,
        }),
      });

      // Download the file
      if (leadMagnet.file?.asset?.url) {
        // Trigger download
        const link = document.createElement("a");
        link.href = leadMagnet.file.asset.url;
        link.download = leadMagnet.file.asset.originalFilename || "download.pdf";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Call success callback
        onDownloadSuccess?.(leadMagnet.file.asset.url);
      }

      // Close modal after successful submission
      setTimeout(() => {
        setOpen(false);
      }, 500);
    } catch (error) {
      console.error("Error:", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : isES
          ? "Error al procesar. Por favor intente de nuevo."
          : "Error processing. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setSubmitError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  if (!leadMagnet.file?.asset?.url) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        forceMount
        className="p-0 border-0 data-[state=open]:!animate-none data-[state=closed]:!animate-none"
      >
        <div className="w-[min(95vw,720px)] max-h-[90svh] overflow-hidden rounded-xl bg-background shadow-xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur">
            <div className="font-semibold flex-1 text-center">
              {isES ? "Descargar Recurso Gratuito" : "Download Free Resource"}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={isES ? "Cerrar" : "Close"}
              className="rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring"
              disabled={isSubmitting}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="max-h-[calc(90svh-52px)] overflow-y-auto overflow-x-hidden scrollbar-none">
            {isSubmitting ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-4"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isES ? "Procesando..." : "Processing..."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 pt-4 pb-2 bg-blue-50 dark:bg-blue-900/10 border-b">
                  {leadMagnet.title && (
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">
                      {leadMagnet.title}
                    </h3>
                  )}
                  {leadMagnet.description && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 text-center mb-2">
                      {leadMagnet.description}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 dark:text-gray-300 text-center font-medium mb-2">
                    {isES
                      ? "Complete el formulario a continuación con su información de contacto para descargar este recurso gratuito."
                      : "Please complete the form below with your contact information to download this free resource."}
                  </p>
                </div>
                {submitError && (
                  <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {submitError}
                    </p>
                  </div>
                )}
                <GuideUnlockFormCustom
                  category={postCategory || "general"}
                  guideName={leadMagnet.title || postTitle}
                  guideId={`blog_${postSlug}`}
                  onSubmit={handleFormSubmit}
                />
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

