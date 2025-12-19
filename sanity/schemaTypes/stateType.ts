import {defineField, defineType} from 'sanity'

export const stateType = defineType({
  name: 'state',
  title: 'Licensed State',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'State Name',
      description: 'Full name of the state (e.g., "Arizona", "New York")',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'code',
      type: 'string',
      title: 'State Code',
      description: 'Optional 2-letter state code (e.g., "AZ", "NY")',
      validation: (rule) => rule.max(2).uppercase(),
    }),
    defineField({
      name: 'order',
      type: 'number',
      title: 'Display Order',
      description: 'Order in which states should be displayed (lower numbers appear first)',
      validation: (rule) => rule.required().integer().min(0),
      initialValue: 0,
    }),
    defineField({
      name: 'active',
      type: 'boolean',
      title: 'Active',
      description: 'Whether this state should be displayed on the website',
      initialValue: true,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'code',
      order: 'order',
    },
    prepare({title, subtitle, order}) {
      return {
        title: title || 'Unnamed State',
        subtitle: subtitle ? `${subtitle} • Order: ${order}` : `Order: ${order}`,
      }
    },
  },
  orderings: [
    {
      title: 'Order (Low to High)',
      name: 'orderAsc',
      by: [{field: 'order', direction: 'asc'}],
    },
    {
      title: 'Order (High to Low)',
      name: 'orderDesc',
      by: [{field: 'order', direction: 'desc'}],
    },
    {
      title: 'Name (A to Z)',
      name: 'nameAsc',
      by: [{field: 'name', direction: 'asc'}],
    },
    {
      title: 'Name (Z to A)',
      name: 'nameDesc',
      by: [{field: 'name', direction: 'desc'}],
    },
  ],
})
