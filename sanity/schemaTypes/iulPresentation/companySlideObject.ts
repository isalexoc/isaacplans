import { defineType } from 'sanity'
import { field, pairString, pairText, pairStringArray, localizedImage, slidePreview, collapsed } from './helpers'

// Slide 26 — National Life Group company slide
export const iulSlideCompany = defineType({
  name: 'iulSlideCompany',
  title: 'Company Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairText('description', 'Description'),
    field({ name: 'companyName', type: 'string', title: 'Company Name' }),
    localizedImage('logo', 'Company Logo'),
    field({
      name: 'videoUrl',
      type: 'url',
      title: 'Video URL (YouTube embed)',
      description: 'e.g. https://www.youtube.com/embed/…',
    }),
    ...pairString('videoTitle', 'Video Title'),
    ...pairString('videoDescription', 'Video Description'),
    ...pairString('valuesTitle', 'Values Title'),
    field({
      name: 'values',
      type: 'array',
      title: 'Core Values',
      of: [
        {
          type: 'object',
          name: 'companyValue',
          fields: [...pairString('title', 'Title'), ...pairText('description', 'Description')],
          preview: { select: { title: 'titleEn' } },
        },
      ],
    }),
    field({
      name: 'statistics',
      type: 'object',
      title: 'Statistics',
      options: collapsed,
      fields: [
        field({ name: 'assetsValue', type: 'string', title: 'Assets Value (e.g. "$57.4B")' }),
        ...pairString('assetsLabel', 'Assets Label'),
        field({ name: 'yearsValue', type: 'string', title: 'Years Value (e.g. "175+")' }),
        ...pairString('yearsLabel', 'Years Label'),
        field({ name: 'ratingValue', type: 'string', title: 'Rating Value (e.g. "A+ Rating")' }),
        ...pairString('ratingLabel', 'Rating Label'),
      ],
    }),
    field({
      name: 'highlights',
      type: 'array',
      title: 'Highlights',
      of: [
        {
          type: 'object',
          name: 'companyHighlight',
          fields: [...pairString('title', 'Title'), ...pairText('description', 'Description')],
          preview: { select: { title: 'titleEn' } },
        },
      ],
    }),
    field({
      name: 'ownership',
      type: 'object',
      title: 'Mutual Ownership',
      options: collapsed,
      fields: [
        ...pairString('title', 'Title'),
        ...pairText('description', 'Description (may contain <strong> tags)'),
        ...pairString('whyTitle', 'Why Title'),
        field({
          name: 'benefits',
          type: 'array',
          title: 'Benefits',
          of: [
            {
              type: 'object',
              name: 'ownershipBenefit',
              fields: [...pairString('label', 'Label'), ...pairText('text', 'Text')],
              preview: { select: { title: 'labelEn' } },
            },
          ],
        }),
      ],
    }),
    ...pairString('missionTitle', 'Mission Title'),
    ...pairText('missionText', 'Mission Text'),
    ...pairString('productsTitle', 'Products Title'),
    ...pairStringArray('productFeatures', 'Product Features'),
  ],
  preview: slidePreview('Company'),
})
