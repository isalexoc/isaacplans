"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

export interface Guide {
  id: string;
  category: 'aca' | 'shortTerm' | 'dentalVision' | 'hospitalIndemnity' | 'iul' | 'finalExpense';
  title: string;
  titleEs?: string;
  description: string;
  descriptionEs?: string;
  thumbnail: string; // Cloudinary public ID (for English)
  thumbnailEs?: string; // Cloudinary public ID (for Spanish)
  pdfUrl: string; // Cloudinary PDF public ID or URL (for English)
  pdfUrlEs?: string; // Cloudinary PDF public ID or URL (for Spanish)
}

interface GuideCardProps {
  guide: Guide;
}

export function GuideCard({ guide }: GuideCardProps) {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const t = useTranslations("consumerGuidesPage");

  const title = isES && guide.titleEs ? guide.titleEs : guide.title;
  const description = isES && guide.descriptionEs ? guide.descriptionEs : guide.description;

  // Get locale-specific thumbnail
  const thumbnailId = isES && guide.thumbnailEs ? guide.thumbnailEs : guide.thumbnail;
  
  // Optimized Cloudinary URL for square images - using c_fit to show whole image
  const imageUrl = thumbnailId 
    ? `https://res.cloudinary.com/isaacdev/image/upload/w_400,h_400,c_fit,f_auto,q_auto/${thumbnailId}`
    : "https://res.cloudinary.com/isaacdev/image/upload/w_400,h_400,c_fit,f_auto,q_auto/placeholder-guide.jpg";

  const guideUrl = `/${locale}/consumer-guides/${guide.id}`;

  return (
    <Card className="relative overflow-hidden border-2 hover:shadow-lg transition-all duration-300 group flex flex-col h-full border-gray-200 dark:border-gray-700">
      <CardHeader className="p-0 flex-shrink-0">
        <div className="relative w-full aspect-square rounded-t-lg overflow-hidden">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        </div>
        <div className="px-4 pt-4 flex-shrink-0">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="mt-2 line-clamp-2">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-grow flex flex-col justify-end">
        <Link href={guideUrl}>
          <Button 
            className="w-full" 
            size="lg"
            variant="default"
          >
            <Eye className="w-4 h-4 mr-2" />
            {t("card.viewGuide")}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

