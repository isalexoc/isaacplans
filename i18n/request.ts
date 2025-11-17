import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

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
    
    // Load Glossary messages if they exist
    try {
      const glossary = (await import(`@/messages/${locale}/glossary.json`)).default;
      Object.assign(splitMessages, glossary);
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

  // Merge: split messages override main messages if there are conflicts
  // This way existing pages work, and new split files can extend/override
  const messages = {
    ...mainMessages,
    ...splitMessages,
  };

  return {
    locale,
    messages,
  };
});
