/**
 * Loads Inter font weights for next/og (Satori) image rendering.
 *
 * Satori's bundled opentype.js accepts TTF, OTF, and WOFF with a TrueType
 * flavor — but NOT WOFF2 or EOT. Google Fonts returns WOFF (not WOFF2) when the
 * request looks like iOS 7 Safari, and Inter uses TrueType outlines, so its WOFF
 * flavor byte passes. We spoof that UA to get an accepted file.
 *
 * Weights are cached per-process across requests.
 */

const IOS7_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 7_0 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A465 Safari/9537.53";

const cache = new Map<number, ArrayBuffer>();

export async function loadInterFont(weight: number): Promise<ArrayBuffer> {
  const cached = cache.get(weight);
  if (cached) return cached;

  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&display=swap`,
    { headers: { "User-Agent": IOS7_SAFARI_UA } }
  );
  if (!cssRes.ok) throw new Error(`Google Fonts CSS fetch failed: ${cssRes.status}`);
  const css = await cssRes.text();

  const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!fontUrl) throw new Error("Could not parse font URL from Google Fonts CSS response");

  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) throw new Error(`Font file fetch failed: ${fontRes.status}`);

  const data = await fontRes.arrayBuffer();
  cache.set(weight, data);
  return data;
}
