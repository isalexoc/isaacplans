/**
 * Resolved layout for the Priority Mail label — which lines print, and at what size.
 *
 * Lives outside both renderers because the PDF (lib/mailing-labels/pdf.tsx) and the on-screen
 * preview (components/admin/mailing-labels/label-preview.tsx) have to agree exactly: the preview
 * is the only check the admin gets before paying for a sheet of label stock.
 *
 * The auto-fit is the same trick the Avery stickers use — an address that would overflow steps
 * down half a point at a time instead of wrapping. That matters more here than on a sticker: this
 * label gets trimmed and pasted into the white area of a USPS Label 228 tag, and a surprise second
 * line pushes the block past the space that tag leaves.
 */

import { formatAddressBlock, senderNameLines, uspsLine } from "./format";
import { fitFontSize } from "./metrics";
import type { ShippingPreset } from "./presets";
import { SENIOR_LIFE_LOGO_ASPECT, SHIPPING_TYPE_SCALE } from "./theme";
import type { MailingLabelRecord, SenderAddress } from "./types";

export type ShippingLayout = {
  /** Return address, already uppercased and in print order. */
  fromLines: string[];
  from: { size: number };
  to: { nameLine: string; nameSize: number; addressSize: number };
  /** Street, optional unit, and CITY ST ZIP — the optional line is dropped, not left empty. */
  toAddressLines: string[];
};

export function shippingLayout({
  record,
  sender,
  preset,
  hasLogo,
}: {
  record: MailingLabelRecord;
  sender: SenderAddress;
  preset: ShippingPreset;
  hasLogo: boolean;
}): ShippingLayout {
  const scale = SHIPPING_TYPE_SCALE[preset.id as keyof typeof SHIPPING_TYPE_SCALE];
  const from = formatAddressBlock(sender);
  const to = formatAddressBlock(record);

  const fromLines = [
    ...senderNameLines(sender),
    from.line1,
    from.line2,
    from.cityStateZip,
    uspsLine(sender.phone),
  ].filter((line): line is string => Boolean(line));

  const toAddressLines = [to.line1, to.line2, to.cityStateZip].filter(
    (line): line is string => Boolean(line)
  );

  // The logo sits beside the return address, so it eats into the width that block gets to use.
  const contentWidth = preset.pageWidth - scale.pad * 2;
  const logoWidth = hasLogo ? scale.logoHeight * SENIOR_LIFE_LOGO_ASPECT + scale.logoGap : 0;
  const fromWidth = contentWidth - logoWidth;
  const toWidth = contentWidth - scale.toIndent;

  return {
    fromLines,
    from: { size: fitFontSize(fromLines, fromWidth, scale.fromSize, scale.fromSizeMin) },
    to: {
      nameLine: to.nameLine,
      nameSize: fitFontSize([to.nameLine], toWidth, scale.toNameSize, scale.toSizeMin, {
        bold: true,
      }),
      addressSize: fitFontSize(toAddressLines, toWidth, scale.toAddressSize, scale.toSizeMin),
    },
    toAddressLines,
  };
}
