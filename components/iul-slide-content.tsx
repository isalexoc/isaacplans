"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Shield,
  TrendingUp,
  Settings,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Lock,
  BarChart3,
  PiggyBank,
  Briefcase,
  Home,
  FileText,
  Users,
  Heart,
  Building2,
  CreditCard,
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
  Stethoscope,
  Activity,
  Percent,
  Minus,
  ArrowDown,
  ArrowDownCircle,
  ArrowUp,
  MinusCircle,
  Skull,
  Clock,
  Calendar,
  Banknote,
  Wallet,
  Car,
  Landmark,
  Coins,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SlideContentProps {
  slideKey: string;
}

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  chart: TrendingUp,
  settings: Settings,
  tax: DollarSign,
  payment: DollarSign,
  growth: TrendingUp,
  dollar: DollarSign,
  benefit: Shield,
  access: PiggyBank,
  flex: Settings,
  wealth: TrendingUp,
  retirement: Home,
  estate: FileText,
  business: Briefcase,
  health: Heart,
};

// Color mapping
const colorMap: Record<string, { gradient: string; border: string; text: string; bg: string }> = {
  green: {
    gradient: "from-green-50 to-emerald-50",
    border: "border-green-500",
    text: "text-green-700",
    bg: "bg-green-600",
  },
  blue: {
    gradient: "from-blue-50 to-cyan-50",
    border: "border-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-600",
  },
  purple: {
    gradient: "from-purple-50 to-pink-50",
    border: "border-purple-500",
    text: "text-purple-700",
    bg: "bg-purple-600",
  },
  orange: {
    gradient: "from-orange-50 to-amber-50",
    border: "border-orange-500",
    text: "text-orange-700",
    bg: "bg-orange-600",
  },
  red: {
    gradient: "from-red-50 to-rose-50",
    border: "border-red-500",
    text: "text-red-700",
    bg: "bg-red-600",
  },
};

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

export default function IULSlideContent({ slideKey }: SlideContentProps) {
  const t = useTranslations(`iulPresentation.slides.${slideKey}`);
  const labelsT = useTranslations("iulPresentation.labels");

  const slideType = t("type");

  if (slideType === "agent") {
    return <AgentSlide t={t} />;
  } else if (slideType === "discovery") {
    return <DiscoverySlide t={t} />;
  } else if (slideType === "retirementProduct") {
    return <RetirementProductSlide t={t} slideKey={slideKey} labelsT={labelsT} />;
  } else if (slideType === "scenario") {
    return <ScenarioSlide t={t} slideKey={slideKey} labelsT={labelsT} />;
  } else if (slideType === "bank") {
    return <BankSlide t={t} />;
  } else if (slideType === "bankExample") {
    return <BankExampleSlide t={t} />;
  } else if (slideType === "bankCosts") {
    return <BankCostsSlide t={t} />;
  } else if (slideType === "bankTeaser") {
    return <BankTeaserSlide t={t} />;
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
  } else if (slideType === "hero") {
    return <HeroSlide t={t} />;
  } else if (slideType === "strategy") {
    return <StrategySlide t={t} />;
  } else if (slideType === "process") {
    return <ProcessSlide t={t} />;
  } else if (slideType === "protection") {
    return <ProtectionSlide t={t} />;
  } else if (slideType === "growth") {
    return <GrowthSlide t={t} />;
  } else if (slideType === "livingBenefits") {
    return <LivingBenefitsSlide t={t} />;
  } else if (slideType === "tax") {
    return <TaxSlide t={t} />;
  } else if (slideType === "loans") {
    return <LoansSlide t={t} />;
  } else if (slideType === "company") {
    return <CompanySlide t={t} />;
  } else if (slideType === "riders") {
    return <RidersSlide t={t} />;
  } else if (slideType === "benefits") {
    return <BenefitsSlide t={t} />;
  } else if (slideType === "flexibility") {
    return <FlexibilitySlide t={t} />;
  } else if (slideType === "comparison") {
    return <ComparisonSlide t={t} />;
  } else if (slideType === "who") {
    return <WhoSlide t={t} />;
  } else if (slideType === "cta") {
    return <CTASlide t={t} />;
  }

  return null;
}

