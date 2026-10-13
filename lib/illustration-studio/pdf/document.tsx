/** @jsxRuntime automatic */
/**
 * The two-page summary document. Built-in Helvetica throughout (it's also NLG's face): no
 * Font.register, so no font fetch at render time and nothing to fail.
 */

import { Document, Font } from "@react-pdf/renderer";
import type { PresentationData } from "../types";
import { CoverPage } from "./cover-page";
import { OffersPage } from "./offers-page";
import type { SummaryAssets } from "./theme";

// Never hyphenate (same reason as lib/mailing-labels/pdf.tsx): a split "Indexed Uni-versal" or
// "Rodrí-guez" reads as broken. Long text is sized to fit instead.
Font.registerHyphenationCallback((word) => [word]);

export function IllustrationSummaryDocument({ presentation, assets }: { presentation: PresentationData; assets: SummaryAssets }) {
  const title = [presentation.carrierDisplayName, presentation.productName, presentation.clientName]
    .filter(Boolean)
    .join(" · ");
  return (
    <Document title={title || "Illustration summary"} author={presentation.presentedBy.name} creator="Isaac Plans Insurance">
      <CoverPage presentation={presentation} assets={assets} />
      <OffersPage presentation={presentation} assets={assets} />
    </Document>
  );
}
