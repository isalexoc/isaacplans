# Blog Post to Newsletter — Phase 2 Spec

## Phase 2: Sanity Studio Document Action

### Goal

Add a "Send Newsletter" button to the Sanity Studio toolbar for blog post documents. When clicked, it shows a confirmation dialog with live subscriber counts for each locale, warns if the post was already sent, and calls the Phase 1 API route to execute the send. After a successful send, the Studio refreshes the document so the `newsletterSentAt` field updates without a manual reload.

This phase has no backend work — all logic lives in Sanity Studio code (the `sanity/` directory).

---

### Prerequisite

Phase 1 must be complete. Specifically:
- `GET /api/newsletter/subscriber-counts` must be working
- `POST /api/newsletter/send-post` must be working
- `newsletterSentAt` must be in the Sanity post schema

---

### What to Build

1. `sanity/actions/sendNewsletterAction.tsx` — the custom document action component
2. Register the action in `sanity.config.ts` for the `post` document type

---

### How Sanity Document Actions Work

Sanity allows custom actions by exporting a function from the studio config. The function receives a `DocumentActionProps` object containing:
- `id` — the current document's Sanity ID
- `published` — the current published document state
- `draft` — the draft document state
- `onComplete` — callback to close a dialog

The action returns an object with:
- `label` — button text
- `icon` — React component (optional)
- `dialog` — dialog config to show when clicked (optional)
- `onHandle` — function to run (can open a dialog or execute directly)
- `disabled` — boolean
- `tone` — `"positive"` | `"caution"` | `"critical"` | `"default"`

Document actions are registered in `sanity.config.ts` by passing a `document.actions` resolver function that receives the default actions and returns a new array including the custom one.

---

### 1. Document Action Component

**File:** `sanity/actions/sendNewsletterAction.tsx`

**Behavior states:**

| State | Button label | Button tone | Dialog shows |
|---|---|---|---|
| Initial load | "Send Newsletter" | default | — |
| Post is draft | "Send Newsletter" | default | disabled (tooltip: "Publish post before sending") |
| Already sent | "Resend Newsletter" | caution | Shows previous send date in dialog |
| Sending | "Sending…" | default | Progress dialog |
| Success | "Newsletter Sent" | positive | Success dialog with counts |
| Error | "Send Newsletter" | critical | Error message dialog |

**Dialog content (confirmation state):**

```
┌─────────────────────────────────────────────────────┐
│  Send Newsletter                                     │
├─────────────────────────────────────────────────────┤
│  This will send the post to all confirmed           │
│  newsletter subscribers:                            │
│                                                     │
│    🇺🇸  English:  142 subscribers                  │
│    🇪🇸  Spanish:   87 subscribers                  │
│                                                     │
│  [Warning box if already sent]:                     │
│  ⚠️  This post was already sent on Jun 5, 2026.    │
│     Sending again will reach the same subscribers.  │
│                                                     │
│  Note: Only confirmed subscribers receive emails.   │
│  Unsubscribed and pending addresses are excluded.   │
└─────────────────────────────────────────────────────┘
│  [Cancel]                    [Send to 229 people]   │
└─────────────────────────────────────────────────────┘
```

**Success dialog content:**

```
┌─────────────────────────────────────────────────────┐
│  ✅ Newsletter sent successfully                     │
├─────────────────────────────────────────────────────┤
│   English:  142 sent  (0 failed)                   │
│   Spanish:   86 sent  (1 failed)                   │
│                                                     │
│  1 failed delivery — check server logs.             │
└─────────────────────────────────────────────────────┘
│                                      [Close]        │
└─────────────────────────────────────────────────────┘
```

**Implementation details:**

Use React `useState` for `dialogOpen`, `loading`, `counts`, `result`, `error`.

On dialog open (first time per session), fetch subscriber counts:
```ts
const res = await fetch('/api/newsletter/subscriber-counts');
const { counts } = await res.json();
```

On confirm click:
```ts
const res = await fetch('/api/newsletter/send-post', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ postId: props.id, force: alreadySent }),
});
```

Where `alreadySent` is `true` if `props.published?.newsletterSentAt` is set (so the call uses `force: true` for resends).

After a successful send, call `props.onComplete()` to close the dialog, then trigger a document refresh. In Sanity Studio v3, use the `useDocumentOperation` hook or simply call `onComplete()` — the Studio will refetch the document and show the updated `newsletterSentAt` field automatically.

**Disable condition:** If `props.published` is `null` (post is unpublished / draft only), set `disabled: true` on the returned action object and add `title: "Publish post before sending newsletter"`.

**useEffect for counts:** Fetch counts once when the component mounts (not on every render). Show a loading skeleton in the dialog while counts are loading.

---

### 2. Register the Action in sanity.config.ts

**File:** `sanity.config.ts`

Locate the `defineConfig({...})` call and add a `document.actions` resolver:

```ts
import { sendNewsletterAction } from './sanity/actions/sendNewsletterAction'

// Inside defineConfig:
document: {
  actions: (prev, context) => {
    if (context.schemaType === 'post') {
      return [...prev, sendNewsletterAction]
    }
    return prev
  },
},
```

This appends the custom action to the default actions (Publish, Unpublish, Duplicate, Delete) only on `post` documents. It does not appear on presentation scripts, states, or any other document type.

---

### File Structure After Phase 2

```
sanity/
  actions/
    sendNewsletterAction.tsx             ← NEW: custom document action
  schemaTypes/
    postType.ts                          ← already updated in Phase 1

sanity.config.ts                         ← register the new action for 'post' type
```

---

### Styling Notes

Use Sanity's built-in UI primitives where possible — `@sanity/ui` is available in the Studio bundle:
- `Box`, `Stack`, `Flex`, `Text`, `Card`, `Badge`, `Button`, `Dialog`, `Spinner`
- `useToast` for post-send toast notifications as a fallback

Avoid importing any Next.js or app-level components into the Studio.

---

### Success Criteria

Phase 2 is complete when:

- A "Send Newsletter" button appears in the Sanity Studio toolbar on all `post` documents
- The button is disabled with a tooltip on unpublished (draft-only) posts
- Clicking the button opens a dialog showing confirmed subscriber counts for EN and ES
- The dialog shows a warning if `newsletterSentAt` is already set on the post
- Confirming the send calls `POST /api/newsletter/send-post` and shows a success dialog with sent counts
- After success, the `newsletterSentAt` field in the Studio form updates without a manual page reload
- Errors from the API (e.g. network failure) show an error state in the dialog instead of silently failing
- The action does not appear on any non-`post` document type in the Studio

---

## References

**Existing files to read before implementing:**
- `sanity.config.ts` — current Studio config; this is where the action is registered
- `sanity/schemaTypes/postType.ts` — the `newsletterSentAt` field added in Phase 1
- `app/api/newsletter/subscriber-counts/route.ts` — the counts endpoint this action fetches
- `app/api/newsletter/send-post/route.ts` — the send endpoint this action calls

**External docs:**
- Sanity custom document actions: https://www.sanity.io/docs/document-actions
- `@sanity/ui` component library: https://www.sanity.io/ui
- Sanity Studio v3 hooks: https://www.sanity.io/docs/studio-hooks
