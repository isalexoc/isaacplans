import { defineField, defineType, type Rule } from 'sanity'
import { CaseIcon } from '@sanity/icons'
import { field } from './iulPresentation/helpers'

// Agent license metadata. The license image itself stays in Cloudinary with
// authenticated delivery (signed, expiring URLs served through the admin-gated
// /api/admin/license-image proxy) — never upload license images to Sanity,
// its dataset/CDN is public.
export const agentLicenseType = defineType({
  name: 'agentLicense',
  title: 'Agent License',
  type: 'document',
  icon: CaseIcon,
  fields: [
    defineField({
      name: 'licenseType',
      type: 'string',
      title: 'License Type',
      options: {
        list: [
          { title: 'State Insurance License', value: 'state' },
          { title: "Driver's License", value: 'drivers' },
        ],
        layout: 'radio',
      },
      initialValue: 'state',
      validation: (rule) => rule.required(),
    }),
    field({
      name: 'state',
      type: 'reference',
      title: 'State',
      to: [{ type: 'state' }],
      hidden: ({ parent }: { parent?: { licenseType?: string } }) => parent?.licenseType !== 'state',
      validation: (rule: Rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { licenseType?: string } | undefined
          if (parent?.licenseType === 'state' && !value) return 'State is required for state licenses'
          return true
        }),
    }),
    defineField({
      name: 'cloudinaryPublicId',
      type: 'string',
      title: 'Cloudinary Public ID',
      description: 'Public ID of the license image in Cloudinary (e.g. "arizona_seh3e1").',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'active',
      type: 'boolean',
      title: 'Active',
      description: 'Only active licenses appear in the presentation.',
      initialValue: true,
    }),
    defineField({
      name: 'order',
      type: 'number',
      title: 'Display Order',
      initialValue: 0,
    }),
  ],
  preview: {
    select: { stateName: 'state.name', licenseType: 'licenseType', active: 'active' },
    prepare({ stateName, licenseType, active }: { stateName?: string; licenseType?: string; active?: boolean }) {
      const title = licenseType === 'drivers' ? "Driver's License" : stateName || 'State License'
      return { title, subtitle: active === false ? 'Inactive' : 'Active' }
    },
  },
})
