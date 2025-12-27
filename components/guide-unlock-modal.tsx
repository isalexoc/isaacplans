"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import GuideUnlockFormCustom from "@/components/guide-unlock-form-custom";

type GuideCategory = 'aca' | 'shortTerm' | 'dentalVision' | 'hospitalIndemnity' | 'iul' | 'finalExpense';

interface GuideUnlockModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  guideId: string;
  category: GuideCategory;
  guideName: string;
  onUnlockSuccess?: (guideId: string, email?: string, phone?: string) => void;
}

export const GuideUnlockModal = ({ 
  open, 
  setOpen, 
  guideId, 
  category,
  guideName,
  onUnlockSuccess 
}: GuideUnlockModalProps) => {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFormSubmit = async (formData: any) => {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      // Submit to Agent CRM
      const agentCrmResponse = await fetch('/api/create-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          guideName: formData.guideName,
          leadMagnet: true
        })
      });

      if (!agentCrmResponse.ok) {
        const errorData = await agentCrmResponse.json();
        throw new Error(errorData.error || 'Failed to submit to Agent CRM');
      }

      // Unlock the guide
      const unlockResponse = await fetch('/api/unlock-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          guideId, 
          email: formData.email, 
          phone: formData.phone,
          name: formData.firstName,
          lastName: formData.lastName,
          category,
          guideName,
          source: 'consumer_guides',
          campaign: 'guide_unlock'
        })
      });

      if (unlockResponse.ok) {
        // Prepare user data for advanced matching
        const userData = {
          em: formData.email?.toLowerCase().trim(),
          fn: formData.firstName?.toLowerCase().trim(),
          ln: formData.lastName?.toLowerCase().trim(),
          ph: formData.phone?.replace(/\D/g, ""),
        };
        
        // Track Facebook Pixel events with user data
        const { trackLead, trackDownload, updateAdvancedMatching } = await import("@/lib/facebook-pixel");
        
        // Update advanced matching with user data
        updateAdvancedMatching(userData);
        
        trackLead({
          contentName: guideName,
          source: "consumer_guides",
        });
        trackDownload({
          contentName: guideName,
          contentCategory: category,
          source: "consumer_guides",
        });
        
        onUnlockSuccess?.(guideId, formData.email, formData.phone);
        setOpen(false);
      } else {
        throw new Error('Failed to unlock guide');
      }
    } catch (error) {
      console.error('Error:', error);
      setSubmitError(
        error instanceof Error 
          ? error.message 
          : (isES ? "Error al procesar. Por favor intente de nuevo." : "Error processing. Please try again.")
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        forceMount
        className="p-0 border-0 data-[state=open]:!animate-none data-[state=closed]:!animate-none"
      >
        <div className="w-[min(95vw,720px)] max-h-[90svh] overflow-hidden rounded-xl bg-background shadow-xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-background/95 backdrop-blur">
            <div className="font-semibold flex-1 text-center">
              {isES ? "Descargar Guía Gratuita" : "Download Free Guide"}
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
                  <p className="text-sm text-gray-700 dark:text-gray-300 text-center font-medium mb-2">
                    {isES 
                      ? "Complete el formulario a continuación con su información de contacto para descargar esta guía gratuita."
                      : "Please complete the form below with your contact information to download this free guide."}
                  </p>
                </div>
                {submitError && (
                  <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                  </div>
                )}
                <GuideUnlockFormCustom
                  category={category}
                  guideName={guideName}
                  guideId={guideId}
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

