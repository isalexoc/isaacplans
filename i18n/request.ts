import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/** Deep-merge message trees so split files can patch nested keys without replacing whole namespaces. */
function deepMergeMessages(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const sVal = source[key];
    const tVal = target[key];
    if (Array.isArray(sVal) || Array.isArray(tVal)) {
      if (sVal !== undefined) out[key] = sVal;
      continue;
    }
    if (
      sVal &&
      typeof sVal === "object" &&
      tVal &&
      typeof tVal === "object"
    ) {
      out[key] = deepMergeMessages(
        tVal as Record<string, unknown>,
        sVal as Record<string, unknown>
      );
    } else if (sVal !== undefined) {
      out[key] = sVal;
    }
  }
  return out;
}

// Helper function to recursively load all JSON files from a directory
async function loadSplitMessages(locale: string): Promise<Record<string, any>> {
  const splitMessages: Record<string, any> = {};
  
  try {
    // Try to load split messages from messages/{locale}/ folder
    // This uses dynamic imports to handle the folder structure
    const splitPath = `@/messages/${locale}`;
    
    // Load IUL presentation messages if they exist
    try {
      const iulPresentation = (await import(`@/messages/${locale}/iul/presentation.json`)).default;
      Object.assign(splitMessages, iulPresentation);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load IUL application messages if they exist
    try {
      const iulApplication = (await import(`@/messages/${locale}/iul/application.json`)).default;
      Object.assign(splitMessages, iulApplication);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load IUL referrals messages if they exist
    try {
      const iulReferrals = (await import(`@/messages/${locale}/iul/referrals.json`)).default;
      Object.assign(splitMessages, iulReferrals);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load IUL quote messages if they exist
    try {
      const iulQuote = (await import(`@/messages/${locale}/iul/quote.json`)).default;
      Object.assign(splitMessages, iulQuote);
    } catch {
      // File doesn't exist, skip
    }

    // Load Final Expense presentation messages if they exist
    try {
      const fePresentation = (await import(`@/messages/${locale}/final-expense/presentation.json`)).default;
      Object.assign(splitMessages, fePresentation);
    } catch {
      // File doesn't exist, skip
    }

    // Load Final Expense qualification messages if they exist
    try {
      const feQualification = (await import(`@/messages/${locale}/final-expense/qualification.json`)).default;
      Object.assign(splitMessages, feQualification);
    } catch {
      // File doesn't exist, skip
    }

    // Load Final Expense referrals messages if they exist
    try {
      const feReferrals = (await import(`@/messages/${locale}/final-expense/referrals.json`)).default;
      Object.assign(splitMessages, feReferrals);
    } catch {
      // File doesn't exist, skip
    }

    // Load Final Expense leave-behind messages if they exist
    try {
      const feLeaveBehind = (await import(`@/messages/${locale}/final-expense/leave-behind.json`)).default;
      Object.assign(splitMessages, feLeaveBehind);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load FAQ messages if they exist
    try {
      const faq = (await import(`@/messages/${locale}/faq.json`)).default;
      Object.assign(splitMessages, faq);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load Testimonials messages if they exist
    try {
      const testimonials = (await import(`@/messages/${locale}/testimonials.json`)).default;
      Object.assign(splitMessages, testimonials);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load Consumer Guides messages if they exist
    try {
      const consumerGuides = (await import(`@/messages/${locale}/consumer-guides.json`)).default;
      Object.assign(splitMessages, consumerGuides);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load Glossary messages if they exist
    try {
      const glossary = (await import(`@/messages/${locale}/glossary.json`)).default;
      Object.assign(splitMessages, glossary);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load Subsidy Calculator messages if they exist
    try {
      const subsidyCalculator = (await import(`@/messages/${locale}/subsidy-calculator.json`)).default;
      Object.assign(splitMessages, subsidyCalculator);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load Plan Comparison messages if they exist
    try {
      const planComparison = (await import(`@/messages/${locale}/plan-comparison.json`)).default;
      Object.assign(splitMessages, planComparison);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load Renewal Support messages if they exist
    try {
      const renewalSupport = (await import(`@/messages/${locale}/renewal-support.json`)).default;
      Object.assign(splitMessages, renewalSupport);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load Consumer Guides messages if they exist
    try {
      const consumerGuides = (await import(`@/messages/${locale}/consumer-guides.json`)).default;
      Object.assign(splitMessages, consumerGuides);
    } catch {
      // File doesn't exist, skip
    }
    
    // Load Presentations messages if they exist
    try {
      const presentations = (await import(`@/messages/${locale}/presentations.json`)).default;
      Object.assign(splitMessages, presentations);
    } catch {
      // File doesn't exist, skip
    }

    // Manhattan STM carrier page — nested patches (must merge deep; see deepMergeMessages)
    try {
      const manhattanStm = (await import(`@/messages/${locale}/carriers/manhattan-stm.json`))
        .default;
      Object.assign(splitMessages, manhattanStm);
    } catch {
      // File doesn't exist, skip
    }

    try {
      const uhoneHub = (await import(`@/messages/${locale}/uhone-hub.json`)).default;
      Object.assign(splitMessages, uhoneHub);
    } catch {
      // File doesn't exist, skip
    }

    // Header Services → Carriers (merged deeply with main locale JSON)
    try {
      const headerCarriers = (
        await import(`@/messages/${locale}/header-services-carriers.json`)
      ).default;
      Object.assign(splitMessages, headerCarriers);
    } catch {
      // File doesn't exist, skip
    }

  } catch (error) {
    // If split folder doesn't exist, continue with main messages only
    console.warn(`No split messages found for locale ${locale}`);
  }
  
  return splitMessages;
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  // Load existing single-file messages (keeps all current pages working)
  const mainMessages = (await import(`@/messages/${locale}.json`)).default;

  // Load split messages from messages/{locale}/ folder (for new content)
  const splitMessages = await loadSplitMessages(locale);

  // Merge: split messages override main messages (deep merge so nested keys like
  // manhattan.shortterm are patched, not replaced wholesale).
  const messages = deepMergeMessages(
    mainMessages as Record<string, unknown>,
    splitMessages as Record<string, unknown>
  ) as typeof mainMessages;

  return {
    locale,
    messages,
  };
});
