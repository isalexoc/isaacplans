import { type FieldDefinition } from 'sanity'

type FieldDef = FieldDefinition

// Sanity's defineField() generics fail on nested object/array fields in this
// repo's TS setup (see leadMagnetType.ts, which uses plain literals for the
// same reason). field() keeps the plain-literal convention behind one typed
// cast; Sanity validates the schema shape at Studio startup.
export function field(def: Record<string, unknown> & { name: string; type: string }): FieldDef {
  return def as unknown as FieldDef
}

/** EN + ES string pair, side by side (presentationScript convention). */
export function pairString(name: string, title: string): FieldDef[] {
  return [
    field({ name: `${name}En`, type: 'string', title: `${title} (EN)` }),
    field({ name: `${name}Es`, type: 'string', title: `${title} (ES)` }),
  ]
}

/** EN + ES multi-line text pair. */
export function pairText(name: string, title: string, rows = 3): FieldDef[] {
  return [
    field({ name: `${name}En`, type: 'text', title: `${title} (EN)`, rows }),
    field({ name: `${name}Es`, type: 'text', title: `${title} (ES)`, rows }),
  ]
}

/** EN + ES array-of-strings pair. */
export function pairStringArray(name: string, title: string): FieldDef[] {
  return [
    field({ name: `${name}En`, type: 'array', title: `${title} (EN)`, of: [{ type: 'string' }] }),
    field({ name: `${name}Es`, type: 'array', title: `${title} (ES)`, of: [{ type: 'string' }] }),
  ]
}

/** Image with localized alt-text fields. */
export function localizedImage(name: string, title: string): FieldDef {
  return field({
    name,
    type: 'image',
    title,
    options: { hotspot: true },
    fields: [
      field({ name: 'altEn', type: 'string', title: 'Alt Text (EN)' }),
      field({ name: 'altEs', type: 'string', title: 'Alt Text (ES)' }),
    ],
  })
}

/** Preview config for slide array items: shows the EN title + type label. */
export function slidePreview(typeLabel: string) {
  return {
    select: { title: 'titleEn', subtitle: 'subtitleEn' },
    prepare({ title, subtitle }: { title?: string; subtitle?: string }) {
      return {
        title: title || typeLabel,
        subtitle: subtitle ? `${typeLabel} — ${subtitle}` : typeLabel,
      }
    },
  }
}

export const collapsed = { collapsible: true, collapsed: true } as const
