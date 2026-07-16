import { defineType, type Rule } from 'sanity'
import { field, pairString, pairText, pairStringArray, localizedImage, slidePreview, collapsed } from './helpers'

// Slide 1 — Agent introduction (license reveal lives here; the state list and
// license images come from `agentLicense` documents, not this slide).
export const iulSlideAgent = defineType({
  name: 'iulSlideAgent',
  title: 'Agent Introduction Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairString('role', 'Role'),
    ...pairText('introduction', 'Introduction'),
    localizedImage('headshot', 'Agent Headshot'),
    field({
      name: 'contact',
      type: 'object',
      title: 'Contact',
      options: collapsed,
      fields: [
        field({ name: 'name', type: 'string', title: 'Name' }),
        field({ name: 'phone', type: 'string', title: 'Phone' }),
        field({ name: 'email', type: 'string', title: 'Email' }),
        field({ name: 'website', type: 'string', title: 'Website' }),
      ],
    }),
    field({
      name: 'credentials',
      type: 'object',
      title: 'Credentials',
      options: collapsed,
      fields: [...pairString('title', 'Title'), ...pairStringArray('list', 'Credentials')],
    }),
    field({
      name: 'stateLicense',
      type: 'object',
      title: 'State License Panel',
      options: collapsed,
      fields: [
        ...pairString('title', 'Title'),
        ...pairString('selectLabel', 'Select Label'),
        ...pairString('placeholder', 'Placeholder'),
      ],
    }),
    field({
      name: 'driversLicense',
      type: 'object',
      title: "Driver's License Panel",
      options: collapsed,
      fields: [...pairString('title', 'Title'), ...pairString('placeholder', 'Placeholder')],
    }),
    field({
      name: 'download',
      type: 'object',
      title: 'Download Buttons',
      options: collapsed,
      fields: [
        ...pairString('asImage', 'Download as Image'),
        ...pairString('asPDF', 'Download as PDF'),
        ...pairString('downloading', 'Downloading…'),
      ],
    }),
    field({
      name: 'unlock',
      type: 'object',
      title: 'Reveal / Locked Messages',
      options: collapsed,
      fields: [
        ...pairString('unlocked', 'Unlocked Badge'),
        ...pairString('lockedMessage', 'Locked Message'),
        ...pairString('lockedSubmessage', 'Locked Submessage'),
      ],
    }),
  ],
  preview: slidePreview('Agent'),
})

// Slide 2 — Discovery questions
export const iulSlideDiscovery = defineType({
  name: 'iulSlideDiscovery',
  title: 'Discovery Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairText('description', 'Description'),
    ...pairStringArray('questions', 'Questions'),
    localizedImage('image', 'Slide Image'),
  ],
  preview: slidePreview('Discovery'),
})

// Slides 3–7 — Traditional retirement products
export const iulSlideRetirementProduct = defineType({
  name: 'iulSlideRetirementProduct',
  title: 'Retirement Product Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    field({
      name: 'product',
      type: 'object',
      title: 'Product',
      fields: [
        ...pairString('name', 'Name'),
        ...pairText('description', 'Description'),
        field({
          name: 'contributionLimit',
          type: 'string',
          title: 'Contribution Limit',
          description: 'Figure only (e.g. "$23,000") — same in both languages. Leave empty to hide.',
        }),
        ...pairString('catchUp', 'Catch-up'),
      ],
    }),
    localizedImage('image', 'Product Image'),
    ...pairStringArray('advantages', 'Advantages'),
    ...pairStringArray('disadvantages', 'Disadvantages'),
  ],
  preview: {
    select: { title: 'product.nameEn', subtitle: 'titleEn' },
    prepare({ title, subtitle }: { title?: string; subtitle?: string }) {
      return { title: title || 'Retirement Product', subtitle: `Retirement Product — ${subtitle ?? ''}` }
    },
  },
})

