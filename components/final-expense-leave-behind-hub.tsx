"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinalExpenseLeaveBehindForm from "@/components/final-expense-leave-behind-form";
import FinalExpenseLeaveBehindCompareForm from "@/components/final-expense-leave-behind-compare-form";

export default function FinalExpenseLeaveBehindHub() {
  const t = useTranslations("finalExpenseLeaveBehind");

  return (
    <Tabs defaultValue="single" className="w-full">
      <TabsList className="mx-auto mb-8 grid h-auto w-full max-w-lg grid-cols-1 gap-2 p-1 sm:grid-cols-2">
        <TabsTrigger value="single" className="py-2.5">
          {t("tabs.singleQuote")}
        </TabsTrigger>
        <TabsTrigger value="compare" className="py-2.5">
          {t("tabs.comparePlans")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="single" className="mt-0">
        <FinalExpenseLeaveBehindForm />
      </TabsContent>
      <TabsContent value="compare" className="mt-0">
        <FinalExpenseLeaveBehindCompareForm />
      </TabsContent>
    </Tabs>
  );
}
