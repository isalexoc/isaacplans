"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackHome } from "@/components/back-home";
import { Download, ArrowLeft, CheckCircle2, ArrowDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import GuideUnlockFormCustom from "@/components/guide-unlock-form-custom";
import type { Guide } from "@/components/guide-card";
import { trackDownload, trackLead } from "@/lib/facebook-pixel";

interface GuideDetailClientProps {
  guide: Guide & {
    pdfUrlEs?: string;
    content?: string;
    contentEs?: string;
  };
}

export default function GuideDetailClient({ guide }: GuideDetailClientProps) {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const t = useTranslations("guideDetailPage");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const title = isES && guide.titleEs ? guide.titleEs : guide.title;
  const description = isES && guide.descriptionEs ? guide.descriptionEs : guide.description;
  const content = isES && guide.contentEs ? guide.contentEs : guide.content || description;

  // Get locale-specific thumbnail
  const thumbnailId = isES && guide.thumbnailEs ? guide.thumbnailEs : guide.thumbnail;
  
  // Optimized Cloudinary URL for square images - using c_fit to show whole image
  const imageUrl = thumbnailId 
    ? `https://res.cloudinary.com/isaacdev/image/upload/w_800,h_800,c_fit,f_auto,q_auto/${thumbnailId}`
    : "https://res.cloudinary.com/isaacdev/image/upload/w_800,h_800,c_fit,f_auto,q_auto/placeholder-guide.jpg";

  // Check on mount if user has unlocked any guide
  useEffect(() => {
    const checkUserUnlocks = async () => {
      try {
        // Get stored user info from localStorage
        const storedEmail = localStorage.getItem('guide_user_email');
        const storedPhone = localStorage.getItem('guide_user_phone');
        
        if (storedEmail || storedPhone) {
          // First, check if this specific guide is unlocked
          const specificParams = new URLSearchParams({
            guideId: guide.id,
            ...(storedEmail && { email: storedEmail }),
            ...(storedPhone && { phone: storedPhone })
          });
          
          const specificResponse = await fetch(`/api/unlock-guide?${specificParams}`);
          if (specificResponse.ok) {
            const specificData = await specificResponse.json();
            if (specificData.unlocked) {
              setIsUnlocked(true);
              setIsChecking(false);
              return;
            }
          }

          // If specific guide not unlocked, check if they've unlocked ANY guide
          const anyParams = new URLSearchParams({
            any: 'true',
            ...(storedEmail && { email: storedEmail }),
            ...(storedPhone && { phone: storedPhone })
          });
          
          const anyResponse = await fetch(`/api/unlock-guide?${anyParams}`);
          if (anyResponse.ok) {
            const anyData = await anyResponse.json();
            if (anyData.hasUnlockedAny) {
              // User has unlocked guides before, show download button
              setIsUnlocked(true);
            }
          }
        }
      } catch (error) {
        console.error('Error checking user unlocks:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkUserUnlocks();
  }, [guide.id]);

  const handleFormSubmit = async (formData: any) => {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      // Store user info in localStorage for future visits
      localStorage.setItem('guide_user_email', formData.email);
      localStorage.setItem('guide_user_phone', formData.phone);

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
          guideId: guide.id, 
          email: formData.email, 
          phone: formData.phone,
          name: formData.firstName,
          lastName: formData.lastName,
          category: guide.category,
          guideName: formData.guideName,
          source: 'consumer_guides',
          campaign: 'guide_unlock'
        })
      });

      if (unlockResponse.ok) {
        setIsUnlocked(true);
        
        // Track Facebook Pixel events
        trackLead({
          contentName: formData.guideName || title,
          source: "consumer_guides",
        });
        trackDownload({
          contentName: formData.guideName || title,
          contentCategory: guide.category,
          source: "consumer_guides",
        });
        
        // Auto-download after 500ms
        setTimeout(() => downloadGuide(), 500);
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

  const downloadGuide = () => {
    // Get locale-specific PDF URL
    const pdfUrl = isES && guide.pdfUrlEs 
      ? guide.pdfUrlEs 
      : (guide.pdfUrl.startsWith('http') 
          ? guide.pdfUrl 
          : `https://res.cloudinary.com/isaacdev/image/upload/${guide.pdfUrl}`);
    
    // Track download event
    trackDownload({
      contentName: title,
      contentCategory: guide.category,
      source: "consumer_guides",
    });
    
    window.open(pdfUrl, '_blank');
  };

  // Show loading state while checking
  if (isChecking) {
    return (
      <main className="w-full flex flex-col overflow-x-hidden">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isES ? "Cargando..." : "Loading..."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full flex flex-col overflow-x-hidden relative">
      <BackHome />
      {/* Back Button */}
      <div className="container mx-auto px-4 max-w-5xl mt-2">
        <Link 
          href={`/${locale}/consumer-guides`}
          className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {isES ? "Volver a Guías" : "Back to Guides"}
        </Link>
      </div>

      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800 py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
                {title}
              </h1>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                {description}
              </p>
            </div>
            <div className="relative w-full aspect-square max-w-md mx-auto rounded-lg overflow-hidden shadow-lg">
              <Image
                src={imageUrl}
                alt={title}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-12 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {content}
            </p>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section className="py-12 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 max-w-3xl">
          <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-xl">
            <CardContent className="p-4 sm:p-6 md:p-8">
              {isUnlocked ? (
                <div className="text-center space-y-6">
                  <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isES ? "¡Guía Desbloqueada!" : "Guide Unlocked!"}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {isES 
                      ? "Su guía se está descargando. Si no se descarga automáticamente, haga clic en el botón de abajo."
                      : "Your guide is downloading. If it doesn't download automatically, click the button below."}
                  </p>
                  <Button 
                    onClick={downloadGuide}
                    className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 ring-2 ring-green-400 ring-opacity-50"
                    size="lg"
                  >
                    <Download className="w-5 h-5 mr-2 animate-bounce" />
                    {t("download.button")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {t("download.title")}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      {t("download.description")}
                    </p>
                  </div>
                  
                  {/* Arrow indicator */}
                  <div className="flex items-center justify-center py-4">
                    <div className="flex flex-col items-center">
                      <ArrowDown className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-bounce" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {isES ? "Complete el formulario a continuación" : "Fill out the form below"}
                      </p>
                    </div>
                  </div>
                  
                  {submitError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                    </div>
                  )}

                  {isSubmitting ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-4"></div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t("download.submitting")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <GuideUnlockFormCustom
                      category={guide.category}
                      guideName={title}
                      guideId={guide.id}
                      onSubmit={handleFormSubmit}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

