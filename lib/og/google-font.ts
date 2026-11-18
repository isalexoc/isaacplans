/**
 * Loads a Google Font weight for next/og (Satori), any family. The same trick as `inter-font.ts`:
 * Satori takes TTF/OTF/WOFF but not WOFF2, and Google Fonts serves WOFF to an iOS 7 Safari user
 * agent. Cached per process. Throws on failure, so callers can fall back to Inter.
 */

const IOS7_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 7_0 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A465 Safari/9537.53";

const cache = new Map<string, ArrayBuffer>();

export async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const key = `${family}:${weight}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
    { headers: { "User-Agent": IOS7_SAFARI_UA } }
  );
  if (!cssRes.ok) throw new Error(`Google Fonts CSS fetch failed: ${cssRes.status}`);
  const fontUrl = (await cssRes.text()).match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!fontUrl) throw new Error(`No font URL for ${family} ${weight}`);

  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) throw new Error(`Font file fetch failed: ${fontRes.status}`);
  const data = await fontRes.arrayBuffer();
  cache.set(key, data);
  return data;
}
