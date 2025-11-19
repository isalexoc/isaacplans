"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, MapPin, ArrowRight, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

// State marketplace URLs
const STATE_MARKETPLACES: Record<string, string> = {
  GA: "https://enroll.georgiaaccess.gov/prescreener/",
  VA: "https://enroll.marketplace.virginia.gov/prescreener/",
  CO: "https://prd.connectforhealthco.com/EstimateAndExplorePortal/landingOverview",
  MD: "https://app.marylandhealthconnection.gov/hixui/public/home.html#/getEstimate?lang=en_US&firstTime=1",
};

// Default FFM (Federally Facilitated Marketplace) URL
const FFM_URL = "https://www.healthsherpa.com/?_agent_id=isaacplans";

// All US states with their codes
const ALL_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
];

export default function PlanComparisonClient() {
  const t = useTranslations("planComparisonPage");
  const [selectedState, setSelectedState] = useState<string>("");

  const getMarketplaceUrl = (stateCode: string): string => {
    return STATE_MARKETPLACES[stateCode] || FFM_URL;
  };

  const getStateName = (stateCode: string): string => {
    const state = ALL_STATES.find((s) => s.code === stateCode);
    return state?.name || stateCode;
  };

  const hasStateMarketplace = (stateCode: string): boolean => {
    return stateCode in STATE_MARKETPLACES;
  };

  const handleComparePlans = () => {
    if (selectedState) {
      const url = getMarketplaceUrl(selectedState);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <main className="w-full flex flex-col overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-brand/10 p-4">
              <MapPin className="w-12 h-12 text-brand" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            {t("hero.title")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-700 dark:text-gray-300">
            {t("hero.description")}
          </p>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">
                {t("content.title")}
              </CardTitle>
              <CardDescription className="text-lg text-gray-700 dark:text-gray-300">
                {t("content.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* State Selector */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-900 dark:text-white block">
                  {t("content.selectLabel")}
                </label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="w-full h-12 text-base">
                    <SelectValue placeholder={t("content.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {ALL_STATES.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        <div className="flex items-center justify-between w-full">
                          <span>{state.name}</span>
                          {hasStateMarketplace(state.code) && (
                            <CheckCircle2 className="w-4 h-4 text-brand ml-2" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedState && hasStateMarketplace(selectedState) && (
                  <p className="text-sm text-brand flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {t("content.stateMarketplaceNote", { state: getStateName(selectedState) })}
                  </p>
                )}
              </div>

              {/* CTA Button */}
              <Button
                onClick={handleComparePlans}
                disabled={!selectedState}
                size="lg"
                className="w-full bg-brand hover:bg-brand/90 text-white py-6 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{t("content.buttonText")}</span>
                <ExternalLink className="w-5 h-5 ml-2" />
              </Button>

              {selectedState && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  {t("content.disclaimer")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Information Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center">
              {t("info.title")}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-brand" />
                    {t("info.cards.0.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300">
                    {t("info.cards.0.description")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-brand" />
                    {t("info.cards.1.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300">
                    {t("info.cards.1.description")}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* State-Specific Marketplaces Info */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {t("marketplaces.title")}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {t("marketplaces.description")}
            </p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <ArrowRight className="w-5 h-5 text-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Georgia:</strong> {t("marketplaces.georgia")}
                </span>
              </li>
              <li className="flex items-start">
                <ArrowRight className="w-5 h-5 text-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Virginia:</strong> {t("marketplaces.virginia")}
                </span>
              </li>
              <li className="flex items-start">
                <ArrowRight className="w-5 h-5 text-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Colorado:</strong> {t("marketplaces.colorado")}
                </span>
              </li>
              <li className="flex items-start">
                <ArrowRight className="w-5 h-5 text-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Maryland:</strong> {t("marketplaces.maryland")}
                </span>
              </li>
              <li className="flex items-start">
                <ArrowRight className="w-5 h-5 text-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>{t("marketplaces.ffmTitle")}:</strong> {t("marketplaces.ffmDescription")}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

