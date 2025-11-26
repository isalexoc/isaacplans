import {defineField, defineType} from 'sanity'

export const postType = defineType({
  name: 'post',
  title: 'Blog Post',
  type: 'document',
  fields: [
    // ========== BASIC INFO ==========
    defineField({
      name: 'locale',
      type: 'string',
      title: 'Language',
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
      name: 'title',
      type: 'string',
      title: 'Title',
      validation: (rule) => rule.required().max(70).warning('SEO: Keep titles under 70 characters'),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'URL Slug',
      options: {source: 'title'},
      validation: (rule) => rule.required(),
    }),
    
    // ========== CATEGORIZATION ==========
    defineField({
      name: 'category',
      type: 'string',
      title: 'Primary Category (LOB)',
      description: 'Main line of business this post relates to',
      options: {
        list: [
          { title: 'ACA / Obamacare', value: 'aca' },
          { title: 'Short Term Medical', value: 'short-term-medical' },
          { title: 'Dental & Vision', value: 'dental-vision' },
          { title: 'Hospital Indemnity', value: 'hospital-indemnity' },
          { title: 'IUL (Indexed Universal Life)', value: 'iul' },
          { title: 'Final Expense / Burial', value: 'final-expense' },
          { title: 'Cancer Plans', value: 'cancer-plans' },
          { title: 'Heart Attack & Stroke Plans', value: 'heart-stroke' },
          { title: 'General Insurance', value: 'general' },
          { title: 'Insurance Tips & Guides', value: 'tips-guides' },
          { title: 'Industry News', value: 'news' },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    {
      name: 'tags',
      type: 'array',
      title: 'Tags',
      description: 'Additional tags for better organization and SEO',
      of: [{type: 'string'}],
      options: {
        layout: 'tags',
      },
    },
    defineField({
      name: 'featured',
      type: 'boolean',
      title: 'Featured Post',
      description: 'Show this post prominently on the blog homepage',
      initialValue: false,
    }),
    
    // ========== CONTENT ==========
    {
      name: 'excerpt',
      type: 'text',
      title: 'Excerpt / Summary',
      description: 'Short summary for blog listings and meta descriptions (150-160 characters recommended)',
      rows: 3,
      validation: (rule) => rule.max(200).warning('Keep excerpts under 200 characters for best results'),
    },
    {
      name: 'body',
      type: 'array',
      title: 'Content',
      of: [
        {type: 'block'},
        {
          type: 'image',
          fields: [
            {
              name: 'alt',
              type: 'string',
              title: 'Alt Text',
              description: 'Important for SEO and accessibility',
            },
            {
              name: 'caption',
              type: 'string',
              title: 'Caption',
            },
          ],
        },
      ],
    },
    defineField({
      name: 'author',
      type: 'string',
      title: 'Author',
      initialValue: 'Isaac Orraiz',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'readingTime',
      type: 'number',
      title: 'Reading Time (minutes)',
      description: 'Estimated reading time - will be auto-calculated if left empty',
    }),
    
    // ========== IMAGES ==========
    {
      name: 'image',
      type: 'image',
      title: 'Featured Image',
      description: 'Main image for the blog post (1200x630px recommended for social sharing)',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alt Text',
          description: 'Describe the image for SEO and accessibility',
          validation: (rule: any) => rule.required(),
        },
      ],
    },
    {
      name: 'ogImage',
      type: 'image',
      title: 'Social Sharing Image (Optional)',
      description: 'Custom image for social media (overrides featured image if set)',
      options: {
        hotspot: true,
      },
    },
    
    // ========== SEO FIELDS ==========
    {
      name: 'seo',
      type: 'object',
      title: 'SEO Settings',
      fields: [
        {
          name: 'metaTitle',
          type: 'string',
          title: 'Meta Title',
          description: 'Custom title for search engines (defaults to post title if empty)',
          validation: (rule: any) => rule.max(60).warning('SEO: Keep meta titles under 60 characters'),
        },
        {
          name: 'metaDescription',
          type: 'text',
          title: 'Meta Description',
          description: 'Description shown in search results (150-160 characters recommended)',
          rows: 3,
          validation: (rule: any) => 
            rule
              .max(160)
              .warning('SEO: Keep meta descriptions under 160 characters')
              .min(120)
              .warning('SEO: Meta descriptions should be at least 120 characters'),
        },
        {
          name: 'focusKeyword',
          type: 'string',
          title: 'Focus Keyword',
          description: 'Primary keyword you want to rank for',
        },
        {
          name: 'keywords',
          type: 'array',
          title: 'Additional Keywords',
          of: [{type: 'string'}],
          options: {
            layout: 'tags',
          },
        },
        {
          name: 'canonicalUrl',
          type: 'url',
          title: 'Canonical URL',
          description: 'If this content is republished, link to the original',
        },
      ],
    },
    
    // ========== LEAD CAPTURE ==========
    {
      name: 'leadCapture',
      type: 'object',
      title: 'Lead Capture Settings',
      fields: [
        {
          name: 'enableCTA',
          type: 'boolean',
          title: 'Enable Call-to-Action',
          description: 'Show CTA in this post',
          initialValue: false,
        },
        {
          name: 'ctaType',
          type: 'string',
          title: 'CTA Type',
          options: {
            list: [
              { title: 'Free Quote', value: 'quote' },
              { title: 'Schedule Consultation', value: 'consultation' },
              { title: 'Download Guide', value: 'guide' },
              { title: 'Contact Form', value: 'contact' },
              { title: 'Custom Link', value: 'custom' },
            ],
          },
          hidden: ({parent}: any) => !parent?.enableCTA,
        },
        {
          name: 'ctaText',
          type: 'string',
          title: 'CTA Button Text',
          description: 'Text for the call-to-action button',
          hidden: ({parent}: any) => !parent?.enableCTA,
        },
        {
          name: 'ctaLink',
          type: 'string',
          title: 'CTA Link',
          description: 'URL or route for the CTA (e.g., /contact, /aca)',
          hidden: ({parent}: any) => !parent?.enableCTA || parent?.ctaType !== 'custom',
        },
        {
          name: 'ctaPosition',
          type: 'string',
          title: 'CTA Position',
          options: {
            list: [
              { title: 'Top of Post', value: 'top' },
              { title: 'Middle of Post', value: 'middle' },
              { title: 'Bottom of Post', value: 'bottom' },
              { title: 'Floating (sticky)', value: 'floating' },
            ],
          },
          initialValue: 'bottom',
          hidden: ({parent}: any) => !parent?.enableCTA,
        },
        {
          name: 'leadMagnet',
          type: 'object',
          title: 'Lead Magnet (Optional)',
          description: 'Offer a downloadable resource in exchange for contact info',
          fields: [
            {
              name: 'title',
              type: 'string',
              title: 'Lead Magnet Title',
              description: 'e.g., "Free ACA Enrollment Guide"',
            },
            {
              name: 'description',
              type: 'text',
              title: 'Description',
              rows: 2,
            },
            {
              name: 'type',
              type: 'string',
              title: 'Lead Magnet Type',
              description: 'Choose between uploading a file or linking to an existing consumer guide',
              options: {
                list: [
                  { title: 'Upload File', value: 'file' },
                  { title: 'Link to Consumer Guide', value: 'guide' },
                ],
              },
              initialValue: 'file',
            },
            {
              name: 'file',
              type: 'file',
              title: 'Downloadable File',
              description: 'PDF, guide, or other resource',
              hidden: ({parent}: any) => parent?.type === 'guide',
            },
            {
              name: 'guideId',
              type: 'string',
              title: 'Consumer Guide ID',
              description: 'The ID of the guide from consumer guides (e.g., "aca-guide-1"). Leave empty if uploading a file.',
              placeholder: 'e.g., aca-guide-1',
              hidden: ({parent}: any) => parent?.type === 'file',
            },
          ],
          hidden: ({parent}: any) => !parent?.enableCTA,
        },
      ],
    },
    
    // ========== PUBLISHING ==========
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      title: 'Published Date',
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      type: 'datetime',
      title: 'Last Updated',
      description: 'When was this post last updated?',
    }),
    defineField({
      name: 'status',
      type: 'string',
      title: 'Status',
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
    
    // ========== RELATED CONTENT ==========
    {
      name: 'relatedPost',
      type: 'reference',
      title: 'Related Post (Other Language)',
      to: [{type: 'post'}],
      description: 'Link to the same post in another language',
    },
    {
      name: 'relatedPosts',
      type: 'array',
      title: 'Related Posts',
      description: 'Other posts readers might be interested in',
      of: [{type: 'reference', to: [{type: 'post'}]}],
    },
    
    // ========== ANALYTICS & TRACKING ==========
    {
      name: 'tracking',
      type: 'object',
      title: 'Tracking & Analytics',
      fields: [
        {
          name: 'utmSource',
          type: 'string',
          title: 'UTM Source',
          description: 'For tracking where traffic comes from',
        },
        {
          name: 'utmCampaign',
          type: 'string',
          title: 'UTM Campaign',
        },
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
      locale: 'locale',
      category: 'category',
      status: 'status',
      featured: 'featured',
      media: 'image',
    },
    prepare({ title, locale, category, status, featured, media }) {
      const statusEmoji = status === 'published' ? '✅' : status === 'draft' ? '📝' : '📦';
      const featuredBadge = featured ? '⭐ ' : '';
      const categoryLabel = category ? ` • ${category}` : '';
      return {
        title: `${featuredBadge}${title} (${locale?.toUpperCase() || 'EN'})${categoryLabel}`,
        subtitle: `${statusEmoji} ${status || 'draft'}`,
        media,
      }
    },
  },
  orderings: [
    {
      title: 'Published Date, Newest',
      name: 'publishedAtDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
    {
      title: 'Published Date, Oldest',
      name: 'publishedAtAsc',
      by: [{field: 'publishedAt', direction: 'asc'}],
    },
    {
      title: 'Category',
      name: 'category',
      by: [{field: 'category', direction: 'asc'}],
    },
    {
      title: 'Featured First',
      name: 'featured',
      by: [{field: 'featured', direction: 'desc'}],
    },
  ],
})
