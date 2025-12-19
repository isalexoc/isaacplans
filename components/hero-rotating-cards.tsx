"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import {
  BriefcaseMedical,
  Shield,
  Hospital,
  Users,
  TriangleAlert,
  Heart,
  type LucideIcon,
} from "lucide-react";

interface ServiceCard {
  key: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

const services: ServiceCard[] = [
  { key: "aca", icon: BriefcaseMedical, titleKey: "aca.title", descKey: "aca.desc" },
  { key: "dentalVision", icon: Shield, titleKey: "dentalVision.title", descKey: "dentalVision.desc" },
  { key: "hospitalIndemnity", icon: Hospital, titleKey: "hospitalIndemnity.title", descKey: "hospitalIndemnity.desc" },
  { key: "iul", icon: Users, titleKey: "iul.title", descKey: "iul.desc" },
  { key: "finalExpense", icon: TriangleAlert, titleKey: "finalExpense.title", descKey: "finalExpense.desc" },
  { key: "shortTermMedical", icon: Heart, titleKey: "shortTermMedical.title", descKey: "shortTermMedical.desc" },
];

interface FloatingCardProps {
  side: "left" | "right";
  top: string;
  delay: string;
}

export default function HeroRotatingCards({ side, top, delay }: FloatingCardProps) {
  const t = useTranslations("HomePage.hero.services");
  // Start at different indices for visual variety
  const startIndex = side === "left" ? 0 : Math.floor(services.length / 2);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Stagger the timing slightly between left and right cards
    const offset = side === "left" ? 0 : 2000;
    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        setIsAnimating(true);
        setIsVisible(false);
        
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % services.length);
          setIsVisible(true);
          
          setTimeout(() => {
            setIsAnimating(false);
          }, 300);
        }, 400); // Fade out duration
      }, 4500); // Total cycle time (4s visible + 0.5s transition)
    }, offset);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [side]);

  const currentService = services[currentIndex];
  const Icon = currentService.icon;

  const pos =
    side === "left"
      ? `hidden lg:block absolute -left-8 xl:-left-12 ${top} z-20`
      : `hidden lg:block absolute -right-8 xl:-right-12 ${top} z-20`;

  return (
    <div className={`${pos} ${delay}`}>
      <Card
        className={`p-5 bg-white/95 backdrop-blur-sm shadow-2xl hover:shadow-3xl 
                     border border-gray-100 w-56 xl:w-64
                     transition-all duration-500 ease-in-out hover:-translate-y-1 hover:scale-105
                     focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2
                     ${isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"}
                     ${isAnimating ? "pointer-events-none" : ""}`}
        style={{
          transitionProperty: "opacity, transform",
        }}
      >
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-gradient-to-br from-[hsl(var(--custom)/0.2)] to-[hsl(var(--custom)/0.1)] rounded-xl shrink-0">
            <Icon className="w-6 h-6 text-[hsl(var(--custom))]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm text-gray-900 mb-1.5">
              {t(currentService.titleKey)}
            </div>
            <div className="text-xs text-gray-600 leading-relaxed">
              {t(currentService.descKey)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
