"use client";

import { motion, type Variants } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import {
  CheckCircle2,
  Phone,
  Mail,
  User,
  BadgeCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Optimized Cloudinary URL for Senior Life credential (ID card) */
const SENIOR_LIFE_CREDENTIAL_IMAGE =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1200/v1768940699/id_en_s5otc2.jpg";

/** Senior Life footer logo (gold, transparent) – used in slide footer */
const SENIOR_LIFE_LOGO_FOOTER =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_280/v1771380498/SLR_Web_Company_Home_LogoFooter_ymm9gb.webp";

/** Senior Life brand colors */
const SL = {
  blue: "#003366",
  blueLight: "#004080",
  blueBg: "bg-[#003366]",
  blueText: "text-[#003366]",
  gold: "#d4a84b",
  goldBg: "bg-amber-500",
  grayBg: "bg-gray-100",
  white: "bg-white",
};

interface SlideContentProps {
  slideKey: string;
}

/** Wraps slide content: premium stage background + company footer */
function SlideWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full min-h-0 flex flex-col">
      {/* Stage area: soft gradient and subtle radial glow for depth */}
      <div
        className="flex-1 min-h-0 rounded-t-2xl overflow-hidden"
        style={{
          background: "linear-gradient(165deg, #f0f4f8 0%, #e8eef5 25%, #fafbfd 60%, #f5f7fa 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,51,102,0.04)",
        }}
      >
        {children}
      </div>
      <motion.footer
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex-shrink-0 mt-4 rounded-b-xl overflow-hidden border-t-2 border-[#003366]/30 bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 shadow-[0_-4px_20px_rgba(0,51,102,0.15)]"
        style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.12), 0 1px 0 rgba(212,168,75,0.2)" }}
      >
        <div className="flex flex-row items-center justify-between gap-6 py-4 px-5 sm:px-6">
          <div className="flex items-center flex-shrink-0 min-w-0">
            <Image
              src={SENIOR_LIFE_LOGO_FOOTER}
              alt="Senior Life Insurance Company"
              width={320}
              height={90}
              className="object-contain object-left w-[240px] sm:w-[280px] md:w-[320px] h-[52px] sm:h-[64px] md:h-[72px]"
              sizes="(max-width: 640px) 240px, (max-width: 768px) 280px, 320px"
            />
          </div>
          <div className="flex flex-col items-end gap-1 text-right flex-shrink-0">
            <a
              href="tel:+18777778808"
              className="text-sm sm:text-base font-semibold text-white/95 hover:text-[#d4a84b] transition-colors whitespace-nowrap"
            >
              CUSTOMER SERVICE: 877-777-8808
            </a>
            <a
              href="https://seniorlifeinsurancecompany.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm text-white/80 hover:text-[#d4a84b] transition-colors"
            >
              seniorlifeinsurancecompany.com
            </a>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}

/* Presentation-grade entrance animations */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const itemScaleVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const itemSlideLeftVariants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const titleVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export default function FinalExpenseSlideContent({ slideKey }: SlideContentProps) {
  const t = useTranslations(`finalExpensePresentation.slides.${slideKey}`);
  const slideType = t("type") as string;

  if (slideType === "agent") return <SlideWrapper><AgentSlide t={t} /></SlideWrapper>;
  if (slideType === "cover") return <SlideWrapper><CoverSlide t={t} /></SlideWrapper>;
  if (slideType === "planificacion") return <SlideWrapper><PlanificacionSlide t={t} /></SlideWrapper>;
  if (slideType === "riesgo") return <SlideWrapper><RiesgoSlide t={t} /></SlideWrapper>;
  if (slideType === "company") return <SlideWrapper><CompanySlide t={t} /></SlideWrapper>;
  if (slideType === "definicion") return <SlideWrapper><DefinicionSlide t={t} /></SlideWrapper>;
  if (slideType === "preocupaciones") return <SlideWrapper><PreocupacionesSlide t={t} /></SlideWrapper>;
  if (slideType === "costosCremacion") return <SlideWrapper><CostosCremacionSlide t={t} /></SlideWrapper>;
  if (slideType === "costosTradicional") return <SlideWrapper><CostosTradicionalSlide t={t} /></SlideWrapper>;
  if (slideType === "riders") return <SlideWrapper><RidersSlide t={t} /></SlideWrapper>;
  if (slideType === "funeralCostsRising") return <SlideWrapper><FuneralCostsRisingSlide t={t} /></SlideWrapper>;
  if (slideType === "mejorProteccion") return <SlideWrapper><MejorProteccionSlide t={t} /></SlideWrapper>;
  if (slideType === "imagePlaceholder") return <SlideWrapper><ImagePlaceholderSlide t={t} /></SlideWrapper>;
  if (slideType === "discovery") return <SlideWrapper><DiscoverySlide t={t} /></SlideWrapper>;
  if (slideType === "preClose") return <SlideWrapper><PreCloseSlide t={t} /></SlideWrapper>;
  if (slideType === "quote") return <SlideWrapper><QuoteSlide t={t} /></SlideWrapper>;
  if (slideType === "valueProposition") return <SlideWrapper><ValuePropositionSlide t={t} /></SlideWrapper>;
  if (slideType === "keyBenefits") return <SlideWrapper><KeyBenefitsSlide t={t} /></SlideWrapper>;
  if (slideType === "pharmacy") return <SlideWrapper><PharmacySlide t={t} /></SlideWrapper>;
  if (slideType === "threeOptions") return <SlideWrapper><ThreeOptionsSlide t={t} /></SlideWrapper>;
  if (slideType === "funeralLaw") return <SlideWrapper><FuneralLawSlide t={t} /></SlideWrapper>;

  return null;
}

function AgentSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const contact = t.raw("contact") as { name?: string; phone?: string; email?: string; website?: string } | undefined;
  const credentialsList = t.raw("credentials.list") as string[] | undefined;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-7xl mx-auto px-6 py-6 md:px-12 md:py-10"
    >
      <motion.div variants={titleVariants} className="text-center mb-8">
        <h2 className={cn("text-4xl md:text-5xl font-bold mb-3 drop-shadow-sm", SL.blueText)}>{t("title")}</h2>
        <p className="text-xl md:text-2xl text-gray-600 font-semibold">{t("subtitle")}</p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <motion.div variants={itemVariants} className="space-y-6">
          <motion.div
            variants={itemScaleVariants}
            className={cn(
              "p-8 rounded-2xl border-2 border-[#003366]/25 bg-white/90 backdrop-blur-sm",
              "shadow-[0_8px_32px_rgba(0,51,102,0.12),0_2px_8px_rgba(0,0,0,0.06)]",
              "ring-1 ring-white/50"
            )}
          >
            <div className="flex items-center mb-6">
              <motion.div
                variants={itemScaleVariants}
                className="relative w-20 h-20 md:w-24 md:h-24 rounded-full mr-4 overflow-hidden border-4 shadow-xl flex-shrink-0 border-[#003366] ring-2 ring-[#d4a84b]/40"
              >
                <Image
                  src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_200,h_200,c_fill,g_face/isaacpic_c8kca5.png"
                  alt={contact?.name || "Isaac Orraiz"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 80px, 96px"
                />
              </motion.div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900">{contact?.name || "Isaac Orraiz"}</h3>
                <p className={cn("text-lg font-semibold")} style={{ color: SL.blue }}>{t("role")}</p>
              </div>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">{t("introduction")}</p>
            <div className="space-y-4">
              {contact?.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center text-gray-700 hover:opacity-80">
                  <Phone className="h-5 w-5 mr-3" style={{ color: SL.blue }} />
                  <span className="text-lg font-medium">{contact.phone}</span>
                </a>
              )}
              {contact?.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center text-gray-700 hover:opacity-80">
                  <Mail className="h-5 w-5 mr-3" style={{ color: SL.blue }} />
                  <span className="text-lg font-medium break-all">{contact.email}</span>
                </a>
              )}
              {contact?.website && (
                <span className="flex items-center text-gray-700">
                  <User className="h-5 w-5 mr-3" style={{ color: SL.blue }} />
                  <span className="text-lg font-medium">{contact.website}</span>
                </span>
              )}
            </div>
          </motion.div>
          <motion.div
            variants={itemVariants}
            className="bg-white p-6 rounded-xl border-l-4 border-amber-500 shadow-[0_6px_24px_rgba(0,51,102,0.08)]"
          >
            <div className="flex items-center mb-4">
              <BadgeCheck className="h-6 w-6 mr-2" style={{ color: SL.blue }} />
              <h4 className="text-xl font-bold text-gray-900">{t("credentials.title")}</h4>
            </div>
            <ul className="space-y-2">
              {(credentialsList || []).map((item: string, i: number) => (
                <motion.li
                  key={i}
                  variants={itemSlideLeftVariants}
                  className="flex items-start text-gray-700 gap-2"
                >
                  <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: SL.gold }} />
                  <span className="text-base">{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        <motion.div variants={itemScaleVariants} className="space-y-6">
          <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
            <div className="flex items-center mb-4">
              <BadgeCheck className="h-6 w-6 mr-2" style={{ color: SL.blue }} />
              <h4 className="text-xl font-bold text-gray-900">{t("credentialTitle")}</h4>
            </div>
            <div className="relative w-full aspect-[3/4] max-h-[560px] bg-gray-100 rounded-lg overflow-hidden">
              <Image
                src={SENIOR_LIFE_CREDENTIAL_IMAGE}
                alt={t("credentialAlt")}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/** Optimized Cloudinary URL for cover slide hero image */
const COVER_IMAGE_BASE =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1200/v1771370946/pexels-pixabay-302083_licqgt.jpg";

const COVER_WHY_PLAN: Record<string, string> = {
  en: "Why plan today?",
  es: "¿Por qué planificar hoy?",
};

function CoverSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const locale = useLocale();
  const items = (t.raw("items") as string[]) || [];
  const imageUrl = t("imageUrl") as string;
  const imageAlt = t("imageAlt") as string;
  const useImage = imageUrl && imageUrl.length > 0;
  const whyPlanRaw = t.raw("whyPlan");
  const whyPlanText =
    typeof whyPlanRaw === "string" && !whyPlanRaw.includes("finalExpensePresentation")
      ? whyPlanRaw
      : COVER_WHY_PLAN[locale] ?? COVER_WHY_PLAN.en;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-5xl mx-auto"
    >
      <motion.div
        variants={itemScaleVariants}
        className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,51,102,0.2),0_8px_24px_rgba(0,0,0,0.12)] border-2 border-[#003366]/25 bg-white ring-1 ring-black/5"
      >
        <div className="relative">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-2 w-full flex shrink-0 origin-left"
            style={{ background: `linear-gradient(90deg, ${SL.blue} 0%, ${SL.gold} 50%, ${SL.blue} 100%)` }}
          />
          <div className="relative aspect-[21/9] min-h-[200px] bg-[#003366] overflow-hidden">
            {useImage ? (
              <motion.div className="absolute inset-0" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.2, ease: "easeOut" }}>
                <Image
                  src={imageUrl}
                  alt={imageAlt || "Final Expense"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 1200px"
                  priority
                />
              </motion.div>
            ) : (
              <motion.div className="absolute inset-0" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.2, ease: "easeOut" }}>
                <Image
                  src={COVER_IMAGE_BASE}
                  alt={imageAlt || "Final Expense"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 1200px"
                  priority
                />
              </motion.div>
            )}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: "linear-gradient(to bottom, rgba(0,51,102,0.5) 0%, rgba(0,51,102,0.78) 100%)",
              }}
            >
              <motion.h2
                variants={titleVariants}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="text-4xl md:text-6xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] text-center px-4"
              >
                {t("title")}
              </motion.h2>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-10">
          <motion.p variants={itemVariants} className="text-center mb-6 text-lg font-medium" style={{ color: SL.blue }}>
            {whyPlanText}
          </motion.p>
          <ul className="space-y-3 max-w-xl mx-auto">
            {items.map((item: string, i: number) => (
              <motion.li
                key={i}
                variants={itemVariants}
                className="flex items-center gap-3 text-xl md:text-2xl font-medium text-gray-800"
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 + i * 0.08 }}
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                  style={{ backgroundColor: SL.gold }}
                >
                  {i + 1}
                </motion.span>
                <span style={{ color: SL.blue }}>{item}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.div>
    </motion.div>
  );
}

