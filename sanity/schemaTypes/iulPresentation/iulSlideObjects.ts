import { defineType, type Rule } from 'sanity'
import { field, pairString, pairText, pairStringArray, localizedImage, slidePreview, collapsed } from './helpers'

// Slide 17 — IUL hero ("The Solution")
export const iulSlideIulHero = defineType({
  name: 'iulSlideIulHero',
  title: 'IUL Hero Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairText('description', 'Description'),
    ...pairStringArray('highlights', 'Highlights'),
    localizedImage('image', 'Hero Image'),
    ...pairString('cta', 'CTA'),
  ],
  preview: slidePreview('IUL Hero'),
})

// Slide 18 — Who is IUL good for?
export const iulSlideIulWho = defineType({
  name: 'iulSlideIulWho',
  title: 'IUL Who Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairText('description', 'Description'),
    field({
      name: 'characteristics',
      type: 'array',
      title: 'Characteristics',
      of: [
        {
          type: 'object',
          name: 'characteristic',
          fields: [
            ...pairString('title', 'Title'),
            ...pairText('description', 'Description'),
            field({
              name: 'icon',
              type: 'string',
              title: 'Icon',
              options: { list: ['legacy', 'income', 'bank', 'portfolio', 'retirement'] },
            }),
          ],
          preview: { select: { title: 'titleEn' } },
        },
      ],
    }),
    ...pairString('cta', 'CTA'),
  ],
  preview: slidePreview('IUL Who'),
})

// Slide 19 — Risk vs reward comparison chart
export const iulSlideIulComparison = defineType({
  name: 'iulSlideIulComparison',
  title: 'IUL Comparison Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairText('description', 'Description'),
    field({
      name: 'investments',
      type: 'array',
      title: 'Investments',
      of: [
        {
          type: 'object',
          name: 'investment',
          fields: [
            ...pairString('name', 'Name'),
            field({
              name: 'risk',
              type: 'number',
              title: 'Risk (0–100)',
              validation: (rule: Rule) => rule.required().min(0).max(100),
            }),
            field({
              name: 'reward',
              type: 'number',
              title: 'Reward (0–100)',
              validation: (rule: Rule) => rule.required().min(0).max(100),
            }),
            field({
              name: 'isIul',
              type: 'boolean',
              title: 'Is IUL?',
              description: 'Highlights this point on the chart.',
              initialValue: false,
            }),
            field({
              name: 'labelPlacement',
              type: 'string',
              title: 'Label Placement',
              description: 'Where the name label sits relative to the chart point.',
              options: { list: ['top', 'topLeft', 'topRight', 'bottom'] },
              initialValue: 'top',
            }),
          ],
          preview: { select: { title: 'nameEn', subtitle: 'risk' } },
        },
      ],
    }),
    field({
      name: 'legend',
      type: 'object',
      title: 'Legend',
      options: collapsed,
      fields: [
        ...pairString('traditional', 'Traditional Investments'),
        ...pairString('iul', 'IUL'),
        ...pairString('typicalLine', 'Typical Line'),
      ],
    }),
    field({
      name: 'axis',
      type: 'object',
      title: 'Axis Labels',
      options: collapsed,
      fields: [...pairString('risk', 'Risk'), ...pairString('reward', 'Reward')],
    }),
    ...pairText('insight', 'Insight'),
  ],
  preview: slidePreview('IUL Comparison'),
})

// Slide 20 — Properly structuring an IUL
export const iulSlideIulStructure = defineType({
  name: 'iulSlideIulStructure',
  title: 'IUL Structure Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairText('description', 'Description'),
    field({
      name: 'twoComponents',
      type: 'object',
      title: 'Two Components',
      options: collapsed,
      fields: [
        ...pairString('title', 'Title'),
        field({
          name: 'deathBenefit',
          type: 'object',
          title: 'Death Benefit',
          fields: [...pairString('name', 'Name'), ...pairString('description', 'Description')],
        }),
        field({
          name: 'cashValue',
          type: 'object',
          title: 'Cash Value',
          fields: [...pairString('name', 'Name'), ...pairString('description', 'Description')],
        }),
      ],
    }),
    field({
      name: 'relationship',
      type: 'object',
      title: 'Relationship',
      options: collapsed,
      fields: [
        ...pairString('title', 'Title'),
        ...pairString('explanation', 'Explanation'),
        ...pairStringArray('points', 'Points'),
      ],
    }),
    field({
      name: 'cashValueFeatures',
      type: 'object',
      title: 'Cash Value Features',
      options: collapsed,
      fields: [...pairString('title', 'Title'), ...pairStringArray('points', 'Points')],
    }),
    field({
      name: 'whyStructureMatters',
      type: 'object',
      title: 'Why Structure Matters',
      options: collapsed,
      fields: [...pairString('title', 'Title'), ...pairStringArray('points', 'Points')],
    }),
    ...pairString('cta', 'CTA'),
  ],
  preview: slidePreview('IUL Structure'),
})

