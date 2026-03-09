"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileImage, ArrowRight, Pencil } from "lucide-react";

// 2x resolution (560px) for crisp html2canvas capture at 280px display
const SENIOR_LIFE_LOGO =
  "https://res.cloudinary.com/isaacdev/image/upload/w_560,f_png/v1773060314/Full-Logo-Gold.144f1298_iluidv.png";
// Isaac Orraiz banner - agent signature at bottom of quote
const ISAAC_BANNER =
  "https://res.cloudinary.com/isaacdev/image/upload/v1773068098/bfi_wi8szs.png";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function parseNames(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function FinalExpenseLeaveBehindForm() {
  const t = useTranslations("finalExpenseLeaveBehind");
  const [phase, setPhase] = useState<1 | 2>(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [prospectName, setProspectName] = useState("");
  const [naturalDeath, setNaturalDeath] = useState("");
  const [accidentalDeath, setAccidentalDeath] = useState("");
  const [monthlyPremium, setMonthlyPremium] = useState("");
  const [avoidNames, setAvoidNames] = useState("");
  const [protectNames, setProtectNames] = useState("");

  const imageRef = useRef<HTMLDivElement>(null);

  const naturalNum = parseInt(naturalDeath.replace(/\D/g, ""), 10) || 0;
  const accidentalNum = parseInt(accidentalDeath.replace(/\D/g, ""), 10) || 0;
  const premiumNum = parseInt(monthlyPremium.replace(/\D/g, ""), 10) || 0;
  const totalCoverage = naturalNum + accidentalNum;
  const avoidList = parseNames(avoidNames);
  const protectList = parseNames(protectNames);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!naturalDeath.trim() || naturalNum < 1) {
      errs.natural = t("validation.naturalRequired");
    } else if (naturalNum < 1) {
      errs.natural = t("validation.minAmount");
    }
    if (!accidentalDeath.trim() || accidentalNum < 1) {
      errs.accidental = t("validation.accidentalRequired");
    } else if (accidentalNum < 1) {
      errs.accidental = t("validation.minAmount");
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGenerate = () => {
    if (!validate()) return;
    setPhase(2);
  };

  const handleDownload = async () => {
    if (!imageRef.current) return;
    setIsDownloading(true);
    try {
      // Ensure element is in view and has dimensions before capture
      imageRef.current.scrollIntoView({ behavior: "auto", block: "center" });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Wait for all images to load to avoid createPattern 0x0 canvas error
      const images = imageRef.current.querySelectorAll<HTMLImageElement>("img");
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0) return resolve();
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(resolve, 5000);
            })
        )
      );

      const canvas = await html2canvas(imageRef.current, {
        backgroundColor: "#0a1628",
        scale: 2,
        logging: false,
        useCORS: true,
        imageTimeout: 15000,
        windowWidth: Math.max(imageRef.current.scrollWidth, 360),
        windowHeight: Math.max(imageRef.current.scrollHeight, 640),
      });
      const link = document.createElement("a");
      link.download = `senior-life-quote-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error downloading image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Phase 1: Data collection */}
      {phase === 1 && (
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[#003366] mb-2">
              {t("phase1.title")}
            </h2>
            <p className="text-lg text-gray-600">{t("phase1.description")}</p>
          </div>

          <div className="grid gap-6">
            <div className="space-y-2">
              <Label htmlFor="prospectName" className="text-base">{t("phase1.prospectName")}</Label>
              <Input
                id="prospectName"
                type="text"
                placeholder={t("phase1.prospectNamePlaceholder")}
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
              />
              <p className="text-sm text-gray-500">{t("phase1.prospectNameHint")}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="natural" className="text-base">{t("phase1.naturalDeath")}</Label>
                <Input
                  id="natural"
                  type="text"
                  inputMode="numeric"
                  placeholder={t("phase1.naturalDeathPlaceholder")}
                  value={naturalDeath}
                  onChange={(e) => setNaturalDeath(e.target.value)}
                  className={errors.natural ? "border-red-500" : ""}
                />
                {errors.natural && (
                  <p className="text-sm text-red-600">{errors.natural}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="accidental" className="text-base">{t("phase1.accidentalDeath")}</Label>
                <Input
                  id="accidental"
                  type="text"
                  inputMode="numeric"
                  placeholder={t("phase1.accidentalDeathPlaceholder")}
                  value={accidentalDeath}
                  onChange={(e) => setAccidentalDeath(e.target.value)}
                  className={errors.accidental ? "border-red-500" : ""}
                />
                {errors.accidental && (
                  <p className="text-sm text-red-600">{errors.accidental}</p>
                )}
                <p className="text-sm text-gray-500">
                  {t("phase1.accidentalHint")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="premium" className="text-base">{t("phase1.monthlyPremium")}</Label>
              <Input
                id="premium"
                type="text"
                inputMode="numeric"
                placeholder={t("phase1.monthlyPremiumPlaceholder")}
                value={monthlyPremium}
                onChange={(e) => setMonthlyPremium(e.target.value)}
              />
              <p className="text-sm text-gray-500">{t("phase1.monthlyPremiumHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avoid" className="text-base">{t("phase1.avoidNames")}</Label>
              <Input
                id="avoid"
                type="text"
                placeholder={t("phase1.avoidNamesPlaceholder")}
                value={avoidNames}
                onChange={(e) => setAvoidNames(e.target.value)}
              />
              <p className="text-xs text-gray-500">{t("phase1.avoidHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="protect">{t("phase1.protectNames")}</Label>
              <Input
                id="protect"
                type="text"
                placeholder={t("phase1.protectNamesPlaceholder")}
                value={protectNames}
                onChange={(e) => setProtectNames(e.target.value)}
              />
              <p className="text-sm text-gray-500">{t("phase1.protectHint")}</p>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            className="w-full sm:w-auto bg-[#003366] hover:bg-[#004080] gap-2 text-base py-6 px-8"
          >
            {t("phase2.generateButton")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Phase 2: Preview & Download */}
      {phase === 2 && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setPhase(1)}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              {t("phase2.editButton")}
            </Button>
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="gap-2 bg-[#003366] hover:bg-[#004080]"
            >
              <FileImage className="h-4 w-4" />
              {isDownloading ? t("phase2.downloading") : t("phase2.downloadButton")}
            </Button>
          </div>

          {/* Image preview - portrait 9:16 for phone viewing, shareable design */}
          {/* No shadows/frames here - html2canvas renders them as artifacts in the downloaded image */}
          <div
            ref={imageRef}
            className="rounded-xl overflow-hidden max-w-sm mx-auto"
            style={{
              minWidth: 360,
              aspectRatio: "9/18",
              background: "linear-gradient(165deg, #0a1628 0%, #0d1f3c 30%, #003366 70%, #0a1628 100%)",
            }}
          >
            <div
              className="flex flex-col items-center justify-between text-center h-full px-6 py-5"
              style={{
                fontFamily: "'Georgia', 'Times New Roman', serif",
              }}
            >
              {/* Main quote content */}
              <div className="flex flex-col items-center space-y-3 flex-1 justify-center min-h-0">
                <img
                  src={SENIOR_LIFE_LOGO}
                  alt="Senior Life Insurance Company"
                  width={280}
                  height={84}
                  crossOrigin="anonymous"
                  className="object-contain"
                />

              {/* Decorative gold line */}
              <div
                className="w-36 h-0.5 rounded-full"
                style={{ background: "linear-gradient(90deg, transparent, #d4a84b, transparent)" }}
              />

              {/* Prospect name - soft cream, always uppercase */}
              {prospectName.trim() && (
                <p
                  className="leading-tight uppercase"
                  style={{
                    color: "#faf6eb",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: "1.6rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                  }}
                >
                  {prospectName.trim()}
                </p>
              )}

              {/* Total coverage - hero, large & clear for seniors */}
              <div className="space-y-3">
                <p
                  className="text-base font-semibold uppercase tracking-[0.15em]"
                  style={{ color: "#d4a84b", fontFamily: "system-ui, sans-serif", fontSize: "1.1rem" }}
                >
                  {t("phase2.totalCoverage")}
                </p>
                <p
                  className="font-bold tracking-tight leading-none"
                  style={{ color: "#f0d78c", fontFamily: "system-ui, sans-serif", fontSize: "3.25rem" }}
                >
                  ${formatCurrency(totalCoverage)}
                </p>
                {premiumNum > 0 && (
                  <p
                    className="text-xl font-normal leading-relaxed"
                    style={{ color: "#e8d5a3", fontFamily: "system-ui, sans-serif" }}
                  >
                    {t("phase2.smallPremiumOf")}{" "}
                    <span style={{ color: "#f0d78c", fontWeight: 700 }}>
                      ${formatCurrency(premiumNum)}
                    </span>{" "}
                    {t("phase2.perMonth")}
                  </p>
                )}
                <p
                  className="text-xl text-white/95 leading-relaxed"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  {t("phase2.naturalDeathLabel")}{" "}
                  <span style={{ color: "#d4a84b", fontWeight: 600 }}>
                    ${formatCurrency(naturalNum)}
                  </span>{" "}
                  {t("phase2.plusAccidental")}{" "}
                  <span style={{ color: "#d4a84b", fontWeight: 600 }}>
                    ${formatCurrency(accidentalNum)}
                  </span>{" "}
                  {t("phase2.ifAccidental")}
                </p>
              </div>

              {avoidList.length > 0 && (
                <div
                  className="pt-3 w-full border-t"
                  style={{ borderColor: "rgba(212,168,75,0.35)" }}
                >
                  <p
                    className="text-base font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "#d4a84b", fontFamily: "system-ui, sans-serif" }}
                  >
                    {t("phase2.avoidPrefix")}
                  </p>
                  <p className="text-xl font-medium text-white/95 leading-relaxed" style={{ fontFamily: "system-ui, sans-serif" }}>
                    {avoidList.join(", ")}
                  </p>
                </div>
              )}

              {protectList.length > 0 && (
                <div
                  className="pt-3 w-full border-t"
                  style={{ borderColor: "rgba(212,168,75,0.35)" }}
                >
                  <p
                    className="text-base font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "#d4a84b", fontFamily: "system-ui, sans-serif" }}
                  >
                    {t("phase2.protectPrefix")}
                  </p>
                  <p className="text-xl font-medium text-white/95 leading-relaxed" style={{ fontFamily: "system-ui, sans-serif" }}>
                    {protectList.join(", ")}
                  </p>
                </div>
              )}
              </div>

              {/* Agent banner - Isaac Orraiz signature at bottom */}
              <div className="flex-shrink-0 w-full mt-4 pt-3 border-t" style={{ borderColor: "rgba(212,168,75,0.25)" }}>
                <img
                  src={ISAAC_BANNER}
                  alt="Isaac Orraiz - Senior Life"
                  width={360}
                  height={120}
                  crossOrigin="anonymous"
                  className="w-full h-auto object-contain object-center"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
