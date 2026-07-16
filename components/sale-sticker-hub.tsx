"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SaleStickerForm from "@/components/sale-sticker-form";
import SaleStickerListPanel from "@/components/sale-sticker-list-panel";
import FinalExpenseLeaveBehindAgentProfilePanel from "@/components/final-expense-leave-behind-agent-profile-panel";
import {
  LeaveBehindAgentProfileProvider,
  useLeaveBehindAgentProfile,
} from "@/components/leave-behind/leave-behind-agent-profile-context";
import {
  SaleStickerOnboarding,
  SALE_STICKER_ONBOARDING_KEY,
} from "@/components/sale-sticker/sale-sticker-onboarding";
import { isLeaveBehindAgentProfileComplete } from "@/lib/leave-behind-agent-profile";
import type { SaleStickerRecord } from "@/lib/sale-sticker";

type HubTab = "profile" | "create" | "stickers";

function SaleStickerHubInner() {
  const t = useTranslations("saleSticker");
  const { profile, loading: profileLoading } = useLeaveBehindAgentProfile();

  const [activeTab, setActiveTab] = useState<HubTab>("create");
  const [activeSticker, setActiveSticker] = useState<SaleStickerRecord | null>(null);
  const [formKey, setFormKey] = useState("sticker-new");
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const goToProfile = useCallback(() => setActiveTab("profile"), []);

  // First visit only: welcome new users (no complete profile yet) with a
  // one-time 3-step walkthrough. Any dismissal marks it seen for good.
  useEffect(() => {
    if (profileLoading) return;
    if (isLeaveBehindAgentProfileComplete(profile)) return;
    if (localStorage.getItem(SALE_STICKER_ONBOARDING_KEY)) return;
    setShowOnboarding(true);
  }, [profileLoading, profile]);

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(SALE_STICKER_ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  }, []);

  const startOnboarding = useCallback(() => {
    dismissOnboarding();
    setActiveTab("profile");
  }, [dismissOnboarding]);

  const handleNewSticker = useCallback(() => {
    setActiveSticker(null);
    setFormKey(`sticker-new-${Date.now()}`);
    setActiveTab("create");
  }, []);

  const handleSelectSticker = useCallback((sticker: SaleStickerRecord) => {
    setActiveSticker(sticker);
    setFormKey(`sticker-${sticker.id}`);
    setActiveTab("create");
  }, []);

  const handleStickerSaved = useCallback((sticker: SaleStickerRecord) => {
    setActiveSticker(sticker);
    setListRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
    <SaleStickerOnboarding
      open={showOnboarding}
      onClose={dismissOnboarding}
      onGetStarted={startOnboarding}
    />
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HubTab)} className="w-full">
      <TabsList className="mx-auto mb-8 grid h-auto w-full max-w-2xl grid-cols-3 gap-2 p-1">
        <TabsTrigger value="profile" className="py-2.5">
          {t("tabs.profile")}
        </TabsTrigger>
        <TabsTrigger value="create" className="py-2.5">
          {t("tabs.create")}
        </TabsTrigger>
        <TabsTrigger value="stickers" className="py-2.5">
          {t("tabs.stickers")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-0">
        <FinalExpenseLeaveBehindAgentProfilePanel onSaved={handleNewSticker} />
      </TabsContent>

      <TabsContent value="create" className="mt-0">
        <SaleStickerForm
          key={formKey}
          stickerId={activeSticker?.id ?? null}
          initialRecord={activeSticker}
          onStickerSaved={handleStickerSaved}
          onNewSticker={handleNewSticker}
          onRequireAgentProfile={goToProfile}
        />
      </TabsContent>

      <TabsContent value="stickers" className="mt-0">
        <SaleStickerListPanel
          selectedStickerId={activeSticker?.id ?? null}
          onSelectSticker={handleSelectSticker}
          onNewSticker={handleNewSticker}
          refreshKey={listRefreshKey}
        />
      </TabsContent>
    </Tabs>
    </>
  );
}

export default function SaleStickerHub() {
  return (
    <LeaveBehindAgentProfileProvider>
      <SaleStickerHubInner />
    </LeaveBehindAgentProfileProvider>
  );
}