// Slide 21 — Indexing strategy
export const iulSlideIulIndexing = defineType({
  name: 'iulSlideIulIndexing',
  title: 'IUL Indexing Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairText('description', 'Description'),
    field({
      name: 'keyPoints',
      type: 'array',
      title: 'Key Points',
      of: [
        {
          type: 'object',
          name: 'keyPoint',
          fields: [
            field({
              name: 'icon',
              type: 'string',
              title: 'Icon',
              options: { list: ['chart', 'shield', 'growth'] },
            }),
            ...pairString('title', 'Title'),
            ...pairText('description', 'Description'),
          ],
          preview: { select: { title: 'titleEn' } },
        },
      ],
    }),
    ...pairString('visualNote', 'Visual Note'),
    field({
      name: 'visualLabels',
      type: 'object',
      title: 'Visual Labels',
      options: collapsed,
      fields: [
        ...pairString('yourMoney', 'Your Money'),
        ...pairString('inIULPolicy', 'In IUL Policy'),
        ...pairString('follows', 'Follows'),
        ...pairString('marketIndex', 'Market Index'),
        ...pairString('performance', 'Performance'),
        ...pairString('yourGrowth', 'Your Growth'),
        ...pairString('protectedParticipating', 'Protected & Participating'),
      ],
    }),
  ],
  preview: slidePreview('IUL Indexing'),
})

// Slide 22 — Floor & cap terms
export const iulSlideIulTerms = defineType({
  name: 'iulSlideIulTerms',
  title: 'IUL Terms Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    field({
      name: 'floor',
      type: 'object',
      title: 'Floor',
      fields: [
        ...pairString('title', 'Title'),
        ...pairString('description', 'Description'),
        ...pairText('explanation', 'Explanation'),
      ],
    }),
    field({
      name: 'cap',
      type: 'object',
      title: 'Cap',
      fields: [
        ...pairString('title', 'Title'),
        ...pairString('description', 'Description'),
        ...pairText('explanation', 'Explanation'),
      ],
    }),
    ...pairString('note', 'Note'),
    field({
      name: 'visualLabels',
      type: 'object',
      title: 'Visual Labels',
      options: collapsed,
      fields: [
        ...pairString('marketDrops', 'Market Drops'),
        ...pairString('yourAccount', 'Your Account'),
        ...pairString('protected', 'Protected'),
        ...pairString('marketGains', 'Market Gains'),
        ...pairString('cappedAt', 'Capped At'),
      ],
    }),
  ],
  preview: slidePreview('IUL Terms'),
})

// Slide 23 — Money is NOT invested
export const iulSlideIulNotInvested = defineType({
  name: 'iulSlideIulNotInvested',
  title: 'IUL Not Invested Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    field({
      name: 'comparison',
      type: 'object',
      title: 'Comparison',
      fields: [
        field({
          name: 'directInvestment',
          type: 'object',
          title: 'Direct Investment',
          fields: [...pairString('title', 'Title'), ...pairStringArray('points', 'Points')],
        }),
        field({
          name: 'indexing',
          type: 'object',
          title: 'Indexing (IUL)',
          fields: [...pairString('title', 'Title'), ...pairStringArray('points', 'Points')],
        }),
      ],
    }),
    ...pairString('keyMessage', 'Key Message'),
    field({
      name: 'visualLabels',
      type: 'object',
      title: 'Visual Labels',
      options: collapsed,
      fields: [
        ...pairString('yourMoneyStocks', 'Your Money = Stocks'),
        ...pairString('yourMoneyPolicy', 'Your Money = Policy'),
      ],
    }),
  ],
  preview: slidePreview('IUL Not Invested'),
})

// Slide 24 — How indexing works (3-year example)
export const iulSlideIulHowItWorks = defineType({
  name: 'iulSlideIulHowItWorks',
  title: 'IUL How It Works Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    field({
      name: 'scenarios',
      type: 'array',
      title: 'Year Scenarios',
      of: [
        {
          type: 'object',
          name: 'yearScenario',
          fields: [
            ...pairString('year', 'Year'),
            field({ name: 'marketReturn', type: 'string', title: 'Market Return' }),
            field({ name: 'yourReturn', type: 'string', title: 'Your Return' }),
            ...pairString('explanation', 'Explanation'),
          ],
          preview: { select: { title: 'yearEn', subtitle: 'marketReturn' } },
        },
      ],
    }),
    ...pairString('summary', 'Summary'),
    field({
      name: 'visualLabels',
      type: 'object',
      title: 'Visual Labels',
      options: collapsed,
      fields: [...pairString('marketReturn', 'Market Return'), ...pairString('yourReturn', 'Your Return')],
    }),
  ],
  preview: slidePreview('IUL How It Works'),
})

// Slide 25 — Illustration CTA
export const iulSlideIulIllustrationCta = defineType({
  name: 'iulSlideIulIllustrationCta',
  title: 'IUL Illustration CTA Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairText('description', 'Description'),
    ...pairString('whatYoullSeeTitle', "What You'll See Title"),
    ...pairStringArray('whatYoullSee', "What You'll See"),
    ...pairString('cta', 'CTA'),
  ],
  preview: slidePreview('IUL Illustration CTA'),
})
