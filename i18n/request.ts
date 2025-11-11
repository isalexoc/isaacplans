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
    
    // Add more split file imports here as needed
    // Example:
    // try {
    //   const iulDataEntry = (await import(`@/messages/${locale}/iul/data-entry.json`)).default;
    //   Object.assign(splitMessages, iulDataEntry);
    // } catch {}
    
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
