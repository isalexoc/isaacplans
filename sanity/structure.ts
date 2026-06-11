import type {StructureResolver} from 'sanity/structure'
import { DocumentTextIcon, ShareIcon } from '@sanity/icons'

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      ...S.documentTypeListItems().filter(
        (item) => item.getId() !== 'leadMagnet' && item.getId() !== 'socialPost'
      ),
      S.listItem()
        .title('Lead Magnets')
        .icon(DocumentTextIcon)
        .child(
          S.documentTypeList('leadMagnet')
            .title('Lead Magnets')
            .defaultOrdering([{ field: 'publishedAt', direction: 'desc' }])
        ),
      S.listItem()
        .title('Social Media Posts')
        .icon(ShareIcon)
        .child(
          S.documentTypeList('socialPost')
            .title('Social Media Posts')
            .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
        ),
    ])
