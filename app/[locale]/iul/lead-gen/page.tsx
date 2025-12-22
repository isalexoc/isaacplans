import { Metadata } from "next";
import IULLeadGenForm from "@/components/iul-lead-gen-form";
import IULLeadGenTracker from "@/components/iul-lead-gen-tracker";

export const metadata: Metadata = {
  title: "IUL Lead Generation - Get Your Free Quote | Isaac Plans",
  description:
    "Discover how Indexed Universal Life (IUL) insurance can help you build wealth and protect your family. Get your free quote today.",
  keywords: ["IUL", "Indexed Universal Life", "life insurance", "retirement planning", "wealth building"],
  openGraph: {
    title: "IUL Lead Generation - Get Your Free Quote",
    description:
      "Discover how Indexed Universal Life (IUL) insurance can help you build wealth and protect your family.",
    type: "website",
  },
};

export default function IULLeadGenPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <IULLeadGenTracker />
      
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] bg-clip-text text-transparent">
            Discover How IUL Can Transform Your Financial Future
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Answer a few quick questions to get personalized IUL recommendations and see how
            Indexed Universal Life insurance can help you build wealth while protecting your loved
            ones.
          </p>
        </div>

        {/* Form Section */}
        <div className="max-w-3xl mx-auto">
          <IULLeadGenForm />
        </div>

        {/* Trust Indicators */}
        <div className="max-w-4xl mx-auto mt-12 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="text-3xl font-bold text-[#0ea5e9] mb-2">100%</div>
              <p className="text-muted-foreground">Free Consultation</p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="text-3xl font-bold text-[#0ea5e9] mb-2">5 Min</div>
              <p className="text-muted-foreground">Quick Process</p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="text-3xl font-bold text-[#0ea5e9] mb-2">Expert</div>
              <p className="text-muted-foreground">Guidance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