// Slides 8–11 — Real-world scenarios
export const iulSlideScenario = defineType({
  name: 'iulSlideScenario',
  title: 'Scenario Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairText('warning', 'Warning Banner'),
    field({
      name: 'scenarioKind',
      type: 'string',
      title: 'Scenario Kind',
      description: 'Drives the icon set shown on the slide.',
      options: {
        list: [
          { title: 'Early Withdrawal Penalty', value: 'penalty' },
          { title: 'Required Minimum Distributions', value: 'rmd' },
          { title: 'Market Downturn', value: 'market' },
          { title: 'Serious Illness', value: 'illness' },
        ],
      },
      validation: (rule: Rule) => rule.required(),
    }),
    localizedImage('image', 'Scenario Image'),
    field({
      name: 'scenario',
      type: 'object',
      title: 'Scenario',
      fields: [
        ...pairString('title', 'Title'),
        ...pairText('situation', 'The Situation'),
        ...pairText('problem', 'The Problem'),
        ...pairText('impact', 'The Impact'),
        field({
          name: 'keyNumbers',
          type: 'array',
          title: 'Key Numbers',
          of: [
            {
              type: 'object',
              name: 'keyNumber',
              fields: [
                ...pairString('value', 'Value'),
                ...pairString('label', 'Label'),
                field({
                  name: 'numberType',
                  type: 'string',
                  title: 'Kind',
                  description: 'Controls the card color/icon.',
                  options: {
                    list: [
                      'need',
                      'loss',
                      'result',
                      'balance',
                      'forced',
                      'percentage',
                      'ongoing',
                      'before',
                      'after',
                      'timeline',
                      'available',
                      'missing',
                    ],
                  },
                }),
              ],
              preview: { select: { title: 'valueEn', subtitle: 'labelEn' } },
            },
          ],
        }),
      ],
    }),
  ],
  preview: {
    select: { title: 'subtitleEn', subtitle: 'scenario.titleEn' },
    prepare({ title, subtitle }: { title?: string; subtitle?: string }) {
      return { title: title || 'Scenario', subtitle: `Scenario — ${subtitle ?? ''}` }
    },
  },
})

// Slide 12 — "Do you own a bank?" intro
export const iulSlideBank = defineType({
  name: 'iulSlideBank',
  title: 'Bank Questions Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairStringArray('questions', 'Questions'),
    ...pairText('description', 'Description'),
  ],
  preview: slidePreview('Bank'),
})

// Slides 13–14 — Traditional loan examples (car / house)
export const iulSlideBankExample = defineType({
  name: 'iulSlideBankExample',
  title: 'Bank Loan Example Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    field({
      name: 'example',
      type: 'object',
      title: 'Loan Example',
      fields: [
        ...pairText('scenario', 'Scenario'),
        field({ name: 'loanAmount', type: 'string', title: 'Loan Amount' }),
        field({ name: 'interestRate', type: 'string', title: 'Interest Rate' }),
        ...pairString('loanTerm', 'Loan Term'),
        field({ name: 'monthlyPayment', type: 'string', title: 'Monthly Payment' }),
        field({ name: 'totalPaid', type: 'string', title: 'Total Paid' }),
        field({ name: 'interestPaid', type: 'string', title: 'Interest Paid' }),
        ...pairText('problem', 'The Problem'),
      ],
    }),
  ],
  preview: slidePreview('Bank Example'),
})

// Slide 15 — True cost of traditional banking
export const iulSlideBankCosts = defineType({
  name: 'iulSlideBankCosts',
  title: 'Bank Costs Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    field({
      name: 'costs',
      type: 'array',
      title: 'Cost Items',
      of: [
        {
          type: 'object',
          name: 'costItem',
          fields: [
            ...pairString('item', 'Item'),
            field({ name: 'amount', type: 'string', title: 'Amount' }),
            ...pairString('description', 'Description'),
          ],
          preview: { select: { title: 'itemEn', subtitle: 'amount' } },
        },
      ],
    }),
    field({ name: 'total', type: 'string', title: 'Total' }),
    ...pairText('summary', 'Summary'),
  ],
  preview: slidePreview('Bank Costs'),
})

// Slide 16 — "What if you could be your own bank?" teaser
export const iulSlideBankTeaser = defineType({
  name: 'iulSlideBankTeaser',
  title: 'Bank Teaser Slide',
  type: 'object',
  fields: [
    ...pairString('title', 'Title'),
    ...pairString('subtitle', 'Subtitle'),
    ...pairStringArray('questions', 'Questions'),
    ...pairText('description', 'Description'),
  ],
  preview: slidePreview('Bank Teaser'),
})
