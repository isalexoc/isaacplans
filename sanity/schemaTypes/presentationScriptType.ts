import {defineField, defineType} from 'sanity'

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
          { title: 'Short Term Medical', value: 'shortTermMedical' },
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
    
    // ========== SCRIPT SECTIONS ==========
    {
      name: 'openingIntroduction',
      type: 'object',
      title: 'Opening & Introduction',
      fields: [
        {
          name: 'contentEn',
          type: 'array',
          title: 'Content (English)',
          description: 'The script content in English',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'contentEs',
          type: 'array',
          title: 'Content (Spanish)',
          description: 'El contenido del guión en español',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'tipsEn',
          type: 'array',
          title: 'Tips (English)',
          description: 'Key tips and strategies in English',
          of: [{type: 'block'}],
        },
        {
          name: 'tipsEs',
          type: 'array',
          title: 'Tips (Spanish)',
          description: 'Consejos clave y estrategias en español',
          of: [{type: 'block'}],
        },
      ],
      validation: (rule: any) => rule.required(),
    },
    {
      name: 'discoveryQuestions',
      type: 'object',
      title: 'Discovery Questions & Qualification',
      fields: [
        {
          name: 'contentEn',
          type: 'array',
          title: 'Content (English)',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'contentEs',
          type: 'array',
          title: 'Content (Spanish)',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'tipsEn',
          type: 'array',
          title: 'Tips (English)',
          of: [{type: 'block'}],
        },
        {
          name: 'tipsEs',
          type: 'array',
          title: 'Tips (Spanish)',
          of: [{type: 'block'}],
        },
      ],
      validation: (rule: any) => rule.required(),
    },
    {
      name: 'productPresentation',
      type: 'object',
      title: 'Product Presentation',
      fields: [
        {
          name: 'contentEn',
          type: 'array',
          title: 'Content (English)',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'contentEs',
          type: 'array',
          title: 'Content (Spanish)',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'tipsEn',
          type: 'array',
          title: 'Tips (English)',
          of: [{type: 'block'}],
        },
        {
          name: 'tipsEs',
          type: 'array',
          title: 'Tips (Spanish)',
          of: [{type: 'block'}],
        },
      ],
      validation: (rule: any) => rule.required(),
    },
    {
      name: 'closingTechniques',
      type: 'object',
      title: 'Closing - Three Options',
      fields: [
        {
          name: 'contentEn',
          type: 'array',
          title: 'Content (English)',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'contentEs',
          type: 'array',
          title: 'Content (Spanish)',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'tipsEn',
          type: 'array',
          title: 'Tips (English)',
          of: [{type: 'block'}],
        },
        {
          name: 'tipsEs',
          type: 'array',
          title: 'Tips (Spanish)',
          of: [{type: 'block'}],
        },
      ],
      validation: (rule: any) => rule.required(),
    },
    {
      name: 'objectionHandling',
      type: 'object',
      title: 'Objection Handling',
      fields: [
        {
          name: 'contentEn',
          type: 'array',
          title: 'Content (English)',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'contentEs',
          type: 'array',
          title: 'Content (Spanish)',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'tipsEn',
          type: 'array',
          title: 'Tips (English)',
          of: [{type: 'block'}],
        },
        {
          name: 'tipsEs',
          type: 'array',
          title: 'Tips (Spanish)',
          of: [{type: 'block'}],
        },
      ],
      validation: (rule: any) => rule.required(),
    },
    {
      name: 'psychologySalesTips',
      type: 'object',
      title: 'Psychology & Sales Tips',
      fields: [
        {
          name: 'contentEn',
          type: 'array',
          title: 'Content (English)',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'contentEs',
          type: 'array',
          title: 'Content (Spanish)',
          of: [{type: 'block'}],
          validation: (rule: any) => rule.required(),
        },
        {
          name: 'tipsEn',
          type: 'array',
          title: 'Tips (English)',
          of: [{type: 'block'}],
        },
        {
          name: 'tipsEs',
          type: 'array',
          title: 'Tips (Spanish)',
          of: [{type: 'block'}],
        },
      ],
      validation: (rule: any) => rule.required(),
    },
    
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
        'shortTermMedical': 'Short Term Medical',
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

