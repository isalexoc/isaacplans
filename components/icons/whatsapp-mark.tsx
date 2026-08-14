import {
  WHATSAPP_GLYPH_PATH,
  WHATSAPP_GLYPH_VIEWBOX,
  WHATSAPP_GREEN,
} from "@/lib/whatsapp-mark";

/**
 * The WhatsApp mark for on-screen use — admin toggles and the label preview.
 *
 * Same path data the printed PDFs draw (lib/whatsapp-mark.ts), so the preview shows the glyph
 * that actually comes out of the printer. lucide-react carries no brand marks, which is why this
 * exists rather than an icon import.
 */
export function WhatsAppMark({
  size = 16,
  color = WHATSAPP_GREEN,
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={WHATSAPP_GLYPH_VIEWBOX}
      width={size}
      height={size}
      fill={color}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={WHATSAPP_GLYPH_PATH} />
    </svg>
  );
}
