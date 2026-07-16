"use client";

import { motion } from "framer-motion";
import { useState, useRef } from "react";
import Image from "next/image";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Shield,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Lock,
  BarChart3,
  PiggyBank,
  Briefcase,
  Users,
  Heart,
  Award,
  Phone,
  Mail,
  MapPin,
  BadgeCheck,
  User,
  FileImage,
  FileText as FileTextIcon,
  HelpCircle,
  AlertCircle,
  XCircle,
  Target,
  TrendingDown,
  AlertTriangle,
  Zap,
  Ban,
  Hospital,
  ArrowDown,
  ArrowDownCircle,
  Skull,
  Clock,
  Banknote,
  Landmark,
  Receipt,
  Calculator,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createAccessor } from "@/lib/slide-accessor";
import type { IulSlideData } from "@/lib/iul-presentation";

interface SlideContentProps {
  slide: IulSlideData;
  labels: Record<string, string>;
  isAdmin?: boolean;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut" as const,
    },
  },
};

const highlightVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 15,
      delay: 0.5,
    },
  },
};

const stepVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 50 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 10,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, x: -50, scale: 0.9 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 12,
    },
  },
};

/**
 * Dark-mode remap wrapper for the IUL slide deck.
 *
 * The 30+ slide components below are authored for a light "slide" surface with
 * hardcoded light palettes (gray text, pale -50/-100 gradient cards, white cards).
 * Rather than thread `dark:` variants through every component, we remap those
 * utility classes for descendants when the deck is shown on a dark stage:
 *   - gray body/heading text  -> lighter grays
 *   - pale colored heading text (-600/-700/-800/-900) -> readable light tones
 *   - pale card backgrounds (bg-white, bg-gray-50/100, *-50/100 gradient stops) -> dark
 * Vivid -600 gradient banners (with white text) are intentionally left untouched —
 * they read well on a dark stage. This mirrors the final-expense presentation.
 */
function IULSlideThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        // gray text
        "dark:[&_.text-gray-900]:text-gray-50",
        "dark:[&_.text-gray-800]:text-gray-100",
        "dark:[&_.text-gray-700]:text-gray-300",
        "dark:[&_.text-gray-600]:text-gray-400",
        "dark:[&_.text-gray-500]:text-gray-400",
        "dark:[&_.text-gray-400]:text-gray-500",
        // colored heading / accent text -> readable on dark cards
        "dark:[&_.text-blue-900]:text-sky-200 dark:[&_.text-blue-800]:text-sky-300 dark:[&_.text-blue-700]:text-sky-300 dark:[&_.text-blue-600]:text-sky-400",
        "dark:[&_.text-green-900]:text-emerald-200 dark:[&_.text-green-800]:text-emerald-300 dark:[&_.text-green-700]:text-emerald-300 dark:[&_.text-green-600]:text-emerald-400",
        "dark:[&_.text-purple-700]:text-purple-300 dark:[&_.text-purple-600]:text-purple-400",
        "dark:[&_.text-orange-800]:text-amber-300 dark:[&_.text-orange-700]:text-amber-300 dark:[&_.text-orange-600]:text-amber-400",
        "dark:[&_.text-red-800]:text-red-400 dark:[&_.text-red-700]:text-red-400 dark:[&_.text-red-600]:text-red-400",
        // solid pale backgrounds -> dark cards
        "dark:[&_.bg-white]:bg-gray-900 dark:[&_.bg-gray-50]:bg-gray-800 dark:[&_.bg-gray-100]:bg-gray-800",
        // pale gradient "from" stops -> dark
        "dark:[&_.from-blue-50]:from-gray-900 dark:[&_.from-green-50]:from-gray-900 dark:[&_.from-purple-50]:from-gray-900 dark:[&_.from-orange-50]:from-gray-900 dark:[&_.from-red-50]:from-gray-900 dark:[&_.from-gray-50]:from-gray-900",
        "dark:[&_.from-green-100]:from-gray-900 dark:[&_.from-purple-100]:from-gray-900",
        // pale gradient "via" stops -> dark
        "dark:[&_.via-emerald-50]:via-gray-900 dark:[&_.via-purple-50]:via-gray-900 dark:[&_.via-amber-50]:via-gray-900 dark:[&_.via-emerald-100]:via-gray-900",
        // pale gradient "to" stops -> dark
        "dark:[&_.to-emerald-50]:to-slate-900 dark:[&_.to-cyan-50]:to-slate-900 dark:[&_.to-pink-50]:to-slate-900 dark:[&_.to-rose-50]:to-slate-900 dark:[&_.to-amber-50]:to-slate-900 dark:[&_.to-teal-50]:to-slate-900 dark:[&_.to-blue-50]:to-slate-900",
        "dark:[&_.to-teal-100]:to-slate-900 dark:[&_.to-blue-100]:to-slate-900 dark:[&_.to-gray-100]:to-slate-900",
        // pale borders -> subtle dark
        "dark:[&_.border-gray-200]:border-gray-700 dark:[&_.border-blue-200]:border-gray-700 dark:[&_.border-green-200]:border-gray-700"
      )}
    >
      {children}
    </div>
  );
}

export default function IULSlideContent({ slide, labels, isAdmin }: SlideContentProps) {
  return (
    <IULSlideThemeWrapper>
      <IULSlideContentInner slide={slide} labels={labels} isAdmin={isAdmin} />
    </IULSlideThemeWrapper>
  );
}

function IULSlideContentInner({ slide, labels, isAdmin }: SlideContentProps) {
  const t = createAccessor(slide.data);
  const labelsT = createAccessor(labels);

  const slideType = slide.type;

  if (slideType === "agent") {
    return <AgentSlide t={t} isAdmin={isAdmin ?? false} />;
  } else if (slideType === "discovery") {
    return <DiscoverySlide t={t} />;
  } else if (slideType === "retirementProduct") {
    return <RetirementProductSlide t={t} labelsT={labelsT} />;
  } else if (slideType === "scenario") {
    return <ScenarioSlide t={t} labelsT={labelsT} />;
  } else if (slideType === "bank") {
    return <BankSlide t={t} />;
  } else if (slideType === "bankExample") {
    return <BankExampleSlide t={t} labelsT={labelsT} />;
  } else if (slideType === "bankCosts") {
    return <BankCostsSlide t={t} labelsT={labelsT} />;
  } else if (slideType === "bankTeaser") {
    return <BankTeaserSlide t={t} labelsT={labelsT} />;
  } else if (slideType === "iulHero") {
    return <IULHeroSlide t={t} />;
  } else if (slideType === "iulWho") {
    return <IULWhoSlide t={t} />;
  } else if (slideType === "iulComparison") {
    return <IULComparisonSlide t={t} />;
  } else if (slideType === "iulStructure") {
    return <IULStructureSlide t={t} />;
  } else if (slideType === "iulIndexing") {
    return <IULIndexingSlide t={t} />;
  } else if (slideType === "iulTerms") {
    return <IULTermsSlide t={t} />;
  } else if (slideType === "iulNotInvested") {
    return <IULNotInvestedSlide t={t} />;
  } else if (slideType === "iulHowItWorks") {
    return <IULHowItWorksSlide t={t} />;
  } else if (slideType === "iulIllustrationCTA") {
    return <IULIllustrationCTASlide t={t} />;
  } else if (slideType === "company") {
    return <CompanySlide t={t} />;
  }

  return null;
}

