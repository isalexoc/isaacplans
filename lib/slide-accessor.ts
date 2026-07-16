/**
 * Tiny lookup shim that mimics next-intl's `t()` / `t.raw()` API over a plain
 * data object. Lets the IUL slide components read Sanity-mapped content with
 * the same call sites they used for message JSON.
 */
export interface SlideAccessor {
  (key: string): string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches next-intl's t.raw() contract the slide components were written against
  raw: (key: string) => any;
}

export function createAccessor(data: Record<string, unknown> | undefined): SlideAccessor {
  const get = (key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>((value, part) => (value as Record<string, unknown> | undefined)?.[part], data);

  const t = ((key: string): string => {
    const value = get(key);
    if (typeof value === "string") return value;
    return value == null ? "" : String(value);
  }) as SlideAccessor;

  t.raw = get;
  return t;
}
