import { defineField, defineType } from 'sanity'
import { DocumentTextIcon } from '@sanity/icons'

export const leadMagnetType = defineType({
  name: 'leadMagnet',
  title: 'Lead Magnet',
  type: 'document',
  icon: DocumentTextIcon,
  groups: [
    { name: 'identity', title: 'Identity' },
    { name: 'content', title: 'Content' },
    { name: 'leadForm', title: 'Lead Form' },
    { name: 'seo', title: 'SEO' },
    { name: 'generation', title: 'Generation' },
    { name: 'dates', title: 'Dates' },
  ],
  fields: [
    // ========== IDENTITY ==========
    defineField({
      name: 'title',
      type: 'string',
      title: 'Title',
      group: 'identity',
      validation: (rule) => rule.required().max(70).warning('Keep titles under 70 characters'),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'URL Slug',
      group: 'identity',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'locale',
      type: 'string',
      title: 'Language',
      group: 'identity',
      options: {
        list: [
          { title: 'English', value: 'en' },
          { title: 'Spanish', value: 'es' },
        ],
      },
      initialValue: 'en',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      type: 'string',
      title: 'Category',
      group: 'identity',
      options: {
        list: [
          { title: 'ACA / Health Insurance', value: 'aca' },
          { title: 'Temporary Health Insurance', value: 'temporary-health-insurance' },
          { title: 'Dental & Vision', value: 'dental-vision' },
          { title: 'Hospital Indemnity', value: 'hospital-indemnity' },
          { title: 'IUL (Life Insurance)', value: 'iul' },
          { title: 'Final Expense', value: 'final-expense' },
          { title: 'Cancer Plans', value: 'cancer-plans' },
          { title: 'Heart & Stroke', value: 'heart-stroke' },
          { title: 'General Insurance', value: 'general' },
          { title: 'Tips & Guides', value: 'tips-guides' },
          { title: 'News', value: 'news' },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      type: 'string',
      title: 'Status',
      group: 'identity',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Published', value: 'published' },
          { title: 'Archived', value: 'archived' },
        ],
      },
      initialValue: 'draft',
      validation: (rule) => rule.required(),
    }),
    {
      name: 'relatedGuide',
      type: 'reference',
      title: 'Related Guide (Other Language)',
      group: 'identity',
      to: [{ type: 'leadMagnet' }],
      description: 'Link to the same guide in the other language',
    },

    // ========== CONTENT ==========
    defineField({
      name: 'subtitle',
      type: 'string',
      title: 'Subtitle',
      group: 'content',
      description: 'One-line hook shown on the landing page hero',
      validation: (rule) => rule.required().max(160).warning('Keep under 160 characters'),
    }),
    {
      name: 'description',
      type: 'array',
      title: 'Description',
      group: 'content',
      description: 'Landing page body copy — explain who the guide is for and why it matters',
      of: [{ type: 'block' }],
    },
    {
      name: 'coverImage',
      type: 'image',
      title: 'Cover Image',
      group: 'content',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alt Text',
          validation: (rule: any) => rule.required(),
        },
      ],
    },
    {
      name: 'sections',
      type: 'array',
      title: 'Sections',
      group: 'content',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'sectionTitle',
              type: 'string',
              title: 'Section Title',
              validation: (rule: any) => rule.required(),
            },
            {
              name: 'content',
              type: 'array',
              title: 'Content',
              of: [{ type: 'block' }],
            },
            {
              name: 'sectionImage',
              type: 'image',
              title: 'Section Image',
              options: { hotspot: true },
              fields: [
                {
                  name: 'alt',
                  type: 'string',
                  title: 'Alt Text',
                },
              ],
            },
          ],
          preview: {
            select: { title: 'sectionTitle' },
            prepare: ({ title }: { title?: string }) => ({
              title: title ?? 'Untitled Section',
            }),
          },
        },
      ],
    },
    {
      name: 'keyBenefits',
      type: 'array',
      title: 'Key Benefits',
      group: 'content',
      description: '"What you\'ll learn" bullets on the landing page',
      of: [{ type: 'string' }],
    },
    defineField({
      name: 'targetAudience',
      type: 'string',
      title: 'Target Audience',
      group: 'content',
      description: 'Who this guide is written for — used in landing page copy and AI generation',
    }),

    // ========== LEAD FORM ==========
    {
      name: 'leadFormSettings',
      type: 'object',
      title: 'Lead Form Settings',
      group: 'leadForm',
      fields: [
        {
          name: 'ctaHeadline',
          type: 'string',
          title: 'CTA Headline',
          initialValue: 'Get Your Free Guide',
        },
        {
          name: 'ctaSubtext',
          type: 'string',
          title: 'CTA Subtext',
          initialValue: 'Enter your info below to download instantly — no spam, ever.',
        },
        {
          name: 'ctaButtonText',
          type: 'string',
          title: 'CTA Button Text',
          initialValue: 'Download Free Guide',
        },
        {
          name: 'successMessage',
          type: 'string',
          title: 'Success Message',
          initialValue: 'Your guide is downloading now!',
        },
        {
          name: 'agentCrmWorkflowId',
          type: 'string',
          title: 'Agent CRM Workflow ID',
          description: 'Optional: override default Agent CRM workflow for this guide',
        },
      ],
    },

    // ========== SEO ==========
    {
      name: 'seo',
      type: 'object',
      title: 'SEO Settings',
      group: 'seo',
      fields: [
        {
          name: 'metaTitle',
          type: 'string',
          title: 'Meta Title',
          validation: (rule: any) => rule.max(60).warning('Keep meta titles under 60 characters'),
        },
        {
          name: 'metaDescription',
          type: 'text',
          title: 'Meta Description',
          rows: 3,
          validation: (rule: any) =>
            rule
              .min(120)
              .warning('Meta descriptions should be at least 120 characters')
              .max(160)
              .warning('Keep meta descriptions under 160 characters'),
        },
        {
          name: 'focusKeyword',
          type: 'string',
          title: 'Focus Keyword',
        },
        {
          name: 'keywords',
          type: 'array',
          title: 'Additional Keywords',
          of: [{ type: 'string' }],
          options: { layout: 'tags' },
        },
      ],
    },

    // ========== GENERATION METADATA ==========
    defineField({
      name: 'generationPrompt',
      type: 'text',
      title: 'Generation Prompt',
      group: 'generation',
      description: 'Original JSON prompt input — stored for audit and regeneration',
      readOnly: true,
    }),
    defineField({
      name: 'generatedPdfUrl',
      type: 'url',
      title: 'Generated PDF URL',
      group: 'generation',
      description: 'Cloudinary URL of the generated PDF',
      readOnly: true,
    }),
    defineField({
      name: 'pdfGeneratedAt',
      type: 'datetime',
      title: 'PDF Generated At',
      group: 'generation',
      readOnly: true,
    }),
    defineField({
      name: 'downloadCount',
      type: 'number',
      title: 'Download Count',
      group: 'generation',
      initialValue: 0,
      readOnly: true,
    }),
    {
      name: 'promoImages',
      type: 'object',
      title: 'Promo / Social Images',
      group: 'generation',
      description: 'Auto-generated social media cards (Cloudinary URLs — use in Meta Ads, social schedulers, DMs)',
      fields: [
        defineField({ name: 'square',    type: 'url', title: 'Square 1080×1080 (Instagram)' }),
        defineField({ name: 'landscape', type: 'url', title: 'Landscape 1200×630 (Facebook / LinkedIn)' }),
      ],
    },

    // ========== DATES ==========
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      title: 'Published Date',
      group: 'dates',
    }),
    defineField({
      name: 'updatedAt',
      type: 'datetime',
      title: 'Last Updated',
      group: 'dates',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'category',
      media: 'coverImage',
    },
    prepare({ title, subtitle, media }) {
      return {
        title: (title as string | undefined) ?? 'Untitled Lead Magnet',
        subtitle: subtitle ? `[${subtitle}]` : 'No category',
        media,
      }
    },
  },
  orderings: [
    {
      title: 'Published Date, Newest',
      name: 'publishedAtDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
    {
      title: 'Status',
      name: 'status',
      by: [{ field: 'status', direction: 'asc' }],
    },
  ],
})
