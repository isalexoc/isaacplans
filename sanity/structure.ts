import type {StructureResolver} from 'sanity/structure'
import { DocumentTextIcon, ShareIcon, PresentationIcon, CaseIcon, CommentIcon } from '@sanity/icons'
import { OBJECTION_LOBS } from '../lib/objections/types'

/**
 * Product panes for the objection library.
 *
 * The `!defined()` guard is load-bearing, not defensive. In GROQ `count(undefinedField) == 0`
 * evaluates to FALSE, because Sanity stores an empty array as undefined rather than []. Without
 * the guard, every "all products" objection silently vanishes from all six panes.
 */
const LOB_FILTER =
  '_type == "objection" && (!defined(linesOfBusiness) || count(linesOfBusiness) == 0 || $lob in linesOfBusiness)'

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      ...S.documentTypeListItems().filter(
        (item) =>
          item.getId() !== 'leadMagnet' &&
          item.getId() !== 'socialPost' &&
          item.getId() !== 'iulPresentation' &&
          item.getId() !== 'agentLicense' &&
          item.getId() !== 'objection'
      ),
      S.listItem()
        .title('Objection Library')
        .icon(CommentIcon)
        .child(
          S.list()
            .title('Objection Library')
            .items([
              S.listItem()
                .id('objections-all')
                .title('All objections')
                .icon(CommentIcon)
                .child(
                  S.documentTypeList('objection')
                    .title('All objections')
                    .defaultOrdering([{ field: 'order', direction: 'asc' }])
                ),
              S.divider(),
              ...OBJECTION_LOBS.map((lob) =>
                S.listItem()
                  .id(`objections-lob-${lob.value}`)
                  .title(lob.short)
                  .child(
                    S.documentList()
                      .id(`objections-list-${lob.value}`)
                      .title(lob.title)
                      .schemaType('objection')
                      .filter(LOB_FILTER)
                      .params({ lob: lob.value })
                      .defaultOrdering([{ field: 'order', direction: 'asc' }])
                  )
              ),
              S.divider(),
              // The two gap panes are how a 30-document library stays manageable without a
              // developer: English and Spanish do not line up in the source content, so "what am
              // I missing?" needs to be a place you can click, not a query someone has to write.
              S.listItem()
                .id('objections-needs-es')
                .title('⚠️ Needs Spanish')
                .child(
                  S.documentList()
                    .id('objections-list-needs-es')
                    .title('Needs Spanish')
                    .schemaType('objection')
                    .filter(
                      '_type == "objection" && (!defined(titleEs) || count(answerEs) == 0 || !defined(answerEs))'
                    )
                ),
              S.listItem()
                .id('objections-needs-en')
                .title('⚠️ Needs English')
                .child(
                  S.documentList()
                    .id('objections-list-needs-en')
                    .title('Needs English')
                    .schemaType('objection')
                    .filter(
                      '_type == "objection" && (!defined(titleEn) || count(answerEn) == 0 || !defined(answerEn))'
                    )
                ),
              S.listItem()
                .id('objections-drafts')
                .title('📝 Not published yet')
                .child(
                  S.documentList()
                    .id('objections-list-drafts')
                    .title('Not published yet')
                    .schemaType('objection')
                    .filter('_type == "objection" && status != "published"')
                ),
            ])
        ),
      S.listItem()
        .title('IUL Presentation')
        .icon(PresentationIcon)
        .child(
          S.document().schemaType('iulPresentation').documentId('iulPresentation')
        ),
      S.listItem()
        .title('Agent Licenses')
        .icon(CaseIcon)
        .child(
          S.documentTypeList('agentLicense')
            .title('Agent Licenses')
            .defaultOrdering([{ field: 'order', direction: 'asc' }])
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