const PLANIFICACION_IMAGE_FALLBACK =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1200/v1771377550/pexels-marcus-aurelius-6787960_ttjhqv.jpg";

function PlanificacionSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const options = (t.raw("options") as { title: string; subtitle?: string }[]) || [];
  const imageUrl = (t.raw("imageUrl") as string) || PLANIFICACION_IMAGE_FALLBACK;
  const imageAlt = (t.raw("imageAlt") as string) || "Planning";

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-5xl mx-auto"
    >
      <motion.div
        variants={itemScaleVariants}
        className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,51,102,0.18)] border-2 border-[#003366]/25 bg-white"
      >
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-2 w-full flex shrink-0 origin-left"
          style={{ background: `linear-gradient(90deg, ${SL.blue} 0%, ${SL.gold} 50%, ${SL.blue} 100%)` }}
        />
        <div className="relative aspect-[21/9] min-h-[180px] bg-[#003366] overflow-hidden">
          <motion.div className="absolute inset-0" initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1, ease: "easeOut" }}>
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1200px"
            />
          </motion.div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
            style={{
              background: "linear-gradient(to bottom, rgba(0,51,102,0.6) 0%, rgba(0,51,102,0.85) 100%)",
            }}
          >
            <motion.h2 variants={titleVariants} className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg mb-1">
              {t("title")}
            </motion.h2>
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-white/95 font-medium">
              {t("subtitle")}
            </motion.p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="grid md:grid-cols-3 gap-5">
            {options.map((opt: { title: string; subtitle?: string }, i: number) => (
              <motion.div
                key={i}
                variants={itemScaleVariants}
                className="relative rounded-xl p-6 text-center border-2 overflow-hidden bg-white shadow-[0_8px_24px_rgba(0,51,102,0.1)] hover:shadow-[0_12px_32px_rgba(0,51,102,0.15)] transition-shadow duration-300"
                style={{ borderColor: SL.blue }}
              >
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                  className="absolute top-0 left-0 right-0 h-1.5 origin-left"
                  style={{ backgroundColor: SL.gold }}
                />
                <motion.span
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.15 + i * 0.08 }}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-lg mb-3 shadow-md"
                  style={{ backgroundColor: SL.blue }}
                >
                  {i + 1}
                </motion.span>
                <h3 className="text-xl font-bold mb-2" style={{ color: SL.blue }}>
                  {opt.title}
                </h3>
                {opt.subtitle && (
                  <p className="text-gray-600 text-sm md:text-base">{opt.subtitle}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

type PyramidCard = {
  id: string;
  title: string;
  bullets: string[];
  highlightBullets?: number[];
};

function RiesgoSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const pyramid = t.raw("pyramid") as {
    centerLabel?: string;
    cards?: PyramidCard[];
  } | undefined;
  const rows = (t.raw("rows") as { label: string; cols: string[] }[]) || [];
  const headers = (t.raw("headers") as string[]) || [];

  if (pyramid?.cards?.length === 3) {
    const centerLabel = pyramid.centerLabel || "RISK";
    const cards = pyramid.cards;
    const borderColors = [SL.blue, SL.gold, "#0d9488"] as const;

    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-5xl mx-auto flex flex-col min-h-0 flex-1 px-6 py-6 md:px-12 md:py-10"
      >
        <motion.h2
          variants={itemVariants}
          className={cn("text-xl md:text-2xl font-bold mb-3 text-center flex-shrink-0", SL.blueText)}
        >
          {t("title")}
        </motion.h2>

        <motion.div
          variants={itemVariants}
          className="relative flex-1 min-h-0 rounded-2xl overflow-auto py-6 px-4 md:py-8 md:px-8"
          style={{
            background: "linear-gradient(135deg, rgba(0,51,102,0.12) 0%, rgba(212,168,75,0.14) 50%, rgba(0,51,102,0.1) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 20px rgba(0,51,102,0.15)",
          }}
        >
          {/* Grid: top-left, top-right, center triangle, bottom – compact so everything fits */}
          <div className="grid grid-cols-[1fr_minmax(160px,240px)_1fr] grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 md:gap-6 p-4 md:p-6 items-center justify-items-center min-h-[320px] md:min-h-[340px]">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="col-start-2 row-start-2 flex items-center justify-center w-full max-w-[200px] md:max-w-[260px] aspect-square z-10"
              style={{
                clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                background: `linear-gradient(180deg, ${SL.blue} 0%, #002244 100%)`,
                boxShadow: `0 0 0 3px ${SL.gold}, 0 12px 32px rgba(0,51,102,0.5), 0 0 40px rgba(212,168,75,0.2)`,
              }}
            >
              <span
                className="text-white font-bold text-xl md:text-2xl uppercase tracking-widest drop-shadow-md"
                style={{ marginTop: "30%", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
              >
                {centerLabel}
              </span>
            </motion.div>

            <div className="col-start-1 row-start-1 justify-self-end self-end">
              <PyramidCard
                card={cards[0]}
                borderColor={borderColors[0]}
                variants={itemVariants}
              />
            </div>
            <div className="col-start-3 row-start-1 justify-self-start self-end">
              <PyramidCard
                card={cards[1]}
                borderColor={borderColors[1]}
                variants={itemVariants}
              />
            </div>
            <div className="col-start-1 col-span-3 row-start-3 justify-self-center self-start">
              <PyramidCard
                card={cards[2]}
                borderColor={borderColors[2]}
                variants={itemVariants}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-5xl mx-auto overflow-x-auto px-6 py-6 md:px-12 md:py-10">
      <motion.h2 variants={titleVariants} className={cn("text-2xl md:text-3xl font-bold mb-4 text-center", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <motion.div variants={itemScaleVariants} className="rounded-xl border-2 border-gray-300 overflow-hidden shadow-lg">
        <table className="w-full text-sm md:text-base">
          <thead>
            <tr className={cn("text-white", SL.blueBg)}>
              <th className="p-3 text-left font-semibold w-1/4">{t("rowLabel") || ""}</th>
              {headers.map((h, i) => (
                <th key={i} className="p-3 text-center font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                <td className="p-3 font-medium text-gray-800">{row.label}</td>
                {row.cols.map((c, j) => (
                  <td key={j} className="p-3 text-center text-gray-700">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </motion.div>
  );
}

function PyramidCard({
  card,
  borderColor,
  variants,
}: {
  card: PyramidCard;
  borderColor: string;
  variants: Variants;
}) {
  const highlight = new Set(card.highlightBullets ?? []);

  return (
    <motion.div
      variants={variants}
      className="rounded-2xl border-[3px] bg-white/95 backdrop-blur-sm px-4 py-3 shadow-xl max-w-[260px] md:max-w-[300px]"
      style={{
        borderColor,
        boxShadow: `0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)`,
      }}
    >
      <h3
        className="text-xs md:text-sm font-bold mb-2 leading-tight"
        style={{ color: borderColor }}
      >
        {card.title}
      </h3>
      <ul className="space-y-1 text-xs md:text-sm text-gray-800">
        {card.bullets.map((b, i) => (
          <li
            key={i}
            className={highlight.has(i) ? "font-semibold text-red-600" : ""}
          >
            {b}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function CompanySlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const bullets = (t.raw("bullets") as string[]) || [];
  const imageUrl = t("imageUrl") as string | undefined;
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-5xl mx-auto px-6 py-6 md:px-12 md:py-10">
      <motion.h2 variants={titleVariants} className={cn("text-4xl md:text-5xl font-bold mb-6 text-center", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <motion.ul className="space-y-4">
          {bullets.map((b: string, i: number) => (
            <motion.li
              key={i}
              variants={itemSlideLeftVariants}
              className="flex items-start gap-2 text-gray-700 text-lg md:text-xl"
            >
              <CheckCircle2 className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: SL.blue }} />
              <span>{b}</span>
            </motion.li>
          ))}
        </motion.ul>
        {imageUrl ? (
          <motion.div variants={itemScaleVariants} className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
            <Image src={imageUrl} alt={t("imageAlt")} fill className="object-contain" sizes="50vw" />
          </motion.div>
        ) : (
          <motion.div variants={itemScaleVariants} className="aspect-video rounded-xl bg-gray-200 flex items-center justify-center text-gray-500 text-lg">
            {t("imagePlaceholder")}
          </motion.div>
        )}
      </div>
      {t("customerService") && (
        <motion.p variants={itemVariants} className="mt-4 text-center text-gray-600 text-lg md:text-xl">
          {t("customerService")}
        </motion.p>
      )}
    </motion.div>
  );
}

function DefinicionSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const imageUrl = t("imageUrl") as string | undefined;
  const imageAlt = t("imageAlt") as string | undefined;
  const hasImage = imageUrl && imageUrl.length > 0;

  if (hasImage) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-5xl mx-auto flex flex-col min-h-0 flex-1"
      >
        <motion.div
          variants={itemScaleVariants}
          className="rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,51,102,0.15)] border-2 flex-1 min-h-0 flex flex-col"
          style={{ borderColor: `${SL.blue}40` }}
        >
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5 }}
            className="h-2 w-full flex-shrink-0 origin-left"
            style={{ background: `linear-gradient(90deg, ${SL.blue} 0%, ${SL.gold} 50%, ${SL.blue} 100%)` }}
          />
          <div className="flex-1 min-h-0 grid md:grid-cols-2 gap-6 p-6 md:p-8 items-center">
            <motion.div variants={itemScaleVariants} className="relative w-full aspect-[4/3] min-h-[200px] rounded-xl overflow-hidden bg-gray-100 order-2 md:order-1 shadow-lg">
              <Image
                src={imageUrl}
                alt={imageAlt || t("title")}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </motion.div>
            <div className="space-y-4 order-1 md:order-2">
              <motion.h2 variants={titleVariants} className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight" style={{ color: SL.blue }}>
                {t("title")}
              </motion.h2>
              <motion.p variants={itemVariants} className="text-xl md:text-2xl lg:text-3xl leading-relaxed font-medium" style={{ color: SL.blueLight }}>
                {t("body")}
              </motion.p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-3xl mx-auto text-center">
      <motion.h2 variants={titleVariants} className={cn("text-3xl md:text-4xl font-bold mb-6", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-xl text-gray-700 leading-relaxed">
        {t("body")}
      </motion.p>
    </motion.div>
  );
}

type PreocupacionesCategory = {
  label: string;
  items: string[];
  images?: { url: string; alt: string }[];
};

function PreocupacionesSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const questions = (t.raw("questions") as string[]) || [];
  const categories = (t.raw("categories") as PreocupacionesCategory[]) || [];
  const mainImageUrl = t("mainImageUrl") as string | undefined;
  const mainImageAlt = t("mainImageAlt") as string | undefined;
  const hasMainImage = mainImageUrl && mainImageUrl.length > 0;

  if (hasMainImage) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-5xl mx-auto flex flex-col min-h-0 flex-1"
      >
        <motion.div
          variants={itemScaleVariants}
          className="rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,51,102,0.12)] border-2 flex-1 min-h-0 flex flex-col"
          style={{ borderColor: `${SL.blue}40` }}
        >
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5 }}
            className="h-2 w-full flex-shrink-0 origin-left"
            style={{ background: `linear-gradient(90deg, ${SL.blue} 0%, ${SL.gold} 50%, ${SL.blue} 100%)` }}
          />
          <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6">
            <motion.div
              variants={itemScaleVariants}
              className="relative w-full aspect-[21/9] min-h-[140px] md:min-h-[180px] rounded-xl overflow-hidden bg-gray-100 mb-4 md:mb-6 shadow-md"
            >
              <Image
                src={mainImageUrl}
                alt={mainImageAlt || t("title")}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1200px"
              />
            </motion.div>
            {/* Title + questions */}
            <motion.h2 variants={titleVariants} className={cn("text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-center", SL.blueText)}>
              {t("title")}
            </motion.h2>
            <ul className="space-y-2 mb-4 md:mb-6">
              {questions.map((q: string, i: number) => (
                <motion.li key={i} variants={itemVariants} className="text-lg md:text-xl text-gray-700">
                  {q}
                </motion.li>
              ))}
            </ul>
            {/* Category cards with images */}
            <div className="grid md:grid-cols-3 gap-3 md:gap-4 flex-1 min-h-0">
              {categories.map((cat, i) => (
                <motion.div
                  key={i}
                  variants={itemScaleVariants}
                  className="rounded-xl p-4 md:p-5 border-2 flex flex-col min-h-0 bg-white/80 shadow-sm"
                  style={{ borderColor: `${SL.blue}30` }}
                >
                  <h4 className="font-bold text-lg md:text-xl mb-2 flex-shrink-0" style={{ color: SL.blue }}>
                    {cat.label}
                  </h4>
                  <ul className="text-base md:text-lg text-gray-600 space-y-1 mb-2 flex-shrink-0">
                    {(cat.items || []).map((item: string, j: number) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                  {cat.images && cat.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 mt-auto flex-1 min-h-0">
                      {cat.images.map((img, j) => (
                        <div
                          key={j}
                          className="relative aspect-square min-h-[60px] rounded-lg overflow-hidden bg-gray-100"
                        >
                          <Image
                            src={img.url}
                            alt={img.alt}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 25vw, 15vw"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
      </motion.div>
    </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-4xl mx-auto">
      <motion.h2 variants={itemVariants} className={cn("text-2xl md:text-3xl font-bold mb-6 text-center", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <ul className="space-y-2 mb-8">
        {questions.map((q: string, i: number) => (
          <motion.li key={i} variants={itemVariants} className="text-lg text-gray-700">
            {q}
          </motion.li>
        ))}
      </ul>
      <div className="grid md:grid-cols-3 gap-4">
        {categories.map((cat, i) => (
          <motion.div key={i} variants={itemVariants} className={cn("rounded-lg p-4 border-2", "border-[#003366]/20")}>
            <h4 className="font-bold text-gray-900 mb-2">{cat.label}</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {(cat.items || []).map((item: string, j: number) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
            {cat.images && cat.images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {cat.images.map((img, j) => (
                  <div key={j} className="relative aspect-square min-h-[80px] rounded-lg overflow-hidden bg-gray-100">
                    <Image src={img.url} alt={img.alt} fill className="object-cover" sizes="120px" />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function CostosCremacionSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const options = (t.raw("options") as { name: string; coverage: string; suggested: string }[]) || [];
  const services = (t.raw("services") as string[]) || [];
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-5xl mx-auto">
      <motion.h2 variants={itemVariants} className={cn("text-2xl md:text-3xl font-bold mb-4 text-center", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          {options.map((opt, i) => (
            <motion.div key={i} variants={itemVariants} className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
              <h4 className="font-bold text-gray-900">{opt.name}</h4>
              <p className="text-gray-600">{opt.coverage}</p>
              <p className="text-lg font-semibold" style={{ color: SL.blue }}>{opt.suggested}</p>
            </motion.div>
          ))}
        </div>
        <motion.div variants={itemVariants}>
          <h4 className="font-bold text-gray-900 mb-2">{t("servicesTitle")}</h4>
          <ul className="text-gray-700 space-y-1 text-sm">
            {services.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </motion.div>
      </div>
    </motion.div>
  );
}

function CostosTradicionalSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const options = (t.raw("options") as { name: string; coverage: string; suggested: string }[]) || [];
  const services = (t.raw("services") as string[]) || [];
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-5xl mx-auto">
      <motion.h2 variants={itemVariants} className={cn("text-2xl md:text-3xl font-bold mb-4 text-center", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          {options.map((opt, i) => (
            <motion.div key={i} variants={itemVariants} className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
              <h4 className="font-bold text-gray-900">{opt.name}</h4>
              <p className="text-gray-600">{opt.coverage}</p>
              <p className="text-lg font-semibold" style={{ color: SL.blue }}>{opt.suggested}</p>
            </motion.div>
          ))}
        </div>
        <motion.div variants={itemVariants}>
          <h4 className="font-bold text-gray-900 mb-2">{t("servicesTitle")}</h4>
          <ul className="text-gray-700 space-y-1 text-sm">
            {services.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </motion.div>
      </div>
    </motion.div>
  );
}

function RidersSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const riders = (t.raw("riders") as { title: string; description: string; example?: string; imageUrl?: string }[]) || [];
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-4xl mx-auto px-6 py-6 md:px-12 md:py-10">
      <motion.h2 variants={titleVariants} className={cn("text-3xl md:text-4xl font-bold mb-6 text-center", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <div className="space-y-6">
        {riders.map((r, i) => (
          <motion.div
            key={i}
            variants={itemSlideLeftVariants}
            className={cn(
              "rounded-xl border-2 border-[#003366]/25 bg-white overflow-hidden flex flex-col sm:flex-row shadow-[0_6px_24px_rgba(0,51,102,0.08)]",
              r.imageUrl ? "p-0" : "p-6"
            )}
          >
            {r.imageUrl && (
              <div className="relative w-full sm:w-48 md:w-56 flex-shrink-0 aspect-video sm:aspect-square bg-gray-100">
                <Image src={r.imageUrl} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 224px" />
              </div>
            )}
            <div className="p-6 flex-1 min-w-0">
              <h4 className="text-xl font-bold text-gray-900 mb-2">{r.title}</h4>
              <p className="text-gray-700">{r.description}</p>
              {r.example && <p className="mt-2 text-gray-600 text-sm">{r.example}</p>}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function FuneralCostsRisingSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const breakdown = (t.raw("breakdown") as { label: string; amount: string }[]) || [];
  const total = t("total");
  const imageUrl = t("imageUrl") as string | undefined;
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-5xl mx-auto">
      <motion.h2 variants={itemVariants} className={cn("text-2xl md:text-3xl font-bold mb-4 text-center", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-center text-gray-600 mb-6">
        {t("subtitle")}
      </motion.p>
      {imageUrl ? (
        <motion.div variants={itemVariants} className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 mb-6">
          <Image src={imageUrl} alt={t("imageAlt")} fill className="object-contain" sizes="100vw" />
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="aspect-video rounded-xl bg-gray-200 flex items-center justify-center text-gray-500 mb-6">
          {t("imagePlaceholder")}
        </motion.div>
      )}
      <motion.div variants={itemVariants} className="rounded-xl border-2 border-gray-200 overflow-hidden">
        {breakdown.map((row, i) => (
          <div key={i} className={cn("flex justify-between p-3", i % 2 === 0 ? "bg-gray-50" : "bg-white")}>
            <span className="text-gray-800">{row.label}</span>
            <span className="font-semibold">{row.amount}</span>
          </div>
        ))}
        <div className={cn("flex justify-between p-4 font-bold text-lg", SL.blueBg, "text-white")}>
          <span>{t("totalLabel")}</span>
          <span>{total}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

type MejorProteccionItem = string | { text: string; imageUrl: string };

function MejorProteccionSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const rawItems = (t.raw("items") as MejorProteccionItem[]) || [];
  const mainImageUrl = t("mainImageUrl") as string | undefined;
  const mainImageAlt = t("mainImageAlt") as string | undefined;
  const hasImages = rawItems.length > 0 && typeof rawItems[0] === "object" && "imageUrl" in rawItems[0];

  if (hasImages && mainImageUrl) {
    const items = rawItems as { text: string; imageUrl: string }[];
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-5xl mx-auto flex flex-col min-h-0">
        <motion.div variants={itemScaleVariants} className="relative w-full aspect-[21/9] rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 mb-4 shadow-lg">
          <Image
            src={mainImageUrl}
            alt={mainImageAlt || t("title")}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 900px"
          />
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center px-4" aria-hidden />
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white text-center drop-shadow-lg leading-tight"
            >
              {t("title")}
            </motion.h2>
          </div>
        </motion.div>
        <div className="flex flex-col gap-3 md:gap-4 overflow-auto min-h-0">
          {items.map((item: { text: string; imageUrl: string }, i: number) => (
            <motion.div
              key={i}
              variants={itemSlideLeftVariants}
              className="w-full rounded-xl border-2 border-[#003366]/15 overflow-hidden bg-white shadow-[0_4px_16px_rgba(0,51,102,0.06)] flex flex-row items-center gap-4 md:gap-6 flex-shrink-0"
            >
              <div className="relative w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 flex-shrink-0 bg-gray-100">
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 96px, (max-width: 1024px) 128px, 160px"
                />
              </div>
              <div className="flex-1 flex items-center gap-3 md:gap-4 py-3 md:py-4 pr-4 md:pr-6 min-h-0">
                <CheckCircle2 className="h-6 w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 flex-shrink-0" style={{ color: SL.blue }} />
                <span className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-medium text-gray-800">{item.text}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  const items = rawItems.map((it) => (typeof it === "string" ? it : it.text));
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-4xl mx-auto">
      <motion.h2 variants={itemVariants} className={cn("text-2xl md:text-3xl lg:text-4xl font-bold mb-6 text-center", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <ul className="space-y-3">
        {items.map((item: string, i: number) => (
          <motion.li key={i} variants={itemVariants} className="flex items-start gap-3 text-gray-800">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: SL.blue }} />
            <span className="text-lg md:text-xl font-medium">{item}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

function ImagePlaceholderSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const imageUrl = t("imageUrl") as string | undefined;
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-4xl mx-auto">
      {t("title") && (
        <motion.h2 variants={titleVariants} className={cn("text-2xl font-bold mb-4 text-center", SL.blueText)}>
          {t("title")}
        </motion.h2>
      )}
      {imageUrl ? (
        <motion.div variants={itemScaleVariants} className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 shadow-lg">
          <Image src={imageUrl} alt={t("imageAlt") || ""} fill className="object-contain" sizes="100vw" />
        </motion.div>
      ) : (
        <motion.div variants={itemScaleVariants} className="w-full aspect-video rounded-xl bg-gray-200 flex items-center justify-center text-gray-500">
          {t("imagePlaceholder")}
        </motion.div>
      )}
    </motion.div>
  );
}

function DiscoverySlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const bullets = [
    t("greeting"),
    t("confirmState"),
    t("confirmCity"),
    t("confirmZip"),
    t("whySought"),
    t("familyExperience"),
    t("ninetyPercent"),
    t("noOneBankrupt"),
    t("validateAccount"),
    t("binderReminder"),
  ].filter(Boolean);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-4xl mx-auto">
      <motion.h2 variants={itemVariants} className={cn("text-3xl md:text-4xl font-bold mb-2", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-xl text-gray-600 mb-8">
        {t("subtitle")}
      </motion.p>
      <ul className="space-y-4">
        {bullets.map((text, i) => (
          <motion.li key={i} variants={itemVariants} className="flex items-start gap-3 text-gray-700">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: SL.blue }} />
            <span>{text}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

function PreCloseSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-3xl mx-auto text-center">
      <motion.h2 variants={itemVariants} className={cn("text-3xl md:text-4xl font-bold mb-4", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-xl text-gray-600 mb-8">
        {t("subtitle")}
      </motion.p>
      <motion.div variants={itemVariants} className={cn("rounded-xl p-8 shadow-lg", SL.grayBg)}>
        <p className="text-lg md:text-xl font-semibold text-gray-800 mb-6">{t("question")}</p>
        <p className="text-gray-700 mb-2">{t("ifYes")}</p>
        <p className="text-gray-700">{t("ifNo")}</p>
      </motion.div>
    </motion.div>
  );
}

function QuoteSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-2xl mx-auto text-center">
      <motion.h2 variants={itemVariants} className={cn("text-3xl md:text-4xl font-bold mb-4", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-xl text-gray-600 mb-6">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-lg text-gray-700">
        {t("message")}
      </motion.p>
    </motion.div>
  );
}

function ValuePropositionSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-4xl mx-auto">
      <motion.h2 variants={itemVariants} className={cn("text-3xl md:text-4xl font-bold mb-2", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-xl text-gray-600 mb-6">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-lg text-gray-700 mb-4">
        {t("costRange")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-lg font-semibold text-gray-800 mb-6">
        {t("congratulations")}
      </motion.p>
      <motion.div variants={itemVariants} className={cn("rounded-xl p-6 shadow-md border-l-4 border-amber-500", SL.grayBg)}>
        <p className="text-lg text-gray-800">{t("storytelling")}</p>
      </motion.div>
    </motion.div>
  );
}

function KeyBenefitsSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const benefits = t.raw("benefits") as string[] | undefined;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-4xl mx-auto">
      <motion.h2 variants={itemVariants} className={cn("text-3xl md:text-4xl font-bold mb-2", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-xl text-gray-600 mb-4">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-lg font-semibold text-gray-800 mb-6">
        {t("companyLine")}
      </motion.p>
      <ul className="space-y-3 mb-8">
        {(benefits || []).map((b: string, i: number) => (
          <motion.li key={i} variants={itemVariants} className="flex items-start gap-2 text-gray-700">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: SL.blue }} />
            <span>{b}</span>
          </motion.li>
        ))}
      </ul>
      <motion.div variants={itemVariants} className={cn("rounded-xl p-6 shadow-md", SL.grayBg)}>
        <h4 className={cn("font-bold mb-2", SL.blueText)}>{t("rosaStoryTitle")}</h4>
        <p className="text-gray-700">{t("rosaStory")}</p>
      </motion.div>
    </motion.div>
  );
}

function PharmacySlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  const bullets = (t.raw("bullets") as string[] | undefined) ?? [];
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-6xl mx-auto space-y-6 px-6 py-6 md:px-12 md:py-10">
      <motion.div variants={titleVariants}>
        <h2 className={cn("text-3xl md:text-4xl font-bold mb-1", SL.blueText)}>{t("title")}</h2>
        <p className="text-xl text-gray-600">{t("subtitle")}</p>
      </motion.div>

      <motion.ul className="space-y-2">
        {bullets.map((bullet: string, i: number) => (
          <motion.li key={i} variants={itemSlideLeftVariants} className="flex items-start gap-2 text-lg text-gray-700">
            <CheckCircle2 className="h-6 w-6 mt-0.5 flex-shrink-0" style={{ color: SL.gold }} />
            <span>{bullet}</span>
          </motion.li>
        ))}
      </motion.ul>

      <motion.div variants={itemVariants} className="py-4">
        <p className="text-lg font-semibold text-gray-800 mb-4">{t("stepsTitle")}</p>
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex items-center gap-3 flex-1 min-w-[200px]"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg" style={{ backgroundColor: SL.blue }}>1</div>
            <p className="text-base font-medium text-gray-800">{t("step1Title")}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.35 }}
            className="flex-shrink-0 text-gray-400 hidden sm:block"
            aria-hidden
          >
            <svg width="32" height="24" viewBox="0 0 32 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 12h24M24 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
            className="flex items-center gap-3 flex-1 min-w-[200px]"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg" style={{ backgroundColor: SL.blue }}>2</div>
            <p className="text-base font-medium text-gray-800">{t("step2Title")}</p>
          </motion.div>
        </div>
      </motion.div>

      <motion.div variants={containerVariants} className="grid md:grid-cols-2 gap-6 md:gap-8">
        <motion.div variants={itemScaleVariants} className="relative rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.08)] bg-gray-50 border border-gray-200 min-h-[320px] md:min-h-[420px] flex items-center justify-center">
          <Image
            src={(t("imagePacketsUrl") as string) || "/images/senior-life-pharmacy-pouch.png"}
            alt={(t("imagePouchAlt") as string) || "Senior Life Pharmacy medication packets"}
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </motion.div>
        <motion.div variants={itemScaleVariants} className="relative rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.08)] bg-gray-50 border border-gray-200 min-h-[320px] md:min-h-[420px] flex items-center justify-center">
          <Image
            src={(t("imageBoxUrl") as string) || "/images/senior-life-pharmacy-box.png"}
            alt={(t("imageBoxAlt") as string) || "Senior Life Pharmacy medication box"}
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function ThreeOptionsSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-4xl mx-auto">
      <motion.h2 variants={itemVariants} className={cn("text-3xl md:text-4xl font-bold mb-2", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-xl text-gray-600 mb-6">
        {t("subtitle")}
      </motion.p>
      <motion.div variants={itemVariants} className="grid gap-4 mb-6">
        <div className={cn("rounded-lg p-4 border-2", "border-amber-600/30 bg-amber-50")}>
          <span className="font-bold text-gray-800">Bronze:</span> {t("bronze")}
        </div>
        <div className={cn("rounded-lg p-4 border-2", "border-gray-400 bg-gray-50")}>
          <span className="font-bold text-gray-800">Silver:</span> {t("silver")}
        </div>
        <div className={cn("rounded-lg p-4 border-2", "border-amber-500 bg-amber-50/50")}>
          <span className="font-bold text-gray-800">Gold:</span> {t("gold")}
        </div>
      </motion.div>
      <motion.p variants={itemVariants} className="text-gray-700 mb-4">
        {t("accidentalNote")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-lg font-semibold text-gray-800 mb-4">
        {t("twoDollars")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-gray-700 mb-4">
        {t("question")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-gray-700 mb-6">
        {t("howRemembered")}
      </motion.p>
      <motion.p variants={itemVariants} className={cn("text-xl font-bold rounded-lg p-4", SL.blueBg, "text-white text-center")}>
        {t("cta")}
      </motion.p>
    </motion.div>
  );
}

function FuneralLawSlide({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-4xl mx-auto">
      <motion.h2 variants={itemVariants} className={cn("text-3xl md:text-4xl font-bold mb-2", SL.blueText)}>
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-xl text-gray-600 mb-6">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-lg text-gray-700 mb-4">
        {t("reminder")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-lg text-gray-700 mb-4">
        {t("benefit")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-lg text-gray-700 mb-4">
        {t("law")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-lg font-semibold text-gray-800">
        {t("result")}
      </motion.p>
    </motion.div>
  );
}
