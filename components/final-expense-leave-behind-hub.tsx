"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinalExpenseLeaveBehindPackageForm from "@/components/final-expense-leave-behind-package-form";
import FinalExpenseLeaveBehindClientsPanel from "@/components/final-expense-leave-behind-clients-panel";
import FinalExpenseLeaveBehindAgentProfilePanel from "@/components/final-expense-leave-behind-agent-profile-panel";
import { FinalExpenseLeaveBehindOnboardingDialog } from "@/components/final-expense-leave-behind-onboarding-dialog";
import { LeaveBehindAgentProfileProvider } from "@/components/leave-behind/leave-behind-agent-profile-context";
import type { LeaveBehindClientRecord } from "@/lib/leave-behind-clients";
import { toPackageData } from "@/lib/leave-behind-package";
import type { PackageQuoteData } from "@/lib/leave-behind-clients";

type HubTab = "profile" | "package" | "clients";

function LeaveBehindHubInner() {
  const t = useTranslations("finalExpenseLeaveBehind");

  const [activeTab, setActiveTab] = useState<HubTab>("package");
  const [activeClient, setActiveClient] = useState<LeaveBehindClientRecord | null>(null);
  const [packageInitial, setPackageInitial] = useState<PackageQuoteData | null>(null);
  const [formKey, setFormKey] = useState("package-new");
  const [clientsRefreshKey, setClientsRefreshKey] = useState(0);

  const goToProfile = useCallback(() => setActiveTab("profile"), []);

  const handleNewClient = useCallback(() => {
    setActiveClient(null);
    setPackageInitial(null);
    setFormKey(`package-new-${Date.now()}`);
    setActiveTab("package");
  }, []);

  const handleSelectClient = useCallback((client: LeaveBehindClientRecord) => {
    setActiveClient(client);
    setPackageInitial(toPackageData(client.quoteType, client.quoteData));
    setFormKey(`package-${client.id}`);
    setActiveTab("package");
  }, []);

  const handleClientSaved = useCallback((client: LeaveBehindClientRecord) => {
    setActiveClient(client);
    setPackageInitial(toPackageData("package", client.quoteData));
    setClientsRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      <FinalExpenseLeaveBehindOnboardingDialog onGoToProfile={goToProfile} />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as HubTab)}
        className="w-full"
      >
        <TabsList className="mx-auto mb-8 grid h-auto w-full max-w-2xl grid-cols-3 gap-2 p-1">
          <TabsTrigger value="profile" className="py-2.5">
            {t("tabs.agentProfile")}
          </TabsTrigger>
          <TabsTrigger value="package" className="py-2.5">
            {t("tabs.clientPackage")}
          </TabsTrigger>
          <TabsTrigger value="clients" className="py-2.5">
            {t("clients.tab")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <FinalExpenseLeaveBehindAgentProfilePanel onSaved={handleNewClient} />
        </TabsContent>

        <TabsContent value="package" className="mt-0">
          <FinalExpenseLeaveBehindPackageForm
            key={formKey}
            clientId={activeClient?.id ?? null}
            initialData={packageInitial}
            onClientSaved={handleClientSaved}
            onNewQuote={handleNewClient}
            onRequireAgentProfile={goToProfile}
          />
        </TabsContent>

        <TabsContent value="clients" className="mt-0">
          <FinalExpenseLeaveBehindClientsPanel
            selectedClientId={activeClient?.id ?? null}
            onSelectClient={handleSelectClient}
            onNewClient={handleNewClient}
            refreshKey={clientsRefreshKey}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function FinalExpenseLeaveBehindHub() {
  return (
    <LeaveBehindAgentProfileProvider>
      <LeaveBehindHubInner />
    </LeaveBehindAgentProfileProvider>
  );
}
