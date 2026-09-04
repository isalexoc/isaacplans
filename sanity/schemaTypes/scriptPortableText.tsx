'use client'

/**
 * Shared Portable Text vocabulary for sales scripts.
 *
 * Every rich-text field on `presentationScript` uses `scriptBlockArray()` so the
 * whole document set shares one toolbar and one set of meanings. Edit the tools
 * here and all 26 fields change together.
 *
 * IMPORTANT — Sanity REPLACES the defaults, it does not merge them.
 * `createChildrenField` / `createStyleField` / `createListItemField` fall back to
 * the built-ins with a plain `||` (verified in @sanity/schema@4.18.0
 * Rule.js:421,431,444-446). So `strong`, `em`, `underline`, `normal`, `h1`-`h4`,
 * both list types and the `link` annotation are re-declared explicitly below.
 * Dropping one here orphans it in existing documents: the editor auto-strips
 * unknown marks the moment a document is edited.
 *
 * Existing content (3 documents, 1518 blocks, counted with perspective=raw so
 * drafts are included) depends on: strong (x687), underline (x62), em (x55),
 * normal, h1, h2, h3, blockquote, bullet, number. None of those may leave.
 */

import {
  CheckmarkCircleIcon,
  EditIcon,
  HighlightIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import type {BlockDecoratorProps, BlockStyleProps} from 'sanity'

/* ------------------------------------------------------------------ *
 * Editor render components
 *
 * These draw the tools inside Studio. Studio has no Tailwind, so styling
 * is inline. Highlight backgrounds are deliberately fixed light tones with
 * explicit dark text — like real marker pen on paper, they read correctly
 * in both the light and dark Studio themes.
 * ------------------------------------------------------------------ */

/**
 * A non-editable label on a block style.
 *
 * `contentEditable={false}` is required — without it the pill text joins the
 * editable flow and corrupts cursor/selection behaviour (see the docblock on
 * BlockStyleDefinition.component).
 *
 * `block` is what tells us we are decorating real content. The style dropdown
 * renders these same components with only `children` — the menu row's title —
 * so every other prop is undefined there (sanity/lib/index.mjs:30423,
 * `jsx(CustomComponent, {children: title})`). Without this guard the dropdown
 * shows five tall coloured boxes, each printing its label twice.
 */
function Pill({label, color, block}: {label: string; color: string; block?: unknown}) {
  if (!block) return null
  return (
    <span
      contentEditable={false}
      style={{
        userSelect: 'none',
        display: 'block',
        marginBottom: '0.25rem',
        color,
        fontSize: '0.625rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  )
}

const highlightBase = {
  borderRadius: '3px',
  padding: '0 2px',
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone',
} as const

function EmphasizeDecorator(props: BlockDecoratorProps) {
  return (
    <span style={{...highlightBase, backgroundColor: '#FDE68A', color: '#422006'}}>
      {props.children}
    </span>
  )
}

function GoodNewsDecorator(props: BlockDecoratorProps) {
  return (
    <span style={{...highlightBase, backgroundColor: '#BBF7D0', color: '#052E16'}}>
      {props.children}
    </span>
  )
}

function CarefulDecorator(props: BlockDecoratorProps) {
  return (
    <span style={{...highlightBase, backgroundColor: '#FECACA', color: '#450A0A'}}>
      {props.children}
    </span>
  )
}

function FillDecorator(props: BlockDecoratorProps) {
  return (
    <span
      style={{
        ...highlightBase,
        border: '1px dashed #0077B6',
        backgroundColor: 'rgba(0,119,182,0.10)',
        color: '#0077B6',
        fontWeight: 600,
      }}
    >
      {props.children}
    </span>
  )
}

function AgentNoteStyle(props: BlockStyleProps) {
  return (
    <div
      style={{
        borderLeft: '4px solid #94A3B8',
        backgroundColor: 'rgba(148,163,184,0.12)',
        padding: '0.5rem 0.75rem',
        borderRadius: '0 4px 4px 0',
        fontStyle: 'italic',
        opacity: 0.85,
      }}
    >
      <Pill block={props.block} label="Don't read" color="#64748B" />
      {props.children}
    </div>
  )
}

function AskPauseStyle(props: BlockStyleProps) {
  return (
    <div
      style={{
        border: '2px dashed #00B4D8',
        backgroundColor: 'rgba(0,180,216,0.10)',
        padding: '0.625rem 0.875rem',
        borderRadius: '8px',
        fontWeight: 600,
      }}
    >
      <Pill block={props.block} label="Ask — then stop" color="#0891B2" />
      {props.children}
    </div>
  )
}

function ClientSaysStyle(props: BlockStyleProps) {
  return (
    <div
      style={{
        borderLeft: '4px solid #FB7185',
        backgroundColor: 'rgba(251,113,133,0.10)',
        padding: '0.5rem 0.875rem',
        borderRadius: '0 4px 4px 0',
      }}
    >
      <Pill block={props.block} label="Client says" color="#E11D48" />
      {props.children}
    </div>
  )
}

function VerbatimStyle(props: BlockStyleProps) {
  return (
    <div
      style={{
        borderLeft: '4px solid #0077B6',
        backgroundColor: 'rgba(0,119,182,0.08)',
        padding: '0.5rem 0.875rem',
        borderRadius: '0 4px 4px 0',
        fontWeight: 500,
      }}
    >
      <Pill block={props.block} label="Word for word" color="#0077B6" />
      {props.children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The vocabulary
 * ------------------------------------------------------------------ */

/** Toolbar buttons. Order here is the order Isaac sees them in. */
const scriptDecorators = [
  // Built-ins, transcribed verbatim from @sanity/schema Rule.js so the i18n
  // titles and values match exactly what existing content already stores.
  {title: 'Strong', value: 'strong'},
  {title: 'Italic', value: 'em'},
  {title: 'Underline', value: 'underline'},
  // Script-specific.
  {
    title: 'Emphasize',
    value: 'highlight',
    icon: HighlightIcon,
    component: EmphasizeDecorator,
  },
  {
    title: 'Good news',
    value: 'highlightGood',
    icon: CheckmarkCircleIcon,
    component: GoodNewsDecorator,
  },
  {
    title: 'Careful',
    value: 'highlightCareful',
    icon: WarningOutlineIcon,
    component: CarefulDecorator,
  },
  {
    title: 'Fill in the blank',
    value: 'fill',
    icon: EditIcon,
    component: FillDecorator,
  },
]

/**
 * The style dropdown. Costs no toolbar width, so the sales-specific meanings
 * live here rather than as buttons.
 *
 * h1/h4 are legacy: the AI script generator's styleMap emits {1:h1,2:h2,3:h3,4:h4}
 * and existing scripts contain 58 h1 blocks. Keep them declared.
 * h5/h6 are dropped — zero uses, and the reading view never styled them.
 */
const scriptStyles = [
  {title: 'Spoken line', value: 'normal'},
  {title: 'Say word for word', value: 'verbatim', component: VerbatimStyle},
  {title: 'Ask, then stop talking', value: 'askPause', component: AskPauseStyle},
  {title: 'Client says / objection', value: 'clientSays', component: ClientSaysStyle},
  {title: 'Agent note — do not read', value: 'agentNote', component: AgentNoteStyle},
  {title: 'Section heading', value: 'h2'},
  {title: 'Step heading', value: 'h3'},
  {title: 'Big title', value: 'h1'},
  {title: 'Small heading', value: 'h4'},
  // Kept declared, and deliberately NOT given the "Client says" treatment: the
  // only blockquote in live content is an agent stage direction ("(Slow down
  // here. Pause often. Let them answer.)"), so repurposing this value would
  // relabel it as something the client said.
  {title: 'Quote', value: 'blockquote'},
]

const scriptLists = [
  {title: 'Bulleted list', value: 'bullet'},
  {title: 'Numbered list', value: 'number'},
]

/** Re-declared because `marks.annotations` replaces DEFAULT_ANNOTATIONS. */
const scriptAnnotations = [
  {
    name: 'link',
    type: 'object',
    title: 'Link',
    options: {modal: {type: 'popover'}},
    fields: [
      {
        name: 'href',
        type: 'url',
        title: 'Link',
        description: 'A valid web, email, phone, or relative link.',
        validation: (rule: any) =>
          rule.uri({scheme: ['http', 'https', 'tel', 'mailto'], allowRelative: true}),
      },
    ],
  },
]

const scriptBlockMember = {
  type: 'block' as const,
  styles: scriptStyles,
  lists: scriptLists,
  marks: {
    decorators: scriptDecorators,
    annotations: scriptAnnotations,
  },
}

const scriptImageMember = {
  type: 'image' as const,
  // Hotspot is deliberately OFF: these are screenshots and rate charts, never
  // art-directed crops. The renderer uses fit('max'), so the whole image is
  // always shown and a hotspot would have nothing to do.
  fields: [
    {
      name: 'size',
      type: 'string',
      title: 'How big should this be?',
      description:
        'Pick by what the image is. Whatever you choose, the agent can still click it to open it full screen.',
      options: {
        list: [
          {title: 'Small — a carrier logo, badge or icon', value: 'small'},
          {title: 'Standard — a photo, or a chart with a few big numbers', value: 'standard'},
          {title: 'Wide — a form, a screenshot, a plan comparison', value: 'wide'},
          {
            title: 'Full width — dense tables, rate charts, underwriting grids',
            value: 'full',
          },
        ],
        // Radio, not a dropdown. All four outcomes stay visible in the form, so
        // the fix for an unreadable chart is discoverable without opening a menu.
        layout: 'radio',
      },
      // New images match what images with no value set already render as, so the
      // whole document set behaves the same way: wide unless told otherwise.
      initialValue: 'wide',
    },
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
}

/**
 * Builds one rich-text field with the shared script toolbar.
 *
 * Returns a plain object literal on purpose — wrapping this in `defineField()`
 * fails with TS2345 on the `of` array (the same limitation already worked around
 * in sanity/schemaTypes/iulPresentation/helpers.ts), and `as any` on `of` does
 * not fix it.
 */
export function scriptBlockArray(
  name: string,
  title: string,
  opts: {description?: string; required?: boolean} = {}
) {
  return {
    name,
    title,
    type: 'array' as const,
    ...(opts.description ? {description: opts.description} : {}),
    of: [scriptBlockMember, scriptImageMember],
    ...(opts.required ? {validation: (rule: any) => rule.required()} : {}),
  }
}
