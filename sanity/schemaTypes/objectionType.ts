import { CommentIcon } from '@sanity/icons'
import { defineType } from 'sanity'
import { field } from './iulPresentation/helpers'
import { scriptBlockArray } from './scriptPortableText'
import {
  OBJECTION_LOBS,
  OBJECTION_TYPES,
  OBJECTION_TYPE_LABELS,
  type ObjectionType,
} from '../../lib/objections/types'

/**
 * One objection, written once and shown wherever it applies.
 *
 * The library is shared rather than nested inside each presentationScript: "I can't afford it"
 * is the same objection on a Final Expense call and an IUL call, and duplicating it per product
 * means updating the same rebuttal in six places.
 *
 * Answers reuse `scriptBlockArray`, so an objection answer gets exactly the same toolbar as the
 * scripts — highlighters, "Say word for word", "Ask, then stop talking", "Agent note".
 */

const typeOptions = OBJECTION_TYPES.map((value) => ({
  title: OBJECTION_TYPE_LABELS[value].en,
  value,
}))

const lobOptions = OBJECTION_LOBS.map((lob) => ({ title: lob.title, value: lob.value }))

const LOB_SHORT: Record<string, string> = Object.fromEntries(
  OBJECTION_LOBS.map((lob) => [lob.value, lob.short])
)

export const objectionType = defineType({
  name: 'objection',
  title: 'Objection',
  type: 'document',
  icon: CommentIcon,
  groups: [
    { name: 'says', title: 'What they say', default: true },
    { name: 'answer', title: 'What you say' },
    { name: 'where', title: 'Where it shows up' },
  ],
  fields: [
    // ========== WHAT THEY SAY ==========
    field({
      name: 'titleEn',
      type: 'string',
      title: 'Objection (English)',
      description:
        "Short, in the client's own words. This is the whole card face. No quote marks needed — they are added automatically. e.g. I want to think about it",
      group: 'says',
      validation: (rule: any) =>
        rule.max(90).warning('Long titles wrap badly on the cards. Aim for under 90 characters.'),
    }),
    field({
      name: 'titleEs',
      type: 'string',
      title: 'Objection (Spanish)',
      description:
        'Lo mismo en español. Leave blank if this objection only ever comes up in English — the card simply will not appear in Spanish.',
      group: 'says',
      validation: (rule: any) =>
        rule.max(90).warning('Long titles wrap badly on the cards. Aim for under 90 characters.'),
    }),
    field({
      name: 'objectionType',
      type: 'string',
      title: 'Type',
      description: 'Groups the cards and colours the badge.',
      group: 'says',
      options: { list: typeOptions },
      initialValue: 'other',
      validation: (rule: any) => rule.required(),
    }),
    // Split by language on purpose: an English phrasing must never be matched against Spanish
    // speech. Costs one extra field now and saves a schema migration when live-call matching lands.
    field({
      name: 'triggersEn',
      type: 'array',
      title: 'Other ways they say it (English)',
      description:
        'Different ways a client phrases this, in their words — this is what Ctrl+K searches. e.g. mail me something, send me a brochure, put it in the mail. Never put client names or real premiums here; this content is publicly readable.',
      group: 'says',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    }),
    field({
      name: 'triggersEs',
      type: 'array',
      title: 'Other ways they say it (Spanish)',
      description:
        'Otras formas en que el cliente lo dice. e.g. mandame algo por correo, enviame informacion. Sin nombres de clientes ni primas reales.',
      group: 'says',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    }),

    // ========== WHAT YOU SAY ==========
    field({
      ...scriptBlockArray('answerEn', 'Answer (English)', {
        description: 'What you say back. Same toolbar as the scripts.',
      }),
      group: 'answer',
    }),
    field({
      ...scriptBlockArray('answerEs', 'Answer (Spanish)', {
        description: 'Lo que respondes. Mismas herramientas que los guiones.',
      }),
      group: 'answer',
    }),

    // ========== WHERE IT SHOWS UP ==========
    field({
      name: 'linesOfBusiness',
      type: 'array',
      title: 'Products',
      description:
        'Tick every product this objection applies to. Leave all boxes empty to show it on every product.',
      group: 'where',
      of: [{ type: 'string' }],
      options: { list: lobOptions, layout: 'grid' },
    }),
    field({
      name: 'order',
      type: 'number',
      title: 'Display order',
      description: 'Lower numbers come first. Ties fall back to when it was created.',
      group: 'where',
      initialValue: 0,
    }),
    field({
      name: 'status',
      type: 'string',
      title: 'Status',
      description: 'Only published objections appear on the presentations page.',
      group: 'where',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Published', value: 'published' },
        ],
      },
      initialValue: 'draft',
      validation: (rule: any) => rule.required(),
    }),
    field({
      name: 'updatedAt',
      type: 'datetime',
      title: 'Last Updated',
      group: 'where',
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: {
      titleEn: 'titleEn',
      titleEs: 'titleEs',
      objectionType: 'objectionType',
      lobs: 'linesOfBusiness',
      status: 'status',
    },
    prepare({
      titleEn,
      titleEs,
      objectionType: type,
      lobs,
      status,
    }: {
      titleEn?: string
      titleEs?: string
      objectionType?: string
      lobs?: string[]
      status?: string
    }) {
      // The language token is the point of this preview. English and Spanish do not line up in the
      // source content, so "which ones am I missing in Spanish?" is a real recurring question —
      // and this makes it answerable by scrolling the list.
      const hasEn = Boolean(titleEn?.trim())
      const hasEs = Boolean(titleEs?.trim())
      const langs = hasEn && hasEs ? 'EN+ES' : hasEn ? 'EN only' : hasEs ? 'ES only' : '⚠️ no title'

      // "All products" printed in full, so an untagged objection is obvious at a glance rather
      // than silently showing up everywhere.
      const products = lobs?.length
        ? lobs.map((lob) => LOB_SHORT[lob] ?? lob).join(', ')
        : 'All products'

      const typeLabel = OBJECTION_TYPE_LABELS[type as ObjectionType]?.en ?? type ?? 'Untyped'

      return {
        title: `${status === 'published' ? '✅' : '📝'} ${titleEn || titleEs || 'Untitled objection'}`,
        subtitle: `${typeLabel} · ${products} · ${langs}`,
      }
    },
  },
  orderings: [
    {
      title: 'Display order',
      name: 'order',
      by: [
        { field: 'order', direction: 'asc' },
        { field: 'titleEn', direction: 'asc' },
      ],
    },
    {
      title: 'Type',
      name: 'type',
      by: [
        { field: 'objectionType', direction: 'asc' },
        { field: 'order', direction: 'asc' },
      ],
    },
    { title: 'Title A–Z', name: 'title', by: [{ field: 'titleEn', direction: 'asc' }] },
    { title: 'Recently updated', name: 'updated', by: [{ field: 'updatedAt', direction: 'desc' }] },
  ],
})
