import {defineField, defineType} from 'sanity'
import {scriptBlockArray} from './scriptPortableText'

/**
 * One collapsible script section (Opening, Discovery, ...). Every section has the
 * same four rich-text fields, all sharing the toolbar defined in
 * ./scriptPortableText.tsx.
 *
 * Plain object literal rather than defineField() — see the note on
 * scriptBlockArray() for why defineField cannot type these array fields.
 */
function scriptSection(name: string, title: string) {
  return {
    name,
    type: 'object' as const,
    title,
    fields: [
      scriptBlockArray('contentEn', 'Content (English)', {
        description: 'The script content in English',
        required: true,
      }),
      scriptBlockArray('contentEs', 'Content (Spanish)', {
        description: 'El contenido del guión en español',
        required: true,
      }),
      scriptBlockArray('tipsEn', 'Tips (English)', {
        description: 'Key tips and strategies in English',
      }),
      scriptBlockArray('tipsEs', 'Tips (Spanish)', {
        description: 'Consejos clave y estrategias en español',
      }),
    ],
    validation: (rule: any) => rule.required(),
  }
}

export const presentationScriptType = defineType({
  name: 'presentationScript',
  title: 'Presentation Script',
  type: 'document',
  fields: [
    // ========== BASIC INFO ==========
    defineField({
      name: 'lineOfBusiness',
      type: 'string',
      title: 'Line of Business',
      description: 'Select the line of business this script is for',
      options: {
        list: [
          { title: 'IUL (Indexed Universal Life)', value: 'iul' },
          { title: 'ACA / Obamacare', value: 'aca' },
          { title: 'Dental & Vision', value: 'dentalVision' },
          { title: 'Hospital Indemnity', value: 'hospitalIndemnity' },
          { title: 'Final Expense / Burial', value: 'finalExpense' },
          { title: 'Temporary health insurance', value: 'shortTermMedical' },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      type: 'string',
      title: 'Title',
      description: 'Internal title for this script (e.g., "Final Expense - Complete Script")',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      type: 'text',
      title: 'Description',
      description: 'Brief description of this script',
      rows: 2,
    } as any),
    {
      name: 'completeScript',
      type: 'object' as const,
      title: 'Complete Script (All-in-One)',
      description: 'A compressed version of the entire script in one place for quick reference',
      fields: [
        scriptBlockArray('contentEn', 'Complete Script (English)', {
          description: 'The entire script compressed into one document in English',
        }),
        scriptBlockArray('contentEs', 'Complete Script (Spanish)', {
          description: 'El guión completo comprimido en un solo documento en español',
        }),
      ],
    },

    // ========== SCRIPT SECTIONS ==========
    scriptSection('openingIntroduction', 'Opening & Introduction'),
    scriptSection('discoveryQuestions', 'Discovery Questions & Qualification'),
    scriptSection('productPresentation', 'Product Presentation'),
    scriptSection('closingTechniques', 'Closing - Three Options'),
    scriptSection('objectionHandling', 'Objection Handling'),
    scriptSection('psychologySalesTips', 'Psychology & Sales Tips'),

    // ========== PUBLISHING ==========
    defineField({
      name: 'status',
      type: 'string',
      title: 'Status',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Published', value: 'published' },
        ],
      },
      initialValue: 'draft',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      type: 'datetime',
      title: 'Last Updated',
      description: 'When was this script last updated?',
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      lineOfBusiness: 'lineOfBusiness',
      status: 'status',
    },
    prepare({ title, lineOfBusiness, status }) {
      const statusEmoji = status === 'published' ? '✅' : '📝';
      const lobLabels: Record<string, string> = {
        'iul': 'IUL',
        'aca': 'ACA',
        'dentalVision': 'Dental & Vision',
        'hospitalIndemnity': 'Hospital Indemnity',
        'finalExpense': 'Final Expense',
        'shortTermMedical': 'Temporary health insurance',
      };
      const lobLabel = lobLabels[lineOfBusiness] || lineOfBusiness;
      return {
        title: `${statusEmoji} ${title || 'Untitled Script'}`,
        subtitle: `Line of Business: ${lobLabel}`,
      }
    },
  },
  orderings: [
    {
      title: 'Line of Business',
      name: 'lineOfBusiness',
      by: [{field: 'lineOfBusiness', direction: 'asc'}],
    },
    {
      title: 'Last Updated, Newest',
      name: 'updatedAtDesc',
      by: [{field: 'updatedAt', direction: 'desc'}],
    },
    {
      title: 'Status',
      name: 'status',
      by: [{field: 'status', direction: 'asc'}],
    },
  ],
})