// Agent Introduction Slide
function AgentSlide({ t }: { t: any }) {
  const [selectedState, setSelectedState] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  
  // Get states list from translations
  const states = t.raw("states") || [];
  const contactInfo = t.raw("contact") || {};
  const licenses = t.raw("licenses") || {};
  
  // Get license image based on selected state (using secure API route)
  const getLicenseImage = () => {
    if (!selectedState) return null;
    const stateLicense = licenses[selectedState];
    if (stateLicense?.imagePublicId) {
      return `/api/license-image?id=${stateLicense.imagePublicId}&w=1200&h=800`;
    }
    return null;
  };

  const getDriversLicenseImage = () => {
    if (licenses.driversLicense?.imagePublicId) {
      return `/api/license-image?id=${licenses.driversLicense.imagePublicId}&w=1200&h=800`;
    }
    return null;
  };

  const stateLicenseImage = getLicenseImage();
  const driversLicenseImage = getDriversLicenseImage();

  // Check unlock status on mount
  useEffect(() => {
    const checkUnlockStatus = async () => {
      try {
        const response = await fetch("/api/unlock-licenses");
        const data = await response.json();
        setIsUnlocked(data.unlocked || false);
      } catch (error) {
        console.error("Error checking unlock status:", error);
      }
    };
    checkUnlockStatus();
  }, []);

  // Handle unlock
  const handleUnlock = async () => {
    if (!password.trim()) {
      setPasswordError(t("unlock.passwordRequired"));
      return;
    }

    setIsUnlocking(true);
    setPasswordError("");

    try {
      const response = await fetch("/api/unlock-licenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsUnlocked(true);
        setShowPasswordModal(false);
        setPassword("");
      } else {
        setPasswordError(t("unlock.invalidPassword"));
      }
    } catch (error) {
      console.error("Error unlocking licenses:", error);
      setPasswordError(t("unlock.error"));
    } finally {
      setIsUnlocking(false);
    }
  };

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
                <Image
                  src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_200,h_200,c_fill,g_face/isaacpic_c8kca5.png"
                  alt={contactInfo.name || "Isaac Orraiz"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 80px, 96px"
                />
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
          {/* Reveal Licenses Button */}
          {!isUnlocked && (
            <motion.div
              variants={cardVariants}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl shadow-lg border-2 border-blue-300 text-center"
            >
              <Lock className="h-12 w-12 mx-auto mb-4 text-blue-600" />
              <h4 className="text-xl font-bold text-gray-900 mb-2">
                {t("unlock.title")}
              </h4>
              <p className="text-gray-600 mb-4">{t("unlock.description")}</p>
              <Button
                onClick={() => setShowPasswordModal(true)}
                className="gap-2"
                size="lg"
              >
                <Lock className="h-4 w-4" />
                {t("unlock.button")}
              </Button>
            </motion.div>
          )}

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
              {isUnlocked && (
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
              {!isUnlocked ? (
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
              {isUnlocked && (
                <div className="flex items-center text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {t("unlock.unlocked")}
                </div>
              )}
            </div>
            
            <div className="relative w-full min-h-[500px] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 flex items-center justify-center p-4">
              {!isUnlocked ? (
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

      {/* Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t("unlock.modalTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("unlock.modalDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("unlock.passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isUnlocking) {
                    handleUnlock();
                  }
                }}
                placeholder={t("unlock.passwordPlaceholder")}
                disabled={isUnlocking}
                className={passwordError ? "border-red-500" : ""}
              />
              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword("");
                  setPasswordError("");
                }}
                disabled={isUnlocking}
              >
                {t("unlock.cancel")}
              </Button>
              <Button
                onClick={handleUnlock}
                disabled={isUnlocking || !password.trim()}
                className="gap-2"
              >
                {isUnlocking ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    {t("unlock.unlocking")}
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    {t("unlock.unlockButton")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// Hero Slide (Slide 1)
function HeroSlide({ t }: { t: any }) {
  const features = t.raw("features") || [];
  const highlight = t.raw("highlight");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-8 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-700 mb-12 text-center max-w-4xl mx-auto">
        {t("description")}
      </motion.p>
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <motion.div variants={itemVariants}>
          <ul className="space-y-4 text-lg md:text-xl text-gray-600">
            {features.map((feature: string, index: number) => (
              <motion.li
                key={index}
                variants={itemVariants}
                className="flex items-start"
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1, type: "spring" as const }}
                  className="text-blue-600 mr-3 text-2xl flex-shrink-0 mt-1"
                >
                  <CheckCircle2 className="h-6 w-6" />
                </motion.span>
                <span>{feature}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
        {highlight && (
          <motion.div
            variants={highlightVariants}
            className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-10 rounded-2xl shadow-xl"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring" as const, stiffness: 200, delay: 0.6 }}
                className="text-8xl font-bold text-blue-600 mb-4"
              >
                {highlight.value}
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-3xl text-gray-700 font-semibold mb-2"
              >
                {highlight.label}
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-lg text-gray-500"
              >
                {highlight.description}
              </motion.p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// Process Slide (Slide 2)
function ProcessSlide({ t }: { t: any }) {
  const steps = t.raw("steps") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center"
      >
        {t("title")}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-2xl md:text-3xl text-blue-600 mb-10 text-center font-semibold"
      >
        {t("subtitle")}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-10 md:p-12 rounded-2xl shadow-2xl"
      >
        <div className="grid md:grid-cols-3 gap-8 text-center">
          {steps.map((step: any, index: number) => {
            const Icon = iconMap[step.icon] || TrendingUp;
            return (
              <motion.div key={index} variants={stepVariants}>
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring" as const,
                    stiffness: 200,
                    delay: 0.2 + index * 0.2,
                  }}
                  className="flex items-center justify-center mb-4"
                >
                  <div className="text-7xl font-bold">{step.number || (index + 1)}</div>
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + index * 0.2 }}
                  className="text-2xl md:text-3xl font-semibold mb-3"
                >
                  {step.title}
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.2 }}
                  className="text-blue-100 text-lg"
                >
                  {step.description}
                </motion.p>
              </motion.div>
            );
          })}
        </div>
        {t("disclaimer") && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-xs text-blue-100 mt-8 text-center"
          >
            {t("disclaimer")}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}

// Benefits Slide (Slide 3)
function BenefitsSlide({ t }: { t: any }) {
  const benefits = t.raw("benefits") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center"
      >
        {t("title")}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-2xl md:text-3xl text-blue-600 mb-12 text-center font-semibold"
      >
        {t("subtitle")}
      </motion.p>
      <div className="grid md:grid-cols-2 gap-6">
        {benefits.map((benefit: any, index: number) => {
          const colors = colorMap[benefit.color] || colorMap.blue;
          const Icon = iconMap[benefit.icon] || Shield;
          return (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ scale: 1.05, y: -5 }}
              className={cn(
                `bg-gradient-to-br ${colors.gradient} p-8 rounded-xl border-l-4 ${colors.border} shadow-lg cursor-pointer`
              )}
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-center mb-4"
              >
                <Icon className={cn("h-8 w-8 mr-3", colors.text)} />
                <h3 className={cn(`text-3xl md:text-4xl font-bold ${colors.text}`)}>
                  {benefit.title}
                </h3>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="text-gray-700 text-lg md:text-xl"
              >
                {benefit.description}
              </motion.p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Protection Slide (Slide 4)
function ProtectionSlide({ t }: { t: any }) {
  const mainFeature = t.raw("mainFeature");
  const features = t.raw("features") || [];
  const comparison = t.raw("comparison");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-12 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <div className="grid md:grid-cols-2 gap-12 items-center">
        {mainFeature && (
          <motion.div
            variants={highlightVariants}
            className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-10 rounded-2xl shadow-xl border-4 border-green-500"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring" as const, stiffness: 200, delay: 0.6 }}
                className="text-8xl font-bold text-green-600 mb-4"
              >
                {mainFeature.value}
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-3xl text-gray-700 font-semibold mb-2"
              >
                {mainFeature.label}
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-lg text-gray-500"
              >
                {mainFeature.description}
              </motion.p>
            </div>
          </motion.div>
        )}
        <motion.div variants={itemVariants}>
          <ul className="space-y-4 text-lg md:text-xl text-gray-700 mb-8">
            {features.map((feature: string, index: number) => (
              <motion.li
                key={index}
                variants={itemVariants}
                className="flex items-start"
              >
                <Lock className="h-6 w-6 text-green-600 mr-3 flex-shrink-0 mt-1" />
                <span>{feature}</span>
              </motion.li>
            ))}
          </ul>
          {comparison && (
            <motion.div
              variants={itemVariants}
              className="bg-gray-100 p-6 rounded-lg border-l-4 border-green-500"
            >
              <p className="text-red-600 font-semibold mb-2">✗ {comparison.traditional}</p>
              <p className="text-green-600 font-semibold">✓ {comparison.iul}</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Growth Slide (Slide 5)
function GrowthSlide({ t }: { t: any }) {
  const features = t.raw("features") || [];
  const indexes = t.raw("indexes") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-6 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-700 mb-12 text-center max-w-4xl mx-auto">
        {t("description")}
      </motion.p>
      <div className="grid md:grid-cols-2 gap-12">
        <motion.div variants={itemVariants}>
          <h3 className="text-3xl font-bold text-gray-900 mb-6">Key Features:</h3>
          <ul className="space-y-4 text-lg md:text-xl text-gray-700">
            {features.map((feature: string, index: number) => (
              <motion.li
                key={index}
                variants={itemVariants}
                className="flex items-start"
              >
                <TrendingUp className="h-6 w-6 text-blue-600 mr-3 flex-shrink-0 mt-1" />
                <span>{feature}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
        <motion.div
          variants={highlightVariants}
          className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-10 rounded-2xl shadow-xl"
        >
          <h3 className="text-3xl font-bold text-gray-900 mb-6">Available Indexes:</h3>
          <div className="grid grid-cols-2 gap-4">
            {indexes.map((index: string, idx: number) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
                className="bg-white p-4 rounded-lg shadow-md text-center font-semibold text-blue-700"
              >
                {index}
              </motion.div>
            ))}
          </div>
          {t("note") && (
            <p className="text-sm text-gray-500 mt-6 text-center italic">{t("note")}</p>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Flexibility Slide (Slide 6)
function FlexibilitySlide({ t }: { t: any }) {
  const features = t.raw("features") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-12 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <div className="grid md:grid-cols-2 gap-6">
        {features.map((feature: any, index: number) => {
          const Icon = iconMap[feature.icon] || Settings;
          return (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-xl border-l-4 border-purple-500 shadow-lg"
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-center mb-4"
              >
                <Icon className="h-8 w-8 mr-3 text-purple-600" />
                <h3 className="text-3xl md:text-4xl font-bold text-purple-700">
                  {feature.title}
                </h3>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="text-gray-700 text-lg md:text-xl"
              >
                {feature.description}
              </motion.p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Tax Slide (Slide 7)
function TaxSlide({ t }: { t: any }) {
  const advantages = t.raw("advantages") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-6 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-700 mb-12 text-center max-w-4xl mx-auto">
        {t("description")}
      </motion.p>
      <div className="grid md:grid-cols-2 gap-6">
        {advantages.map((advantage: any, index: number) => (
          <motion.div
            key={index}
            variants={cardVariants}
            whileHover={{ scale: 1.05, y: -5 }}
            className={cn(
              "p-8 rounded-xl shadow-lg border-l-4",
              advantage.highlight
                ? "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-500"
                : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-400"
            )}
          >
            <motion.h3
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className={cn(
                "text-3xl md:text-4xl font-bold mb-4",
                advantage.highlight ? "text-orange-700" : "text-gray-700"
              )}
            >
              {advantage.title}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="text-gray-700 text-lg md:text-xl"
            >
              {advantage.description}
            </motion.p>
          </motion.div>
        ))}
      </div>
      {t("disclaimer") && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-sm text-gray-500 mt-8 text-center italic max-w-4xl mx-auto"
        >
          {t("disclaimer")}
        </motion.p>
      )}
    </motion.div>
  );
}

// Comparison Slide (Slide 8)
function ComparisonSlide({ t }: { t: any }) {
  const comparison = t.raw("comparison") || [];
  const hasIra = comparison.length > 0 && comparison[0].ira !== undefined;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-12 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <div className="overflow-x-auto">
        <motion.table
          variants={itemVariants}
          className="w-full bg-white rounded-xl shadow-lg overflow-hidden"
        >
          <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <tr>
              <th className="px-6 py-4 text-left text-xl font-semibold">Feature</th>
              <th className="px-6 py-4 text-center text-xl font-semibold">IUL</th>
              <th className="px-6 py-4 text-center text-xl font-semibold">Traditional Investments</th>
              <th className="px-6 py-4 text-center text-xl font-semibold">Term Life</th>
              {hasIra && (
                <th className="px-6 py-4 text-center text-xl font-semibold">IRA/401(k)</th>
              )}
            </tr>
          </thead>
          <tbody>
            {comparison.map((row: any, index: number) => (
              <motion.tr
                key={index}
                variants={itemVariants}
                className={cn(
                  "border-b border-gray-200",
                  index % 2 === 0 ? "bg-gray-50" : "bg-white"
                )}
              >
                <td className="px-6 py-4 text-lg font-semibold text-gray-900">{row.feature}</td>
                <td className="px-6 py-4 text-center text-lg text-green-600 font-semibold">
                  {row.iul}
                </td>
                <td className="px-6 py-4 text-center text-lg text-gray-600">{row.traditional}</td>
                <td className="px-6 py-4 text-center text-lg text-gray-600">{row.term}</td>
                {hasIra && (
                  <td className="px-6 py-4 text-center text-lg text-gray-600">{row.ira}</td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </motion.table>
      </div>
    </motion.div>
  );
}

// Who Slide (Slide 9)
function WhoSlide({ t }: { t: any }) {
  const candidates = t.raw("candidates") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-6 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-700 mb-12 text-center max-w-4xl mx-auto">
        {t("description")}
      </motion.p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {candidates.map((candidate: any, index: number) => {
          const Icon = iconMap[candidate.icon] || Users;
          return (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border-l-4 border-blue-500 shadow-lg"
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-center mb-4"
              >
                <Icon className="h-8 w-8 mr-3 text-blue-600" />
                <h3 className="text-2xl md:text-3xl font-bold text-blue-700">
                  {candidate.title}
                </h3>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="text-gray-700 text-lg"
              >
                {candidate.description}
              </motion.p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// CTA Slide (Slide 10)
function CTASlide({ t }: { t: any }) {
  const benefits = t.raw("benefits") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full text-center"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-6 font-semibold">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-700 mb-12 max-w-4xl mx-auto">
        {t("description")}
      </motion.p>
      <motion.div
        variants={highlightVariants}
        className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white p-12 rounded-2xl shadow-2xl mb-12"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" as const, stiffness: 200, delay: 0.6 }}
          className="text-4xl md:text-5xl font-bold mb-8"
        >
          {t("ctaText")}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex justify-center"
        >
          <ArrowRight className="h-12 w-12 animate-pulse" />
        </motion.div>
      </motion.div>
      <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6 mb-8">
        {benefits.map((benefit: string, index: number) => (
          <motion.div
            key={index}
            variants={itemVariants}
            className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500"
          >
            <div className="flex items-center">
              <CheckCircle2 className="h-6 w-6 text-blue-600 mr-3 flex-shrink-0" />
              <p className="text-lg text-gray-700">{benefit}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
      <motion.p variants={itemVariants} className="text-xl text-gray-600 font-semibold">
        {t("contact")}
      </motion.p>
    </motion.div>
  );
}

// Strategy Slide
function StrategySlide({ t }: { t: any }) {
  // Safely get raw values, defaulting to empty array if key doesn't exist
  const getRaw = (key: string) => {
    try {
      const value = t.raw(key);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  
  const strategyPoints = getRaw("strategyPoints");
  const phases = getRaw("phases");
  const benefits = getRaw("benefits");
  const keyBenefits = getRaw("keyBenefits");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-6 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-700 mb-12 text-center max-w-4xl mx-auto">
        {t("description")}
      </motion.p>
      {Array.isArray(phases) && phases.length > 0 ? (
        <>
          <div className="space-y-6 mb-8">
            {phases.map((phase: any, index: number) => (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{ scale: 1.02, y: -3 }}
                className="bg-gradient-to-br from-blue-50 to-cyan-50 p-8 rounded-xl border-l-4 border-blue-500 shadow-lg"
              >
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="flex items-start mb-4"
                >
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-xl mr-4">
                    {phase.phase}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl md:text-3xl font-bold text-blue-700 mb-2">
                      {phase.title}
                    </h3>
                    <p className="text-gray-700 text-lg mb-2">{phase.description}</p>
                    <p className="text-blue-600 font-semibold italic">{phase.example}</p>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
          {Array.isArray(keyBenefits) && keyBenefits.length > 0 && (
            <motion.div variants={itemVariants} className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Key Benefits:</h3>
              <ul className="space-y-2 text-lg text-gray-700">
                {keyBenefits.map((benefit: string, index: number) => (
                  <motion.li
                    key={index}
                    variants={itemVariants}
                    className="flex items-start"
                  >
                    <CheckCircle2 className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-1" />
                    <span>{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {Array.isArray(strategyPoints) && strategyPoints.map((point: any, index: number) => {
              const Icon = iconMap[point.icon] || TrendingUp;
              return (
                <motion.div
                  key={index}
                  variants={cardVariants}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border-l-4 border-blue-500 shadow-lg"
                >
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="flex items-center mb-4"
                  >
                    <Icon className="h-8 w-8 mr-3 text-blue-600" />
                    <h3 className="text-2xl md:text-3xl font-bold text-blue-700">
                      {point.title}
                    </h3>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="text-gray-700 text-lg"
                  >
                    {point.description}
                  </motion.p>
                </motion.div>
              );
            })}
          </div>
          {Array.isArray(benefits) && benefits.length > 0 && (
            <motion.div variants={itemVariants} className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Key Benefits:</h3>
              <ul className="space-y-2 text-lg text-gray-700">
                {benefits.map((benefit: string, index: number) => (
                  <motion.li
                    key={index}
                    variants={itemVariants}
                    className="flex items-start"
                  >
                    <CheckCircle2 className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-1" />
                    <span>{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

// Living Benefits Slide
function LivingBenefitsSlide({ t }: { t: any }) {
  const benefits = t.raw("benefits") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-6 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-700 mb-12 text-center max-w-4xl mx-auto">
        {t("description")}
      </motion.p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {benefits.map((benefit: any, index: number) => {
          const colors = colorMap[benefit.color] || colorMap.blue;
          const Icon = iconMap[benefit.icon] || Shield;
          return (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ scale: 1.05, y: -5 }}
              className={cn(
                `bg-gradient-to-br ${colors.gradient} p-6 rounded-xl border-l-4 ${colors.border} shadow-lg`
              )}
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-center mb-4"
              >
                <Icon className={cn("h-8 w-8 mr-3", colors.text)} />
                <h3 className={cn(`text-2xl md:text-3xl font-bold ${colors.text}`)}>
                  {benefit.title}
                </h3>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="text-gray-700 text-lg"
              >
                {benefit.description}
              </motion.p>
            </motion.div>
          );
        })}
      </div>
      {t("note") && (
        <motion.p
          variants={itemVariants}
          className="text-sm text-gray-500 mt-8 text-center italic max-w-4xl mx-auto"
        >
          {t("note")}
        </motion.p>
      )}
    </motion.div>
  );
}

// Loans Slide
function LoansSlide({ t }: { t: any }) {
  const loanTypes = t.raw("loanTypes") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-6 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-700 mb-12 text-center max-w-4xl mx-auto">
        {t("description")}
      </motion.p>
      <div className="space-y-6">
        {loanTypes.map((loan: any, index: number) => (
          <motion.div
            key={index}
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -3 }}
            className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-xl border-l-4 border-purple-500 shadow-lg"
          >
            <motion.h3
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="text-3xl font-bold text-purple-700 mb-3"
            >
              {loan.title}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="text-gray-700 text-lg mb-4"
            >
              {loan.description}
            </motion.p>
            <div className="flex items-center justify-between">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="bg-white px-4 py-2 rounded-lg shadow"
              >
                <p className="text-sm text-gray-600">Interest Rate</p>
                <p className="text-xl font-bold text-purple-700">{loan.rate}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="bg-white px-4 py-2 rounded-lg shadow"
              >
                <p className="text-sm text-gray-600">Key Benefit</p>
                <p className="text-lg font-semibold text-purple-700">{loan.benefit}</p>
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>
      {t("keyPoint") && (
        <motion.div
          variants={itemVariants}
          className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg"
        >
          <p className="text-lg font-semibold text-blue-900">{t("keyPoint")}</p>
        </motion.div>
      )}
    </motion.div>
  );
}

// Company Slide - National Life Group
function CompanySlide({ t }: { t: any }) {
  const highlights = t.raw("highlights") || [];
  const productFeatures = t.raw("productFeatures") || [];
  const values = t.raw("values") || [];
  const ownership = t.raw("ownership") || {};
  const companyName = t("companyName") || "National Life Group";
  const logoUrl = t("logoUrl") || "https://res.cloudinary.com/isaacdev/image/upload/v1762909967/NLG_White_Logo_2x_Green_v1f7j5.png";
  const videoUrl = t("videoUrl") || "https://www.youtube.com/embed/yJnhpIn6WF4?si=r5GV5nIXc0CbleSp";

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
            <Image
              src={logoUrl}
              alt={`${companyName} Logo`}
              width={300}
              height={150}
              className="object-contain w-full h-full"
              unoptimized
            />
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
          {t("subtitle") || "Our Cause Is Our Story"}
        </motion.p>
        <motion.p 
          variants={itemVariants} 
          className="text-xl md:text-2xl text-gray-700 max-w-4xl mx-auto leading-relaxed"
        >
          {t("description") || "A mission-driven and purpose-filled business. For over 175 years, we've kept our promises to provide families stability in good times and in bad."}
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
            {t("valuesTitle") || "Our Core Values"}
            <Heart className="h-10 w-10 text-yellow-300" />
          </motion.h3>
          <div className="grid md:grid-cols-3 gap-6">
            {(values.length > 0 ? values : [
              { title: "Do Good", description: "Actively contribute to the well-being of our communities through charitable activities, volunteer programs, and supporting nonprofits." },
              { title: "Be Good", description: "Uphold the highest standards of integrity, honesty, and ethical behavior in all our professional and personal interactions." },
              { title: "Make Good", description: "Deliver on our promises and commitments, ensuring reliability and trustworthiness in every endeavor for over 175 years." }
            ]).map((value: any, index: number) => (
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
            $57.4B
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="text-lg font-semibold text-gray-700"
          >
            {t("statistics.assets") || "Assets Under Management"}
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
            175+
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-lg font-semibold text-gray-700"
          >
            {t("statistics.years") || "Years of Service"}
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
            A+ Rating
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="text-lg font-semibold text-gray-700"
          >
            {t("statistics.rating") || "Superior Financial Strength"}
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Company Highlights */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {highlights.length > 0 ? (
          highlights.map((highlight: any, index: number) => (
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
          ))
        ) : (
          <>
            <motion.div
              variants={cardVariants}
              whileHover={{ scale: 1.02, y: -3 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-lg"
            >
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 }}
                className="text-2xl font-bold text-green-700 mb-3 flex items-center"
              >
                <Shield className="h-6 w-6 mr-2 text-green-600" />
                Financial Strength
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="text-gray-700 text-lg leading-relaxed"
              >
                With $57.4 billion in assets and $507 million in core earnings, National Life Group demonstrates exceptional financial stability and consistent performance, earning recognition on the Ward's 50 list.
              </motion.p>
            </motion.div>

            <motion.div
              variants={cardVariants}
              whileHover={{ scale: 1.02, y: -3 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-lg"
            >
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.5 }}
                className="text-2xl font-bold text-green-700 mb-3 flex items-center"
              >
                <Heart className="h-6 w-6 mr-2 text-green-600" />
                Community Impact
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6 }}
                className="text-gray-700 text-lg leading-relaxed"
              >
                Through our $2.3 million Foundation budget, employee volunteer programs, and initiatives like Do Good Fest and LifeChanger of the Year, we make a meaningful difference in communities nationwide.
              </motion.p>
            </motion.div>

            <motion.div
              variants={cardVariants}
              whileHover={{ scale: 1.02, y: -3 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-lg"
            >
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.6 }}
                className="text-2xl font-bold text-green-700 mb-3 flex items-center"
              >
                <Award className="h-6 w-6 mr-2 text-green-600" />
                Proven Track Record
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.7 }}
                className="text-gray-700 text-lg leading-relaxed"
              >
                National Life has paid dividends on participating life insurance policies every year since 1855, delivering on promises through wars, depressions, and economic challenges.
              </motion.p>
            </motion.div>

            <motion.div
              variants={cardVariants}
              whileHover={{ scale: 1.02, y: -3 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-lg"
            >
              <motion.h3
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.7 }}
                className="text-2xl font-bold text-green-700 mb-3 flex items-center"
              >
                <Zap className="h-6 w-6 mr-2 text-green-600" />
                Innovative Solutions
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
                className="text-gray-700 text-lg leading-relaxed"
              >
                We offer innovative living benefits riders including Accelerated Benefits Alzheimer's Disease rider and Fertility Journey rider, addressing diverse client needs with cutting-edge solutions.
              </motion.p>
            </motion.div>
          </>
        )}
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
            {ownership.title || t("ownershipTitle") || "You're Not Just a Customer - You're an Owner"}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2 }}
            className="text-xl md:text-2xl text-gray-800 leading-relaxed max-w-4xl mx-auto font-medium mb-4"
            dangerouslySetInnerHTML={{ __html: ownership.description || t("ownershipDescription") || "National Life Group is a <strong>mutual company</strong>, which means our policyholders are the owners. This unique structure ensures that our interests are aligned with yours - not external shareholders." }}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.3 }}
            className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border-2 border-green-300 max-w-3xl mx-auto mt-6"
          >
            <h4 className="text-2xl font-bold text-green-800 mb-4">{ownership.whyTitle || t("ownershipWhyTitle") || "Why This Matters:"}</h4>
            <ul className="text-left space-y-3 text-lg text-gray-700">
              {(ownership.benefits || t.raw("ownershipBenefits") || [
                { label: "Dividends", text: "As an owner, you may be eligible to receive dividends. National Life has paid dividends every year since 1855 - over $25 million approved for 2025 alone." },
                { label: "Long-term Focus", text: "Decisions are made with policyholders' best interests in mind, not short-term shareholder profits." },
                { label: "Stability", text: "Mutual companies prioritize financial strength and long-term stability over quarterly earnings reports." },
                { label: "Alignment", text: "When the company succeeds, you succeed. Your interests and our interests are one and the same." }
              ]).map((benefit: any, index: number) => (
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
            {t("missionTitle") || "Our Mission"}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.7 }}
            className="text-xl md:text-2xl text-gray-800 leading-relaxed max-w-4xl mx-auto font-medium"
          >
            {t("missionText") || "To Do good in our communities and with the individual families we serve. We make promises and deliver on those commitments 10, 20, or 50 years down the road, providing peace of mind in times of need."}
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
              {t("videoTitle") || "Our Story"}
              <Zap className="h-10 w-10 text-green-600" />
            </motion.h3>
            <p className="text-lg text-gray-600">{t("videoDescription") || "Learn more about National Life Group's mission and values"}</p>
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
            {t("productsTitle") || "Our Products & Services"}
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

// Riders Slide
function RidersSlide({ t }: { t: any }) {
  const riders = t.raw("riders") || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center">
        {t("title")}
      </motion.h2>
      <motion.p variants={itemVariants} className="text-2xl md:text-3xl text-blue-600 mb-6 text-center font-semibold">
        {t("subtitle")}
      </motion.p>
      <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-700 mb-12 text-center max-w-4xl mx-auto">
        {t("description")}
      </motion.p>
      <div className="grid md:grid-cols-2 gap-6">
        {riders.map((rider: any, index: number) => (
          <motion.div
            key={index}
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -3 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-l-4 border-green-500 shadow-lg"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="flex items-start justify-between mb-3"
            >
              <h3 className="text-2xl font-bold text-green-700 flex-1">
                {rider.title}
              </h3>
              <span className="text-sm font-semibold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                {rider.company}
              </span>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="text-gray-700 text-lg"
            >
              {rider.description}
            </motion.p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Discovery Questions Slide
function DiscoverySlide({ t }: { t: any }) {
  const questions = t.raw("questions") || [];

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
            <Image
              src="https://res.cloudinary.com/isaacdev/image/upload/v1762887079/discovery_ddgd3v.jpg"
              alt="Discovery Questions"
              width={320}
              height={240}
              className="rounded-xl shadow-xl object-cover border-4 border-blue-200"
              unoptimized
            />
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
function RetirementProductSlide({ t, slideKey, labelsT }: { t: any; slideKey: string; labelsT: any }) {
  const product = t.raw("product");
  const advantages = t.raw("advantages") || [];
  const disadvantages = t.raw("disadvantages") || [];

  // Map slide keys to image URLs
  const imageMap: Record<string, string> = {
    slide3: "https://res.cloudinary.com/isaacdev/image/upload/v1762887006/401k_yr3t1y.png",
    slide4: "https://res.cloudinary.com/isaacdev/image/upload/v1762886951/traditional_ira_1_xbidkk.png",
    slide5: "https://res.cloudinary.com/isaacdev/image/upload/v1762886953/roth_ira_1_r5igct.png",
    slide6: "https://res.cloudinary.com/isaacdev/image/upload/v1762886952/Roth_401K_1_ghnmti.png",
    slide7: "https://res.cloudinary.com/isaacdev/image/upload/v1762886952/SEP_IRA_1_cnbfun.png",
  };

  const imageUrl = imageMap[slideKey];

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
function ScenarioSlide({ t, slideKey, labelsT }: { t: any; slideKey: string; labelsT: any }) {
  const scenario = t.raw("scenario");
  
  // Determine scenario type based on subtitle to show appropriate icons
  const subtitle = scenario?.title || t("subtitle") || "";
  const isMedical = subtitle.toLowerCase().includes("illness") || subtitle.toLowerCase().includes("enfermedad") || subtitle.toLowerCase().includes("medical");
  const isMarket = subtitle.toLowerCase().includes("market") || subtitle.toLowerCase().includes("mercado") || subtitle.toLowerCase().includes("crash");
  const isRMD = subtitle.toLowerCase().includes("rmd") || subtitle.toLowerCase().includes("distribution") || subtitle.toLowerCase().includes("distribución");
  const isPenalty = subtitle.toLowerCase().includes("penalty") || subtitle.toLowerCase().includes("penalización") || subtitle.toLowerCase().includes("withdrawal") || subtitle.toLowerCase().includes("retiro");

  // Get key numbers with labels from translations
  const keyNumbers = scenario?.keyNumbers || [];

  // Map slide keys to image URLs for scenarios
  const scenarioImageMap: Record<string, string> = {
    slide8: "https://res.cloudinary.com/isaacdev/image/upload/v1762886951/first_example_1_ywh1u1.png",
    slide9: "https://res.cloudinary.com/isaacdev/image/upload/v1762886951/second_example_1_scjof2.png",
    slide10: "https://res.cloudinary.com/isaacdev/image/upload/v1762886951/thirt_example_1_kybuno.png",
    slide11: "https://res.cloudinary.com/isaacdev/image/upload/v1762886952/fouth_example_1_lljvly.png",
  };

  const scenarioImageUrl = scenarioImageMap[slideKey];

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
                {keyNumbers.map((item: { value: string; label: string; type: string }, idx: number) => {
                  const isLoss = item.type === "loss" || item.type === "missing";
                  const isResult = item.type === "result" || item.type === "after";
                  const isForced = item.type === "forced" || item.type === "ongoing";
                  
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
                {t("warning") || "Traditional retirement accounts offer NO protection for these scenarios"}
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
function BankExampleSlide({ t }: { t: any }) {
  const example = t.raw("example");
  const labelsT = useTranslations("iulPresentation.labels");

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
function BankCostsSlide({ t }: { t: any }) {
  const costs = t.raw("costs") || [];
  const total = t("total");
  const summary = t("summary");
  const labelsT = useTranslations("iulPresentation.labels");

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
function BankTeaserSlide({ t }: { t: any }) {
  const questions = t.raw("questions") || [];
  const description = t("description");
  const labelsT = useTranslations("iulPresentation.labels");

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
  const imageUrl = t("imagePlaceholder");

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
              <Image
                src={imageUrl}
                alt="Indexed Universal Life Insurance"
                width={600}
                height={400}
                className="rounded-xl object-contain w-full h-auto"
                unoptimized
              />
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
              {investments.map((investment: { name: string; risk: number; reward: number; color: string }, index: number) => {
                const pos = getPosition(investment.risk, investment.reward);
                const isIUL = investment.name === "IUL" || investment.color === "blue";
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

                    {/* Label - Smart positioning to avoid overlaps */}
                    {(() => {
                      // Custom positioning for each investment to avoid overlaps
                      let labelX = pos.x;
                      let labelY = pos.y - circleSize - 8;
                      let textAnchor: "start" | "middle" | "end" = "middle";
                      
                      // Specific positioning for each investment type
                      if (investment.name === "Banks") {
                        labelY = pos.y - circleSize - 8;
                        labelX = pos.x - 5;
                        textAnchor = "end";
                      } else if (investment.name === "Treasury Bonds" || investment.name === "Bonos del Tesoro") {
                        labelY = pos.y + circleSize + 20;
                        labelX = pos.x;
                        textAnchor = "middle";
                      } else if (investment.name === "Whole Life" || investment.name === "Seguro de Vida Entera") {
                        labelY = pos.y - circleSize - 8;
                        labelX = pos.x + 5;
                        textAnchor = "start";
                      } else if (investment.name === "Stocks" || investment.name === "Acciones") {
                        labelY = pos.y - circleSize - 8;
                        labelX = pos.x;
                        textAnchor = "middle";
                      } else if (investment.name === "Crypto" || investment.name === "Cripto") {
                        labelY = pos.y + circleSize + 20;
                        labelX = pos.x;
                        textAnchor = "middle";
                      } else if (isIUL) {
                        labelY = pos.y - circleSize - 8;
                        labelX = pos.x;
                        textAnchor = "middle";
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
