import { toHTML, uriLooksSafe } from "@portabletext/to-html";

const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "anetxoet";

function sanityImageUrl(ref: string): string {
  // ref format: "image-abc123def-1200x630-jpg"
  const cleaned = ref
    .replace(/^image-/, "")
    .replace(/-(\w+)$/, ".$1")
    .replace(/-/g, "-");
  // Actually the ref format is "image-{id}-{dimensions}-{format}"
  // e.g. "image-abc123-1200x630-jpg" → "abc123-1200x630.jpg"
  const parts = ref.replace(/^image-/, "").split("-");
  const format = parts.pop();
  const id = parts.join("-");
  return `https://cdn.sanity.io/images/${SANITY_PROJECT_ID}/production/${id}.${format}`;
}

export function portableTextToEmailHtml(blocks: unknown[]): string {
  if (!blocks || blocks.length === 0) return "";

  return toHTML(blocks as any, {
    components: {
      block: {
        normal: ({ children }) =>
          `<p style="margin:0 0 16px 0;font-size:16px;color:#374151;line-height:1.7;">${children}</p>`,
        h1: ({ children }) =>
          `<h1 style="margin:28px 0 12px 0;font-size:28px;color:#111827;font-weight:700;line-height:1.3;">${children}</h1>`,
        h2: ({ children }) =>
          `<h2 style="margin:24px 0 12px 0;font-size:22px;color:#111827;font-weight:700;line-height:1.3;">${children}</h2>`,
        h3: ({ children }) =>
          `<h3 style="margin:20px 0 8px 0;font-size:18px;color:#111827;font-weight:600;line-height:1.4;">${children}</h3>`,
        h4: ({ children }) =>
          `<h4 style="margin:16px 0 8px 0;font-size:16px;color:#111827;font-weight:600;line-height:1.4;">${children}</h4>`,
        blockquote: ({ children }) =>
          `<blockquote style="border-left:3px solid #0077B6;padding:12px 16px;margin:16px 0;background:#f0f9ff;color:#374151;font-style:italic;">${children}</blockquote>`,
      },
      marks: {
        strong: ({ children }) =>
          `<strong style="font-weight:700;">${children}</strong>`,
        em: ({ children }) =>
          `<em style="font-style:italic;">${children}</em>`,
        code: ({ children }) =>
          `<code style="background:#f3f4f6;padding:2px 6px;border-radius:3px;font-family:monospace;font-size:14px;">${children}</code>`,
        link: ({ value, children }) => {
          const href = value?.href || "";
          if (!uriLooksSafe(href)) return `<span>${children}</span>`;
          const target = href.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
          return `<a href="${href}"${target} style="color:#0077B6;text-decoration:underline;">${children}</a>`;
        },
      },
      types: {
        image: ({ value }) => {
          const ref = value?.asset?._ref;
          if (!ref) return "";
          const src = sanityImageUrl(ref) + "?w=840&fit=max&auto=format&q=85";
          const alt = value?.alt || "";
          const captionHtml = value?.caption
            ? `<p style="margin:8px auto 0;font-size:13px;color:#6b7280;text-align:center;font-style:italic;max-width:420px;">${value.caption}</p>`
            : "";
          return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;"><tr><td align="center"><img src="${src}" alt="${alt}" style="max-width:420px;width:100%;height:auto;border-radius:10px;display:block;border:1px solid #e5e7eb;" />${captionHtml}</td></tr></table>`;
        },
      },
      hardBreak: () => "<br />",
      list: {
        bullet: ({ children }) =>
          `<ul style="margin:0 0 16px 0;padding-left:24px;color:#374151;font-size:16px;line-height:1.7;">${children}</ul>`,
        number: ({ children }) =>
          `<ol style="margin:0 0 16px 0;padding-left:24px;color:#374151;font-size:16px;line-height:1.7;">${children}</ol>`,
      },
      listItem: {
        bullet: ({ children }) =>
          `<li style="margin-bottom:6px;">${children}</li>`,
        number: ({ children }) =>
          `<li style="margin-bottom:6px;">${children}</li>`,
      },
    },
  });
}