// Agent Introduction Slide
function AgentSlide({ t, isAdmin }: { t: any; isAdmin: boolean }) {
  const [selectedState, setSelectedState] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  // States with an active license (from Sanity agentLicense docs, injected server-side)
  const states = t.raw("states") || [];
  const contactInfo = t.raw("contact") || {};
  const headshot = t.raw("headshot") || {};

  // License images stream through the admin-gated proxy (middleware returns
  // 401/403 for anyone else), keyed by state code — Cloudinary public IDs
  // never reach the browser.
  const stateLicenseImage =
    isAdmin && selectedState
      ? `/api/admin/license-image?key=${selectedState}&w=1200&h=800`
      : null;
  const driversLicenseImage = isAdmin
    ? "/api/admin/license-image?key=drivers&w=1200&h=800"
    : null;

  // Download as image
  const downloadAsImage = async () => {
    if (!slideRef.current) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(slideRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
      });
      
      const link = document.createElement("a");
      link.download = `isaac-orraiz-agent-introduction-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error downloading image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Download as PDF
  const downloadAsPDF = async () => {
    if (!slideRef.current) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(slideRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      // Convert pixels to mm (1 inch = 25.4mm, and at scale 2, 1px = 0.264583mm)
      const imgWidth = (canvas.width * 0.264583);
      const imgHeight = (canvas.height * 0.264583);
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = (pdfHeight - imgHeight * ratio) / 2;
      
      pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`isaac-orraiz-agent-introduction-${Date.now()}.pdf`);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      ref={slideRef}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center mb-8">
        <motion.h2 
          variants={itemVariants} 
          className="text-4xl md:text-5xl font-bold text-gray-900 mb-3"
        >
          {t("title")}
        </motion.h2>
        <motion.p 
          variants={itemVariants} 
          className="text-xl md:text-2xl text-blue-600 font-semibold"
        >
          {t("subtitle")}
        </motion.p>
        
        {/* Download Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex justify-center gap-3 mt-6"
        >
          <Button
            onClick={downloadAsImage}
            disabled={isDownloading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <FileImage className="h-4 w-4" />
            {isDownloading ? t("download.downloading") : t("download.asImage")}
          </Button>
          <Button
            onClick={downloadAsPDF}
            disabled={isDownloading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <FileTextIcon className="h-4 w-4" />
            {isDownloading ? t("download.downloading") : t("download.asPDF")}
          </Button>
        </motion.div>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Left Column - Agent Info */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Agent Profile Card */}
          <motion.div
            variants={cardVariants}
            className="bg-gradient-to-br from-blue-50 to-cyan-50 p-8 rounded-2xl shadow-xl border-2 border-blue-200"
          >
            <div className="flex items-center mb-6">
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full mr-4 overflow-hidden border-4 border-blue-600 shadow-lg flex-shrink-0">
                {headshot.url && (
                  <Image
                    src={headshot.url}
                    alt={headshot.alt || contactInfo.name || "Agent"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 80px, 96px"
                  />
                )}
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
                  {contactInfo.name || "Isaac Orraiz"}
                </h3>
                <p className="text-lg text-blue-600 font-semibold">
                  {t("role")}
                </p>
              </div>
            </div>
            
            <motion.p
              variants={itemVariants}
              className="text-gray-700 text-lg leading-relaxed mb-6"
            >
              {t("introduction")}
            </motion.p>

            {/* Contact Information */}
            <div className="space-y-4">
              {contactInfo.phone && (
                <motion.a
                  href={`tel:${contactInfo.phone}`}
                  variants={itemVariants}
                  className="flex items-center text-gray-700 hover:text-blue-600 transition-colors group"
                >
                  <Phone className="h-5 w-5 mr-3 text-blue-600 group-hover:scale-110 transition-transform" />
                  <span className="text-lg font-medium">{contactInfo.phone}</span>
                </motion.a>
              )}
              
              {contactInfo.email && (
                <motion.a
                  href={`mailto:${contactInfo.email}`}
                  variants={itemVariants}
                  className="flex items-center text-gray-700 hover:text-blue-600 transition-colors group"
                >
                  <Mail className="h-5 w-5 mr-3 text-blue-600 group-hover:scale-110 transition-transform" />
                  <span className="text-lg font-medium break-all">{contactInfo.email}</span>
                </motion.a>
              )}
              
              {contactInfo.website && (
                <motion.a
                  href={contactInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  variants={itemVariants}
                  className="flex items-center text-gray-700 hover:text-blue-600 transition-colors group"
                >
                  <MapPin className="h-5 w-5 mr-3 text-blue-600 group-hover:scale-110 transition-transform" />
                  <span className="text-lg font-medium">{contactInfo.website}</span>
                </motion.a>
              )}
            </div>
          </motion.div>

          {/* Credentials */}
          <motion.div
            variants={cardVariants}
            className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500"
          >
            <div className="flex items-center mb-4">
              <BadgeCheck className="h-6 w-6 text-green-600 mr-2" />
              <h4 className="text-xl font-bold text-gray-900">{t("credentials.title")}</h4>
            </div>
            <ul className="space-y-2">
              {(t.raw("credentials.list") || []).map((cred: string, index: number) => (
                <motion.li
                  key={index}
                  variants={itemVariants}
                  className="flex items-start text-gray-700"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-base">{cred}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        {/* Right Column - Licenses */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* State License Selector */}
          <motion.div
            variants={cardVariants}
            className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <BadgeCheck className="h-6 w-6 text-blue-600 mr-2" />
                <h4 className="text-xl font-bold text-gray-900">{t("stateLicense.title")}</h4>
              </div>
              {isAdmin && (
                <div className="flex items-center text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {t("unlock.unlocked")}
                </div>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("stateLicense.selectLabel")}
              </label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("stateLicense.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state: { code: string; name: string }) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* State License Image */}
            <div className="relative w-full min-h-[500px] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 flex items-center justify-center p-4">
              {!isAdmin ? (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-50">
                  <div className="text-center">
                    <Lock className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-base font-medium">{t("unlock.lockedMessage")}</p>
                    <p className="text-sm mt-2">{t("unlock.lockedSubmessage")}</p>
                  </div>
                </div>
              ) : stateLicenseImage ? (
                <Image
                  src={stateLicenseImage}
                  alt={`${selectedState} License`}
                  width={1200}
                  height={800}
                  className="object-contain w-full h-full max-h-[500px]"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <BadgeCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t("stateLicense.placeholder")}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Driver's License */}
          <motion.div
            variants={cardVariants}
            className="bg-white p-6 rounded-xl shadow-lg border-2 border-green-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <BadgeCheck className="h-6 w-6 text-green-600 mr-2" />
                <h4 className="text-xl font-bold text-gray-900">{t("driversLicense.title")}</h4>
              </div>
              {isAdmin && (
                <div className="flex items-center text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {t("unlock.unlocked")}
                </div>
              )}
            </div>
            
            <div className="relative w-full min-h-[500px] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 flex items-center justify-center p-4">
              {!isAdmin ? (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-50">
                  <div className="text-center">
                    <Lock className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-base font-medium">{t("unlock.lockedMessage")}</p>
                    <p className="text-sm mt-2">{t("unlock.lockedSubmessage")}</p>
                  </div>
                </div>
              ) : driversLicenseImage ? (
                <Image
                  src={driversLicenseImage}
                  alt="Driver's License"
                  width={1200}
                  height={800}
                  className="object-contain w-full h-full max-h-[500px]"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <BadgeCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t("driversLicense.placeholder")}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>

    </motion.div>
  );
}

// Company Slide - National Life Group
function CompanySlide({ t }: { t: any }) {
  const highlights = t.raw("highlights") || [];
  const productFeatures = t.raw("productFeatures") || [];
  const values = t.raw("values") || [];
  const ownership = t.raw("ownership") || {};
  const companyName = t("companyName");
  const logoUrl = t.raw("logo")?.url;
  const videoUrl = t("videoUrl");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-7xl mx-auto"
    >
      {/* Hero Header with Logo */}
      <motion.div variants={itemVariants} className="text-center mb-12">
        {/* Company Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="mb-8 flex justify-center"
        >
          <div className="relative w-64 h-32 md:w-80 md:h-40 bg-white rounded-2xl shadow-2xl border-4 border-green-300 flex items-center justify-center p-6">
            {logoUrl && (
              <Image
                src={logoUrl}
                alt={`${companyName} Logo`}
                width={300}
                height={150}
                className="object-contain w-full h-full"
                unoptimized
              />
            )}
          </div>
        </motion.div>

        <motion.h2
          variants={itemVariants}
          className="text-5xl md:text-6xl font-bold text-gray-900 mb-4"
        >
          {t("title") || companyName}
        </motion.h2>
        <motion.p
          variants={itemVariants}
          className="text-2xl md:text-3xl text-green-600 mb-4 font-semibold"
        >
          {t("subtitle")}
        </motion.p>
        <motion.p
          variants={itemVariants}
          className="text-xl md:text-2xl text-gray-700 max-w-4xl mx-auto leading-relaxed"
        >
          {t("description")}
        </motion.p>
      </motion.div>

      {/* Core Values Banner */}
      <motion.div
        variants={highlightVariants}
        className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-8 rounded-2xl shadow-2xl mb-12 border-4 border-green-400"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <motion.h3 
            className="text-3xl md:text-4xl font-bold text-white mb-8 flex items-center justify-center gap-3"
          >
            <Heart className="h-10 w-10 text-yellow-300" />
            {t("valuesTitle")}
            <Heart className="h-10 w-10 text-yellow-300" />
          </motion.h3>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((value: any, index: number) => (
              <motion.div
                key={index}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1, type: "spring" }}
                className="bg-white/20 backdrop-blur-sm px-6 py-6 rounded-xl border-2 border-white/30"
              >
                <p className="text-2xl md:text-3xl font-bold text-yellow-300 mb-3">{value.title}</p>
                <p className="text-white text-sm md:text-base leading-relaxed">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Key Statistics */}
      <motion.div
        variants={itemVariants}
        className="grid md:grid-cols-3 gap-6 mb-12"
      >
        <motion.div
          variants={cardVariants}
          whileHover={{ scale: 1.05, y: -5 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-xl text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.9, type: "spring" }}
            className="mb-4"
          >
            <TrendingUp className="h-12 w-12 text-green-600 mx-auto" />
          </motion.div>
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="text-4xl md:text-5xl font-bold text-green-700 mb-2"
          >
            {t("statistics.assetsValue")}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="text-lg font-semibold text-gray-700"
          >
            {t("statistics.assetsLabel")}
          </motion.p>
        </motion.div>

        <motion.div
          variants={cardVariants}
          whileHover={{ scale: 1.05, y: -5 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-xl text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.0, type: "spring" }}
            className="mb-4"
          >
            <Award className="h-12 w-12 text-green-600 mx-auto" />
          </motion.div>
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="text-4xl md:text-5xl font-bold text-green-700 mb-2"
          >
            {t("statistics.yearsValue")}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-lg font-semibold text-gray-700"
          >
            {t("statistics.yearsLabel")}
          </motion.p>
        </motion.div>

        <motion.div
          variants={cardVariants}
          whileHover={{ scale: 1.05, y: -5 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-xl text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.1, type: "spring" }}
            className="mb-4"
          >
            <Shield className="h-12 w-12 text-green-600 mx-auto" />
          </motion.div>
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="text-4xl md:text-5xl font-bold text-green-700 mb-2"
          >
            {t("statistics.ratingValue")}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="text-lg font-semibold text-gray-700"
          >
            {t("statistics.ratingLabel")}
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Company Highlights */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {highlights.map((highlight: any, index: number) => (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ scale: 1.02, y: -3 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-lg"
            >
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="text-2xl font-bold text-green-700 mb-3 flex items-center"
              >
                <CheckCircle2 className="h-6 w-6 mr-2 text-green-600" />
                {highlight.title}
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="text-gray-700 text-lg leading-relaxed"
              >
                {highlight.description}
              </motion.p>
            </motion.div>
          ))}
      </div>

      {/* Policyholder Ownership - Mutual Company */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 p-8 rounded-2xl shadow-2xl border-4 border-green-400 mb-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.9 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 2.0, type: "spring" }}
            className="mb-6"
          >
            <Users className="h-16 w-16 text-green-600 mx-auto" />
          </motion.div>
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.1 }}
            className="text-3xl md:text-4xl font-bold text-green-900 mb-4"
          >
            {ownership.title}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2 }}
            className="text-xl md:text-2xl text-gray-800 leading-relaxed max-w-4xl mx-auto font-medium mb-4"
            dangerouslySetInnerHTML={{ __html: ownership.description || "" }}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.3 }}
            className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border-2 border-green-300 max-w-3xl mx-auto mt-6"
          >
            <h4 className="text-2xl font-bold text-green-800 mb-4">{ownership.whyTitle}</h4>
            <ul className="text-left space-y-3 text-lg text-gray-700">
              {(ownership.benefits || []).map((benefit: any, index: number) => (
                <li key={index} className="flex items-start">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mr-3 flex-shrink-0 mt-1" />
                  <span><strong>{benefit.label}:</strong> {benefit.text}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Mission Statement */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-8 rounded-2xl shadow-xl border-4 border-green-300 mb-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.4 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 2.5, type: "spring" }}
            className="mb-6"
          >
            <Target className="h-16 w-16 text-green-600 mx-auto" />
          </motion.div>
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.6 }}
            className="text-3xl md:text-4xl font-bold text-green-900 mb-4"
          >
            {t("missionTitle")}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.7 }}
            className="text-xl md:text-2xl text-gray-800 leading-relaxed max-w-4xl mx-auto font-medium"
          >
            {t("missionText")}
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Company Video */}
      <motion.div
        variants={itemVariants}
        className="mb-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.8 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl shadow-2xl border-4 border-green-300"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.9 }}
            className="text-center mb-6"
          >
            <motion.h3
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3"
            >
              <Zap className="h-10 w-10 text-green-600" />
              {t("videoTitle")}
              <Zap className="h-10 w-10 text-green-600" />
            </motion.h3>
            <p className="text-lg text-gray-600">{t("videoDescription")}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 3.0, type: "spring" }}
            className="relative w-full aspect-video rounded-xl overflow-hidden shadow-xl border-4 border-green-200 bg-gray-900"
          >
            <iframe
              src={videoUrl}
              title="National Life Group Company Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full"
              style={{ border: 0 }}
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Product Features */}
      {productFeatures.length > 0 && (
        <motion.div 
          variants={itemVariants} 
          className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-xl shadow-xl border-2 border-green-200"
        >
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3.1 }}
            className="text-3xl font-bold text-gray-900 mb-6 flex items-center"
          >
            <Briefcase className="h-8 w-8 mr-3 text-green-600" />
            {t("productsTitle")}
          </motion.h3>
          <ul className="grid md:grid-cols-2 gap-4">
            {productFeatures.map((feature: string, index: number) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 3.2 + index * 0.1 }}
                className="flex items-start text-lg text-gray-700"
              >
                <CheckCircle2 className="h-6 w-6 text-green-600 mr-3 flex-shrink-0 mt-1" />
                <span className="font-medium">{feature}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
}

// Discovery Questions Slide
function DiscoverySlide({ t }: { t: any }) {
  const questions = t.raw("questions") || [];
  const image = t.raw("image") || {};

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header with integrated image */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
          <motion.div
            variants={itemVariants}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1"
          >
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
              {t("title")}
            </motion.h2>
            <motion.p variants={itemVariants} className="text-xl md:text-2xl text-blue-600 font-semibold mb-2">
              {t("subtitle")}
            </motion.p>
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-gray-700">
              {t("description")}
            </motion.p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="relative w-full md:w-80 flex-shrink-0"
          >
            {image.url && (
              <Image
                src={image.url}
                alt={image.alt || t("title")}
                width={320}
                height={240}
                className="rounded-xl shadow-xl object-cover border-4 border-blue-200"
                unoptimized
              />
            )}
          </motion.div>
        </div>

        {/* Questions Grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {questions.map((question: string, index: number) => (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ scale: 1.02, y: -2 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 p-5 rounded-xl border-l-4 border-blue-500 shadow-lg"
            >
              <div className="flex items-start">
                <HelpCircle className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-1" />
                <p className="text-base md:text-lg text-gray-700 font-medium">{question}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Retirement Product Slide
function RetirementProductSlide({ t, labelsT }: { t: any; labelsT: any }) {
  const product = t.raw("product");
  const advantages = t.raw("advantages") || [];
  const disadvantages = t.raw("disadvantages") || [];
  const imageUrl = t.raw("image")?.url;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header Section with Image */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
          <div className="flex-1 text-center md:text-left">
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
              {t("title")}
            </motion.h2>
            <motion.p variants={itemVariants} className="text-xl md:text-2xl text-blue-600 font-semibold mb-4">
              {product?.name || t("subtitle")}
            </motion.p>
            {product?.description && (
              <motion.p variants={itemVariants} className="text-lg md:text-xl text-gray-700">
                {product.description}
              </motion.p>
            )}
          </div>
          {imageUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="relative w-full md:w-72 flex-shrink-0"
            >
              <Image
                src={imageUrl}
                alt={product?.name || t("subtitle")}
                width={288}
                height={200}
                className="rounded-xl shadow-xl object-contain border-4 border-blue-200 bg-white p-2"
                unoptimized
              />
            </motion.div>
          )}
        </div>

        {/* Contribution Limit with integrated styling */}
        {product?.contributionLimit && (
          <motion.div
            variants={itemVariants}
            className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-xl shadow-lg mb-6 border-2 border-purple-500"
          >
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">{labelsT("contributionLimit")}</p>
              <p className="text-3xl md:text-4xl font-bold text-purple-700">{product.contributionLimit}</p>
              {product.catchUp && (
                <p className="text-base text-gray-600 mt-2">{labelsT("catchUp")} {product.catchUp}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Advantages and Disadvantages */}
        <div className="grid md:grid-cols-2 gap-6">
          <motion.div variants={itemVariants} className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-lg">
            <motion.h3
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl md:text-3xl font-bold text-green-700 mb-4 flex items-center"
            >
              <CheckCircle2 className="h-8 w-8 mr-2" />
              {labelsT("advantages")}
            </motion.h3>
            <ul className="space-y-3">
              {advantages.map((advantage: string, index: number) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-start text-gray-700"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-lg">{advantage}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
          <motion.div variants={itemVariants} className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-xl border-l-4 border-red-500 shadow-lg">
            <motion.h3
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl md:text-3xl font-bold text-red-700 mb-4 flex items-center"
            >
              <XCircle className="h-8 w-8 mr-2" />
              {labelsT("disadvantages")}
            </motion.h3>
            <ul className="space-y-3">
              {disadvantages.map((disadvantage: string, index: number) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-start text-gray-700"
                >
                  <XCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-lg">{disadvantage}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// Scenario Slide
function ScenarioSlide({ t, labelsT }: { t: any; labelsT: any }) {
  const scenario = t.raw("scenario");

  // Icon set driven by the explicit scenarioKind field (was keyword-matching
  // the translated subtitle in both languages)
  const kind = t("scenarioKind");
  const isMedical = kind === "illness";
  const isMarket = kind === "market";
  const isRMD = kind === "rmd";
  const isPenalty = kind === "penalty";

  const keyNumbers = scenario?.keyNumbers || [];
  const scenarioImageUrl = t.raw("image")?.url;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      {/* Dramatic Header */}
      <motion.div variants={itemVariants} className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="inline-flex items-center justify-center mb-4"
        >
          <div className="bg-red-100 rounded-full p-4 mr-4">
            {isMedical && <Hospital className="h-12 w-12 text-red-600" />}
            {isMarket && <TrendingDown className="h-12 w-12 text-red-600" />}
            {isRMD && <Clock className="h-12 w-12 text-red-600" />}
            {isPenalty && <Ban className="h-12 w-12 text-red-600" />}
            {!isMedical && !isMarket && !isRMD && !isPenalty && <AlertTriangle className="h-12 w-12 text-red-600" />}
          </div>
          <motion.h2 
            variants={itemVariants} 
            className="text-5xl md:text-6xl font-bold text-gray-900"
          >
            {t("title")}
          </motion.h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-3"
        >
          <AlertTriangle className="h-8 w-8 text-red-600" />
          <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-red-600 font-bold">
            {scenario?.title || t("subtitle")}
          </motion.p>
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </motion.div>
      </motion.div>

      <div className="max-w-6xl mx-auto">
        {/* The Situation - Enhanced with integrated image */}
        <motion.div
          variants={cardVariants}
          className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6 md:p-8 rounded-2xl border-4 border-orange-400 shadow-2xl mb-6 relative overflow-hidden"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500 rounded-full -ml-24 -mb-24"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Image on the left */}
              {scenarioImageUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="relative w-full md:w-64 flex-shrink-0"
                >
                  <Image
                    src={scenarioImageUrl}
                    alt={scenario?.title || t("subtitle")}
                    width={256}
                    height={200}
                    className="rounded-xl shadow-lg object-contain border-4 border-orange-300 bg-white p-2"
                    unoptimized
                  />
                </motion.div>
              )}
              
              {/* Content on the right */}
              <div className="flex-1">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center mb-4"
                >
                  <div className="bg-orange-500 rounded-full p-3 mr-4">
                    <AlertCircle className="h-6 w-6 md:h-8 md:w-8 text-white" />
                  </div>
                  <motion.h3
                    className="text-2xl md:text-3xl font-bold text-orange-800"
                  >
                    {labelsT("situation")}
                  </motion.h3>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/80 backdrop-blur-sm p-5 rounded-xl border-2 border-orange-200"
                >
                  <div className="flex items-start gap-3">
                    <User className="h-6 w-6 md:h-8 md:w-8 text-orange-600 flex-shrink-0 mt-1" />
                    <p className="text-lg md:text-xl text-gray-800 leading-relaxed font-medium">
                      {scenario?.situation}
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* The Problem - Very Dramatic */}
        <motion.div
          variants={cardVariants}
          className="bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 p-8 rounded-2xl border-4 border-red-800 shadow-2xl relative overflow-hidden"
        >
          {/* Animated Background Elements */}
          <div className="absolute inset-0 opacity-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -mr-48 -mt-48"
            ></motion.div>
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-0 left-0 w-80 h-80 bg-white rounded-full -ml-40 -mb-40"
            ></motion.div>
          </div>

          <div className="relative z-10">
            {/* Problem Header with Icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="flex items-center mb-6"
            >
              <div className="bg-white rounded-full p-4 mr-4 shadow-lg">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <motion.h3
                className="text-3xl md:text-4xl font-bold text-white"
              >
                {labelsT("problem")}
              </motion.h3>
            </motion.div>

            {/* Problem Text with Icons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white/95 backdrop-blur-sm p-6 rounded-xl border-4 border-red-300 mb-6"
            >
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-10 w-10 text-red-600 flex-shrink-0 mt-1 animate-pulse" />
                <p className="text-xl md:text-2xl text-gray-900 leading-relaxed font-semibold">
                  {scenario?.problem}
                </p>
              </div>
            </motion.div>

            {/* Key Numbers Display with Context */}
            {keyNumbers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
              >
                {keyNumbers.map((item: { value: string; label: string; numberType: string }, idx: number) => {
                  const isLoss = item.numberType === "loss" || item.numberType === "missing";
                  const isResult = item.numberType === "result" || item.numberType === "after";
                  const isForced = item.numberType === "forced" || item.numberType === "ongoing";
                  
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + idx * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                      className={`bg-white rounded-xl p-4 text-center border-4 shadow-lg ${
                        isLoss ? "border-red-500" : 
                        isResult ? "border-orange-400" : 
                        isForced ? "border-yellow-500" : 
                        "border-blue-400"
                      }`}
                    >
                      {isLoss && <ArrowDownCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />}
                      {isResult && <DollarSign className="h-6 w-6 text-orange-600 mx-auto mb-2" />}
                      {isForced && <AlertTriangle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />}
                      {!isLoss && !isResult && !isForced && <Target className="h-6 w-6 text-blue-600 mx-auto mb-2" />}
                      <p className={`text-2xl md:text-3xl font-bold mb-1 ${
                        isLoss ? "text-red-700" : 
                        isResult ? "text-orange-700" : 
                        isForced ? "text-yellow-700" : 
                        "text-blue-700"
                      }`}>
                        {item.value}
                      </p>
                      <p className="text-xs md:text-sm font-semibold text-gray-700 mt-1 leading-tight">
                        {item.label}
                      </p>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Impact Section - Most Dramatic */}
            {scenario?.impact && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-gradient-to-r from-red-800 to-rose-800 rounded-xl p-6 border-4 border-white shadow-2xl"
              >
                <div className="flex items-center mb-4">
                  <Zap className="h-10 w-10 text-yellow-300 mr-3 animate-pulse" />
                  <motion.h4
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-3xl font-bold text-white"
                  >
                    {labelsT("impact")}
                  </motion.h4>
                </div>
                <div className="bg-white/10 backdrop-blur-sm p-5 rounded-lg border-2 border-white/30">
                  <div className="flex items-start gap-4">
                    <Skull className="h-8 w-8 text-white flex-shrink-0 mt-1" />
                    <p className="text-xl md:text-2xl text-white leading-relaxed font-semibold">
                      {scenario.impact}
                    </p>
                  </div>
                </div>
                
              </motion.div>
            )}

            {/* Warning Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-6 flex items-center justify-center gap-3 bg-white/20 backdrop-blur-sm p-4 rounded-lg border-2 border-white/40"
            >
              <Ban className="h-6 w-6 text-white animate-pulse" />
              <p className="text-lg font-bold text-white">
                {t("warning")}
              </p>
              <Ban className="h-6 w-6 text-white animate-pulse" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Bank Slide - Introduction
function BankSlide({ t }: { t: any }) {
  const questions = t.raw("questions") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-full p-6">
              <Landmark className="h-16 w-16 text-purple-600" />
            </div>
          </div>
          <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {t("title")}
          </motion.h2>
          <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-purple-600 font-semibold mb-6">
            {t("subtitle")}
          </motion.p>
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-gray-700 max-w-3xl mx-auto mb-10">
            {t("description")}
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5 max-w-5xl mx-auto">
          {questions.map((question: string, index: number) => (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ scale: 1.02, y: -3 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-xl border-l-4 border-purple-500 shadow-lg"
            >
              <div className="flex items-start">
                <HelpCircle className="h-6 w-6 text-purple-600 mr-3 flex-shrink-0 mt-1" />
                <p className="text-lg md:text-xl text-gray-800 font-medium">{question}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Bank Example Slide - Car or House
function BankExampleSlide({ t, labelsT }: { t: any; labelsT: any }) {
  const example = t.raw("example");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-6xl mx-auto">
        <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 text-center">
          {t("title")}
        </motion.h2>
        <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-red-600 mb-8 text-center font-semibold">
          {t("subtitle")}
        </motion.p>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left: Scenario and Loan Details */}
          <motion.div variants={itemVariants} className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border-l-4 border-orange-500 shadow-lg"
            >
              <div className="flex items-center mb-4">
                <AlertCircle className="h-8 w-8 text-orange-600 mr-3" />
                <h3 className="text-2xl font-bold text-orange-800">{labelsT("scenario")}</h3>
              </div>
              <p className="text-lg text-gray-800">{example?.scenario}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border-2 border-blue-400 shadow-lg"
            >
              <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center">
                <Calculator className="h-6 w-6 mr-2" />
                {labelsT("loanDetails")}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">{labelsT("loanAmount")}</span>
                  <span className="text-xl font-bold text-blue-700">{example?.loanAmount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">{labelsT("interestRate")}</span>
                  <span className="text-xl font-bold text-red-600">{example?.interestRate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">{labelsT("term")}</span>
                  <span className="text-lg font-semibold text-gray-800">{example?.loanTerm}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t-2 border-blue-300">
                  <span className="text-gray-700 font-medium">{labelsT("monthlyPayment")}</span>
                  <span className="text-xl font-bold text-blue-700">{example?.monthlyPayment}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: The Cost Breakdown */}
          <motion.div variants={itemVariants}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 p-8 rounded-2xl border-4 border-red-800 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -mr-32 -mt-32"></div>
              </div>
              <div className="relative z-10">
                <div className="flex items-center mb-6">
                  <DollarSign className="h-10 w-10 text-yellow-300 mr-3" />
                  <h3 className="text-3xl font-bold text-white">{labelsT("trueCost")}</h3>
                </div>
                <div className="bg-white/95 backdrop-blur-sm p-6 rounded-xl mb-4">
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600 mb-2">{labelsT("totalYoullPay")}</p>
                    <p className="text-4xl font-bold text-red-700">{example?.totalPaid}</p>
                  </div>
                  <div className="text-center pt-4 border-t-2 border-red-300">
                    <p className="text-sm text-gray-600 mb-2">{labelsT("interestPaidToBank")}</p>
                    <p className="text-5xl font-bold text-red-800">{example?.interestPaid}</p>
                    <p className="text-lg text-red-600 mt-2 font-semibold">{labelsT("moneyNeverSeeAgain")}</p>
                  </div>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-red-800/80 backdrop-blur-sm p-5 rounded-xl border-2 border-white/30"
                >
                  <div className="flex items-start gap-3">
                    <XCircle className="h-6 w-6 text-yellow-300 flex-shrink-0 mt-1" />
                    <p className="text-lg text-white font-semibold">{example?.problem}</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// Bank Costs Summary Slide
function BankCostsSlide({ t, labelsT }: { t: any; labelsT: any }) {
  const costs = t.raw("costs") || [];
  const total = t("total");
  const summary = t("summary");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-6xl mx-auto">
        <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 text-center">
          {t("title")}
        </motion.h2>
        <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-red-600 mb-10 text-center font-semibold">
          {t("subtitle")}
        </motion.p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {costs.map((cost: { item: string; amount: string; description: string }, index: number) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-xl border-l-4 border-red-500 shadow-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <Receipt className="h-6 w-6 text-red-600 mr-2" />
                  <h3 className="text-xl font-bold text-red-800">{cost.item}</h3>
                </div>
                <p className="text-3xl font-bold text-red-700">{cost.amount}</p>
              </div>
              <p className="text-sm text-gray-600">{cost.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 p-8 rounded-2xl border-4 border-red-800 shadow-2xl mb-6 relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -mr-48 -mt-48"></div>
          </div>
          <div className="relative z-10 text-center">
            <p className="text-2xl text-white mb-4 font-semibold">{labelsT("lifetimeInterestPaid")}</p>
            <p className="text-6xl md:text-7xl font-bold text-yellow-300 mb-4">{total}</p>
            <p className="text-xl text-white font-semibold">{labelsT("toBanksAndInstitutions")}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border-l-4 border-orange-500 shadow-lg"
        >
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-8 w-8 text-orange-600 flex-shrink-0 mt-1" />
            <p className="text-lg md:text-xl text-gray-800 font-semibold">{summary}</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Bank Teaser Slide
function BankTeaserSlide({ t, labelsT }: { t: any; labelsT: any }) {
  const questions = t.raw("questions") || [];
  const description = t("description");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-full p-6"
            >
              <Banknote className="h-16 w-16 text-purple-600" />
            </motion.div>
          </div>
          <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {t("title")}
          </motion.h2>
          <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-purple-600 font-semibold mb-6">
            {t("subtitle")}
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5 mb-8">
          {questions.map((question: string, index: number) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ scale: 1.02, y: -3 }}
              className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-xl border-l-4 border-purple-500 shadow-lg"
            >
              <div className="flex items-start">
                <Target className="h-6 w-6 text-purple-600 mr-3 flex-shrink-0 mt-1" />
                <p className="text-lg md:text-xl text-gray-800 font-medium">{question}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 p-8 rounded-2xl border-4 border-purple-800 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-20">
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-white rounded-full -ml-40 -mb-40"></div>
          </div>
          <div className="relative z-10">
            <div className="flex items-center mb-4">
              <Zap className="h-10 w-10 text-yellow-300 mr-3 animate-pulse" />
              <h3 className="text-3xl font-bold text-white">{labelsT("solutionExists")}</h3>
            </div>
            <p className="text-xl md:text-2xl text-white font-semibold leading-relaxed">{description}</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// IUL Hero Slide - The Big Reveal
function IULHeroSlide({ t }: { t: any }) {
  const highlights = t.raw("highlights") || [];
  const image = t.raw("image") || {};

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-7xl mx-auto">
        {/* Hero Section with Image */}
        <div className="grid md:grid-cols-2 gap-8 items-center mb-12">
          {/* Left: Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative w-full"
          >
            <div className="relative rounded-2xl shadow-2xl overflow-hidden border-4 border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 p-4">
              {image.url && (
                <Image
                  src={image.url}
                  alt={image.alt || t("subtitle")}
                  width={600}
                  height={400}
                  className="rounded-xl object-contain w-full h-auto"
                  unoptimized
                />
              )}
            </div>
          </motion.div>

          {/* Right: Title and Description */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
            >
              <motion.h1
                variants={itemVariants}
                className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 leading-tight"
              >
                {t("title")}
              </motion.h1>
              <motion.p
                variants={itemVariants}
                className="text-3xl md:text-4xl text-purple-600 font-bold mb-6"
              >
                {t("subtitle")}
              </motion.p>
              <motion.p
                variants={itemVariants}
                className="text-xl md:text-2xl text-gray-700 leading-relaxed"
              >
                {t("description")}
              </motion.p>
            </motion.div>
          </motion.div>
        </div>

        {/* Highlights Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {highlights.map((highlight: string, index: number) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 p-6 rounded-xl shadow-xl border-2 border-purple-400 relative overflow-hidden"
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              </div>
              <div className="relative z-10 flex items-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1, type: "spring" }}
                  className="bg-yellow-300 rounded-full p-2 mr-4"
                >
                  <CheckCircle2 className="h-6 w-6 text-purple-700" />
                </motion.div>
                <p className="text-lg md:text-xl font-bold text-white">{highlight}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mt-12 text-center"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.3, type: "spring" }}
            className="inline-block bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 p-8 rounded-2xl shadow-2xl border-4 border-purple-400"
          >
            <div className="flex items-center justify-center gap-4">
              <Zap className="h-12 w-12 text-yellow-300 animate-pulse" />
              <p className="text-2xl md:text-3xl font-bold text-white">
                {t("cta")}
              </p>
              <Zap className="h-12 w-12 text-yellow-300 animate-pulse" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// IUL Who Slide - Who is IUL Good For
function IULWhoSlide({ t }: { t: any }) {
  const characteristics = t.raw("characteristics") || [];

  const iconMap: Record<string, any> = {
    legacy: Heart,
    income: TrendingUp,
    bank: Landmark,
    portfolio: BarChart3,
    retirement: PiggyBank,
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-10">
          <motion.h2
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            {t("title")}
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-2xl md:text-3xl text-purple-600 font-semibold mb-6"
          >
            {t("subtitle")}
          </motion.p>
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto"
          >
            {t("description")}
          </motion.p>
        </motion.div>

        {/* Characteristics Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {characteristics.map((char: { title: string; description: string; icon: string }, index: number) => {
            const IconComponent = iconMap[char.icon] || CheckCircle2;
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6 rounded-xl border-l-4 border-green-500 shadow-lg relative overflow-hidden"
              >
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-200 rounded-full -mr-16 -mt-16 opacity-20"></div>
                
                <div className="relative z-10">
                  <div className="flex items-start mb-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 + index * 0.1, type: "spring" }}
                      className="bg-green-500 rounded-full p-3 mr-4 flex-shrink-0"
                    >
                      <IconComponent className="h-6 w-6 text-white" />
                    </motion.div>
                    <h3 className="text-xl md:text-2xl font-bold text-green-800 flex-1">
                      {char.title}
                    </h3>
                  </div>
                  <p className="text-base md:text-lg text-gray-700 leading-relaxed ml-16">
                    {char.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-10 text-center"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.9, type: "spring" }}
            className="inline-block bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-6 rounded-xl shadow-xl border-2 border-green-400"
          >
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-yellow-300" />
              <p className="text-xl md:text-2xl font-bold text-white">
                {t("cta")}
              </p>
              <CheckCircle2 className="h-8 w-8 text-yellow-300" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// IUL Comparison Slide - Risk vs Reward Graph
function IULComparisonSlide({ t }: { t: any }) {
  const investments = t.raw("investments") || [];
  const graphWidth = 600;
  const graphHeight = 500;
  const padding = 60;

  // Calculate positions for each investment
  const getPosition = (risk: number, reward: number) => {
    const x = padding + (risk / 100) * (graphWidth - padding * 2);
    const y = graphHeight - padding - (reward / 100) * (graphHeight - padding * 2);
    return { x, y };
  };

  // Draw diagonal reference line
  const diagonalStart = getPosition(0, 0);
  const diagonalEnd = getPosition(100, 100);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.h2
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            {t("title")}
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-purple-600 font-semibold mb-4"
          >
            {t("subtitle")}
          </motion.p>
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-gray-700 max-w-3xl mx-auto"
          >
            {t("description")}
          </motion.p>
        </motion.div>

        {/* Graph Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl shadow-2xl border-4 border-purple-200 mb-8"
        >
          <div className="relative mx-auto" style={{ width: graphWidth, height: graphHeight }}>
            {/* SVG Graph */}
            <svg
              width={graphWidth}
              height={graphHeight}
              className="absolute inset-0"
            >
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((val) => {
                const pos = getPosition(val, val);
                return (
                  <g key={val}>
                    <line
                      x1={padding}
                      y1={pos.y}
                      x2={graphWidth - padding}
                      y2={pos.y}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                    <line
                      x1={pos.x}
                      y1={padding}
                      x2={pos.x}
                      y2={graphHeight - padding}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                  </g>
                );
              })}

              {/* Diagonal reference line */}
              <line
                x1={diagonalStart.x}
                y1={diagonalStart.y}
                x2={diagonalEnd.x}
                y2={diagonalEnd.y}
                stroke="#d1d5db"
                strokeWidth="2"
                strokeDasharray="8,4"
                opacity={0.5}
              />

              {/* Investment points */}
              {investments.map((investment: { name: string; risk: number; reward: number; isIul?: boolean; labelPlacement?: string }, index: number) => {
                const pos = getPosition(investment.risk, investment.reward);
                const isIUL = Boolean(investment.isIul);
                const circleColor = isIUL ? "#3b82f6" : "#10b981";
                const circleSize = isIUL ? 16 : 12;
                const glowSize = isIUL ? 24 : 16;

                return (
                  <g key={index}>
                    {/* Glow effect for IUL */}
                    {isIUL && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={glowSize}
                        fill={circleColor}
                        opacity="0.2"
                      >
                        <animate
                          attributeName="r"
                          values={`${glowSize};${glowSize + 4};${glowSize}`}
                          dur="2s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.2;0.3;0.2"
                          dur="2s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                    
                    {/* Main circle */}
                    <motion.circle
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5 + index * 0.1, type: "spring" }}
                      cx={pos.x}
                      cy={pos.y}
                      r={circleSize}
                      fill={circleColor}
                      stroke="white"
                      strokeWidth="3"
                      className="cursor-pointer"
                    />

                    {/* Label - placement comes from the Sanity investment data */}
                    {(() => {
                      const placement = investment.labelPlacement || "top";
                      let labelX = pos.x;
                      let labelY = pos.y - circleSize - 8;
                      let textAnchor: "start" | "middle" | "end" = "middle";

                      if (placement === "topLeft") {
                        labelX = pos.x - 5;
                        textAnchor = "end";
                      } else if (placement === "topRight") {
                        labelX = pos.x + 5;
                        textAnchor = "start";
                      } else if (placement === "bottom") {
                        labelY = pos.y + circleSize + 20;
                      }

                      return (
                        <motion.text
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6 + index * 0.1 }}
                          x={labelX}
                          y={labelY}
                          textAnchor={textAnchor}
                          className={`text-sm font-bold ${isIUL ? "fill-blue-600" : "fill-green-600"}`}
                          fontSize="14"
                        >
                          {investment.name}
                        </motion.text>
                      );
                    })()}

                    {/* Connection line to diagonal for IUL */}
                    {isIUL && (() => {
                      const diagonalY = graphHeight - padding - (investment.risk / 100) * (graphHeight - padding * 2);
                      return (
                        <line
                          x1={pos.x}
                          y1={pos.y}
                          x2={pos.x}
                          y2={diagonalY}
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeDasharray="4,4"
                          opacity="0.5"
                        />
                      );
                    })()}
                  </g>
                );
              })}

              {/* Axes */}
              <line
                x1={padding}
                y1={graphHeight - padding}
                x2={graphWidth - padding}
                y2={graphHeight - padding}
                stroke="#374151"
                strokeWidth="3"
                markerEnd="url(#arrowhead)"
              />
              <line
                x1={padding}
                y1={graphHeight - padding}
                x2={padding}
                y2={padding}
                stroke="#374151"
                strokeWidth="3"
                markerEnd="url(#arrowhead)"
              />

              {/* Arrow markers */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#374151" />
                </marker>
              </defs>

              {/* Axis labels */}
              <text
                x={graphWidth / 2}
                y={graphHeight - 20}
                textAnchor="middle"
                className="fill-gray-700 font-bold"
                fontSize="18"
              >
                {t("axis.risk")} →
              </text>
              <text
                x={20}
                y={graphHeight / 2}
                textAnchor="middle"
                className="fill-gray-700 font-bold"
                fontSize="18"
                transform={`rotate(-90, 20, ${graphHeight / 2})`}
              >
                ↑ {t("axis.reward")}
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div className="mt-8 flex flex-wrap justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-gray-700">{t("legend.traditional")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium text-gray-700">{t("legend.iul")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-gray-400 border-dashed"></div>
              <span className="text-sm font-medium text-gray-600">{t("legend.typicalLine")}</span>
            </div>
          </div>
        </motion.div>

        {/* Key Insight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6 rounded-xl shadow-xl border-2 border-blue-400"
        >
          <div className="flex items-center justify-center gap-4">
            <Target className="h-8 w-8 text-yellow-300" />
            <p className="text-xl md:text-2xl font-bold text-white text-center">
              {t("insight")}
            </p>
            <Target className="h-8 w-8 text-yellow-300" />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// IUL Structure Slide - Two Buckets (Death Benefit & Cash Value)
function IULStructureSlide({ t }: { t: any }) {
  const twoComponents = t.raw("twoComponents");
  const relationship = t.raw("relationship");
  const cashValueFeatures = t.raw("cashValueFeatures");
  const whyStructureMatters = t.raw("whyStructureMatters");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.h2
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            {t("title")}
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-purple-600 font-semibold mb-4"
          >
            {t("subtitle")}
          </motion.p>
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-gray-700 max-w-3xl mx-auto"
          >
            {t("description")}
          </motion.p>
        </motion.div>

        {/* Two Components Seesaw Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          {/* Header Box */}
          <div className="flex justify-center mb-6">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="bg-gradient-to-r from-green-700 to-emerald-700 px-8 py-4 rounded-xl shadow-xl"
            >
              <h3 className="text-2xl md:text-3xl font-bold text-white text-center">
                {twoComponents?.title}
              </h3>
            </motion.div>
          </div>

          {/* Seesaw Container */}
          <div className="relative max-w-4xl mx-auto">
            {/* Two Buckets with Seesaw */}
            <div className="flex items-end justify-center gap-8 mb-4">
              {/* Death Benefit Bucket */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col items-center"
              >
                <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-6 rounded-xl shadow-2xl border-4 border-blue-400 mb-4 w-64">
                  <div className="flex items-center justify-center mb-3">
                    <Shield className="h-10 w-10 text-white mb-2" />
                  </div>
                  <h4 className="text-2xl font-bold text-white text-center mb-2">
                    {twoComponents?.deathBenefit?.name}
                  </h4>
                  <p className="text-sm text-gray-300 text-center">
                    {twoComponents?.deathBenefit?.description}
                  </p>
                </div>
                {/* Bucket visual */}
                <div className="relative w-32 h-24 bg-gradient-to-b from-gray-600 to-gray-800 rounded-b-2xl border-4 border-gray-500">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-full bg-blue-500 opacity-30 rounded-b-2xl"></div>
                  </div>
                </div>
              </motion.div>

              {/* Cash Value Bucket */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col items-center"
              >
                <div className="bg-gradient-to-br from-green-700 to-emerald-700 p-6 rounded-xl shadow-2xl border-4 border-green-400 mb-4 w-64">
                  <div className="flex items-center justify-center mb-3">
                    <TrendingUp className="h-10 w-10 text-white mb-2" />
                  </div>
                  <h4 className="text-2xl font-bold text-white text-center mb-2">
                    {twoComponents?.cashValue?.name}
                  </h4>
                  <p className="text-sm text-gray-200 text-center">
                    {twoComponents?.cashValue?.description}
                  </p>
                </div>
                {/* Bucket visual */}
                <div className="relative w-32 h-24 bg-gradient-to-b from-green-600 to-emerald-800 rounded-b-2xl border-4 border-green-500">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-3/4 bg-yellow-400 opacity-50 rounded-b-2xl"></div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Seesaw Platform */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.7 }}
              className="relative h-2 bg-gradient-to-r from-gray-700 via-green-600 to-gray-700 rounded-full mx-auto max-w-2xl shadow-lg"
            >
              {/* Scale Icon on Platform */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
                className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10"
              >
                <Scale className="h-12 w-12 text-green-600 drop-shadow-lg bg-white rounded-full p-1" />
              </motion.div>
              
              {/* Fulcrum */}
              <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-4">
                <div className="w-0 h-0 border-l-[20px] border-r-[20px] border-t-[30px] border-l-transparent border-r-transparent border-t-gray-600"></div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Relationship and Features Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Relationship Section */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-l-4 border-blue-500 shadow-lg"
          >
            <h3 className="text-2xl font-bold text-blue-700 mb-4 flex items-center">
              <Scale className="h-6 w-6 mr-2" />
              {relationship?.title}
            </h3>
            <p className="text-gray-700 mb-4 font-semibold">
              {relationship?.explanation}
            </p>
            <ul className="space-y-3">
              {relationship?.points?.map((point: string, index: number) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + index * 0.1 }}
                  className="flex items-start text-gray-800"
                >
                  <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-lg">{point}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Cash Value Features */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-lg"
          >
            <h3 className="text-2xl font-bold text-green-700 mb-4 flex items-center">
              <TrendingUp className="h-6 w-6 mr-2" />
              {cashValueFeatures?.title}
            </h3>
            <ul className="space-y-3">
              {cashValueFeatures?.points?.map((point: string, index: number) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + index * 0.1 }}
                  className="flex items-start text-gray-800"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-lg">{point}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Why Structure Matters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 p-8 rounded-xl shadow-xl border-2 border-purple-400 mb-6"
        >
          <h3 className="text-3xl font-bold text-white mb-6 text-center flex items-center justify-center">
            <Target className="h-8 w-8 mr-3" />
            {whyStructureMatters?.title}
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {whyStructureMatters?.points?.map((point: string, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.3 + index * 0.1 }}
                className="flex items-start bg-white bg-opacity-20 rounded-lg p-4"
              >
                <CheckCircle2 className="h-6 w-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" />
                <span className="text-lg font-semibold text-white">{point}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.7, type: "spring" }}
            className="inline-block bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-6 rounded-xl shadow-xl border-2 border-green-400"
          >
            <div className="flex items-center justify-center gap-3">
              <Zap className="h-8 w-8 text-yellow-300" />
              <p className="text-xl md:text-2xl font-bold text-white">
                {t("cta")}
              </p>
              <Zap className="h-8 w-8 text-yellow-300" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// IUL Indexing Strategy Slide
function IULIndexingSlide({ t }: { t: any }) {
  const keyPoints = t.raw("keyPoints") || [];

  const iconMap: Record<string, any> = {
    chart: BarChart3,
    shield: Shield,
    growth: TrendingUp,
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <motion.h2
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            {t("title")}
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-purple-600 font-semibold mb-4"
          >
            {t("subtitle")}
          </motion.p>
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-gray-700 max-w-3xl mx-auto"
          >
            {t("description")}
          </motion.p>
        </motion.div>

        {/* Visual: Index Following Concept */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl border-4 border-blue-200 shadow-xl">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              {/* Your Money */}
              <div className="text-center">
                <div className="bg-green-600 text-white p-6 rounded-xl shadow-lg mb-4 w-48">
                  <p className="text-2xl font-bold">{t("visualLabels.yourMoney")}</p>
                  <p className="text-sm mt-2">{t("visualLabels.inIULPolicy")}</p>
                </div>
                <ArrowDown className="h-8 w-8 text-gray-600 mx-auto" />
                <p className="text-sm text-gray-600 mt-2">{t("visualLabels.follows")}</p>
              </div>

              {/* Index */}
              <div className="text-center">
                <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg w-48">
                  <p className="text-2xl font-bold">S&P 500</p>
                  <p className="text-sm mt-2">{t("visualLabels.marketIndex")}</p>
                </div>
                <ArrowDown className="h-8 w-8 text-gray-600 mx-auto mt-4" />
                <p className="text-sm text-gray-600 mt-2">{t("visualLabels.performance")}</p>
              </div>

              {/* Result */}
              <div className="text-center">
                <div className="bg-purple-600 text-white p-6 rounded-xl shadow-lg w-48">
                  <p className="text-2xl font-bold">{t("visualLabels.yourGrowth")}</p>
                  <p className="text-sm mt-2">{t("visualLabels.protectedParticipating")}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Key Points */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {keyPoints.map((point: { icon: string; title: string; description: string }, index: number) => {
            const IconComponent = iconMap[point.icon] || CheckCircle2;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-lg"
              >
                <div className="flex items-center mb-4">
                  <div className="bg-green-600 rounded-full p-3 mr-4">
                    <IconComponent className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-green-800">{point.title}</h3>
                </div>
                <p className="text-gray-700 text-lg">{point.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Important Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 p-6 rounded-xl shadow-xl border-4 border-yellow-500"
        >
          <div className="flex items-center justify-center gap-4">
            <AlertCircle className="h-8 w-8 text-white" />
            <p className="text-xl md:text-2xl font-bold text-white text-center">
              {t("visualNote")}
            </p>
            <AlertCircle className="h-8 w-8 text-white" />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// IUL Terms Slide - Floor & Cap
function IULTermsSlide({ t }: { t: any }) {
  const floor = t.raw("floor");
  const cap = t.raw("cap");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <motion.h2
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            {t("title")}
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-purple-600 font-semibold mb-4"
          >
            {t("subtitle")}
          </motion.p>
        </motion.div>

        {/* Floor and Cap Visual Comparison */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Floor - 0% Protection */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-xl border-l-4 border-green-500 shadow-xl"
          >
            <div className="text-center mb-6">
              <div className="bg-green-600 rounded-full p-4 inline-block mb-4">
                <Shield className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-green-700 mb-2">{floor?.title}</h3>
              <p className="text-xl text-gray-700">{floor?.description}</p>
            </div>

            {/* Visual: Market Down, You Stay at 0% */}
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 font-semibold">{t("visualLabels.marketDrops")}</span>
                  <span className="text-red-600 font-bold text-xl">-20%</span>
                </div>
                <div className="h-4 bg-red-200 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 w-full"></div>
                </div>
              </div>
              <ArrowDown className="h-6 w-6 text-gray-600 mx-auto" />
              <div className="bg-white p-4 rounded-lg shadow border-2 border-green-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 font-semibold">{t("visualLabels.yourAccount")}</span>
                  <span className="text-green-600 font-bold text-xl">0%</span>
                </div>
                <div className="h-4 bg-green-200 rounded-full">
                  <div className="h-full bg-green-500 w-0"></div>
                </div>
                <p className="text-sm text-gray-600 mt-2 text-center">{t("visualLabels.protected")}</p>
              </div>
            </div>

            <p className="text-gray-700 mt-6 text-center font-semibold">{floor?.explanation}</p>
          </motion.div>

          {/* Cap - 10% Limit */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border-l-4 border-blue-500 shadow-xl"
          >
            <div className="text-center mb-6">
              <div className="bg-blue-600 rounded-full p-4 inline-block mb-4">
                <TrendingUp className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-blue-700 mb-2">{cap?.title}</h3>
              <p className="text-xl text-gray-700">{cap?.description}</p>
            </div>

            {/* Visual: Market Up, You Get Cap */}
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 font-semibold">{t("visualLabels.marketGains")}</span>
                  <span className="text-green-600 font-bold text-xl">+15%</span>
                </div>
                <div className="h-4 bg-green-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 w-full"></div>
                </div>
              </div>
              <ArrowDown className="h-6 w-6 text-gray-600 mx-auto" />
              <div className="bg-white p-4 rounded-lg shadow border-2 border-blue-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 font-semibold">{t("visualLabels.yourAccount")}</span>
                  <span className="text-blue-600 font-bold text-xl">+10%</span>
                </div>
                <div className="h-4 bg-blue-200 rounded-full">
                  <div className="h-full bg-blue-500" style={{ width: "66.67%" }}></div>
                </div>
                <p className="text-sm text-gray-600 mt-2 text-center">{t("visualLabels.cappedAt")}</p>
              </div>
            </div>

            <p className="text-gray-700 mt-6 text-center font-semibold">{cap?.explanation}</p>
          </motion.div>
        </div>

        {/* Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-100 p-4 rounded-xl text-center"
        >
          <p className="text-gray-700 italic">{t("note")}</p>
        </motion.div>
      </div>
    </motion.div>
  );
}

// IUL Not Invested Slide
function IULNotInvestedSlide({ t }: { t: any }) {
  const comparison = t.raw("comparison");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <motion.h2
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            {t("title")}
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-purple-600 font-semibold mb-4"
          >
            {t("subtitle")}
          </motion.p>
        </motion.div>

        {/* Comparison Visual */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Direct Investment */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-red-50 to-rose-50 p-8 rounded-xl border-l-4 border-red-500 shadow-xl"
          >
            <div className="text-center mb-6">
              <div className="bg-red-600 rounded-full p-4 inline-block mb-4">
                <BarChart3 className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-red-700 mb-2">{comparison?.directInvestment?.title}</h3>
            </div>

            <div className="space-y-4">
              {comparison?.directInvestment?.points?.map((point: string, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-start bg-white p-4 rounded-lg shadow"
                >
                  <XCircle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-800">{point}</span>
                </motion.div>
              ))}
            </div>

            {/* Visual: Money in Stocks */}
            <div className="mt-6 bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-12 h-12 bg-red-500 rounded"></div>
                <div className="w-12 h-12 bg-red-500 rounded"></div>
                <div className="w-12 h-12 bg-red-500 rounded"></div>
              </div>
              <p className="text-center text-sm text-gray-600">{t("visualLabels.yourMoneyStocks")}</p>
            </div>
          </motion.div>

          {/* Indexing Strategy */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-xl border-l-4 border-green-500 shadow-xl"
          >
            <div className="text-center mb-6">
              <div className="bg-green-600 rounded-full p-4 inline-block mb-4">
                <Shield className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-green-700 mb-2">{comparison?.indexing?.title}</h3>
            </div>

            <div className="space-y-4">
              {comparison?.indexing?.points?.map((point: string, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-start bg-white p-4 rounded-lg shadow"
                >
                  <CheckCircle2 className="h-6 w-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-800">{point}</span>
                </motion.div>
              ))}
            </div>

            {/* Visual: Money in Policy */}
            <div className="mt-6 bg-white p-6 rounded-lg shadow border-2 border-green-500">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-12 h-12 bg-green-500 rounded-full"></div>
                <ArrowRight className="h-6 w-6 text-gray-600" />
                <div className="w-12 h-12 bg-blue-500 rounded"></div>
              </div>
              <p className="text-center text-sm text-gray-600">{t("visualLabels.yourMoneyPolicy")}</p>
            </div>
          </motion.div>
        </div>

        {/* Key Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 p-6 rounded-xl shadow-xl border-2 border-purple-400"
        >
          <div className="flex items-center justify-center gap-4">
            <Target className="h-8 w-8 text-yellow-300" />
            <p className="text-xl md:text-2xl font-bold text-white text-center">
              {t("keyMessage")}
            </p>
            <Target className="h-8 w-8 text-yellow-300" />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// IUL How It Works - Example
function IULHowItWorksSlide({ t }: { t: any }) {
  const scenarios = t.raw("scenarios") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <motion.h2
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            {t("title")}
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-purple-600 font-semibold mb-4"
          >
            {t("subtitle")}
          </motion.p>
        </motion.div>

        {/* Scenarios */}
        <div className="space-y-6 mb-8">
          {scenarios.map((scenario: { year: string; marketReturn: string; yourReturn: string; explanation: string }, index: number) => {
            const isPositive = scenario.marketReturn.startsWith("+");
            const isYourPositive = scenario.yourReturn.startsWith("+") || scenario.yourReturn === "0%";
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.2 }}
                className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-xl border-2 border-gray-200 shadow-lg"
              >
                <div className="grid md:grid-cols-4 gap-4 items-center">
                  {/* Year */}
                  <div className="text-center md:text-left">
                    <h3 className="text-2xl font-bold text-gray-900">{scenario.year}</h3>
                  </div>

                  {/* Market Return */}
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">{t("visualLabels.marketReturn")}</p>
                    <div className={`text-3xl font-bold ${isPositive ? "text-green-600" : "text-red-600"}`}>
                      {scenario.marketReturn}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <ArrowRight className="h-8 w-8 text-gray-400" />
                  </div>

                  {/* Your Return */}
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">{t("visualLabels.yourReturn")}</p>
                    <div className={`text-3xl font-bold ${isYourPositive ? "text-green-600" : "text-red-600"}`}>
                      {scenario.yourReturn}
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-gray-700 text-center">{scenario.explanation}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-8 rounded-xl shadow-xl border-2 border-green-400"
        >
          <div className="flex items-center justify-center gap-4">
            <CheckCircle2 className="h-10 w-10 text-yellow-300" />
            <p className="text-2xl md:text-3xl font-bold text-white text-center">
              {t("summary")}
            </p>
            <CheckCircle2 className="h-10 w-10 text-yellow-300" />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// IUL Illustration CTA Slide
function IULIllustrationCTASlide({ t }: { t: any }) {
  const whatYoullSee = t.raw("whatYoullSee") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <motion.h2
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            {t("title")}
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-purple-600 font-semibold mb-4"
          >
            {t("subtitle")}
          </motion.p>
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-gray-700 max-w-3xl mx-auto"
          >
            {t("description")}
          </motion.p>
        </motion.div>

        {/* What You'll See */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
            {t("whatYoullSeeTitle")}
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {whatYoullSee.map((item: string, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="flex items-center bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-l-4 border-blue-500 shadow-lg"
              >
                <CheckCircle2 className="h-8 w-8 text-blue-600 mr-4 flex-shrink-0" />
                <p className="text-lg font-semibold text-gray-800">{item}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, type: "spring" }}
          className="text-center"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 p-8 rounded-2xl shadow-2xl border-4 border-purple-400 cursor-pointer"
          >
            <div className="flex items-center justify-center gap-4">
              <Zap className="h-12 w-12 text-yellow-300 animate-pulse" />
              <p className="text-3xl md:text-4xl font-bold text-white">
                {t("cta")}
              </p>
              <Zap className="h-12 w-12 text-yellow-300 animate-pulse" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
