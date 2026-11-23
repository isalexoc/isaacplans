# Agent platform: setup and status

The free agent platform gives other Impact IBOs Isaac's sales system. Each agent gets their own branded guide with
quote and Apply, the CrankWheel-style deck, and the Health Coverage application with its secure SSN/bank link.
They also get an agent area to work their applications. The app is free; revenue will come from leads agents
choose to buy (Phase 2).

**Status:** Phase 1 (pilot foundation) is built on `feature/agent-platform-pilot`. Every launch gate is **off**,
so nothing is open to the public or to real client data yet.

## Decisions (Isaac, 2026-11-22)

- **Pilot:** buyers are Impact IBOs (ACN), each with their own IBO number. Isaac sets up the first agents from
  `/admin/agents`; self-serve sign-up comes later.
- **Domains:**
  - Client pages live on a **new neutral domain**. ACN bars provider names such as "Impact" in domains.
  - That domain is served by a **second Vercel project**, built from the same repo and database, with
    `APP_SURFACE=product`.
  - The product project has no Clerk, no CRM key and no trackers.
- **Client data:** agents' applications collect SSN/ITIN and bank details like Isaac's. Only the owning agent can
  reveal them, and every reveal is logged. Isaac, as platform admin, cannot see them.
- **Money:** the app is free; revenue is lead sales (Phase 2, Stripe).

## How it is built

- **Accounts:** `lib/tenancy/` holds the agents table, the launch gates, and the operator checks. An admin, or an
  active agent who accepted the current ToS and DPA, may act only on their own sessions. A signed-in operator who
  isn't the owner gets a 403 and an audit row.
- **CRM:** `crmCredsForOwner` is a **fail-closed allowlist**. Only Isaac's owner ids get his GHL credentials. A
  guard in `pnpm test:tenancy` fails if an intake path imports the base credentials directly.
- **Two surfaces:**
  - **main** (isaacplans.com): Isaac's site, `/agent` (es `/agente`) and `/admin/agents`.
  - **product** (the new domain): `/{l}/{slug}` (the agent's guide), `/{l}/{slug}/apply`, `/{l}/{slug}/privacy`,
    the client form, and the secure link.
  - The page frame is chosen **at build time**: `next.config.mjs` swaps `components/site-shell/active-shell`, so
    none of Isaac's code ships to product pages.
- **Data protection:**
  - Agents see masked SSN/bank values with a "Show" button, which is audited and refused while impersonating.
  - "Ya la ingresé en Impact" erases those numbers.
  - A QStash job erases them 30 days after completion, and the daily `queue-reconcile` is the backstop.
  - Every access is logged in `sensitive_access_log`, by field name only.
- **Compliance:**
  - Impact's state notices are copied word for word in `lib/impact-disclosures/notices.ts` (source URLs and fetch
    date are in the file).
  - Rhode Island and Washington are blocked for agents' applications.
  - The ToS and DPA in `lib/tenancy/agreements.ts` are DRAFTS until counsel replaces them.

## Setup checklist

### 1. Before anything is public (Phase 0, Isaac)
- [ ] **ACN written approval** (businessethics@acninc.com). It must cover:
  - the agents' sites and the domain;
  - use of Impact's name, logo, prices and card images;
  - Isaac's LLC holding other IBOs' customer data, SSN/bank included (P&P §VIII.2);
  - keeping bank details (§VIII.1);
  - agents typing answers for clients (§III.1);
  - selling leads to IBOs (§III.3);
  - each agent's own Business ID (§I.6).
- [ ] **Counsel** reviews:
  - the ToS + DPA drafts, including the `[OPERATOR LEGAL NAME]` placeholder (bump the versions; the test prints the
    new sha256 to paste in);
  - the privacy page;
  - the state notices, and Montana's "no commissioned agents" line especially.
- [ ] Brand and domain chosen (no provider names); cyber/E&O insurance; an incident plan.
- [ ] For Phase 2: Stripe's written OK naming the vertical. Stripe's restricted list includes "medical benefit
  packages not offered by a government or health insurance company".

### 2. Main Vercel project (isaacplans.com)
| Variable | Value |
|---|---|
| `CRM_OWNER_USER_IDS` | Isaac's admin Clerk id(s), comma separated. **Set before deploying the platform branch.** |
| `PRODUCT_PUBLIC_URL` | `https://<product domain>`. Agents' client links and the main → product redirect use it. |
| `PLATFORM_NAME` | The platform's public name. |
| `RESEND_API_KEY`, `PLATFORM_EMAIL_FROM` | Agent alert emails, e.g. `Name <notifications@<product domain>>`. |
| QStash (existing) | `QSTASH_ENABLED=true`, `QSTASH_TARGET_BASE_URL=https://www.isaacplans.com`. |

Also confirm that every `*_DEFAULT_OWNER_USER_ID` is Isaac's production login id.

### 3. Second Vercel project (the product domain)
- Create it from the same GitHub repo and attach the new domain.
- Set these variables for **builds and runtime**, in every environment:
  - `APP_SURFACE=product`
  - `PRODUCT_PUBLIC_URL`, `PLATFORM_NAME`
  - `DATABASE_URL` and `INTAKE_ENCRYPTION_KEY` (the same values as main)
  - `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`
  - `QSTASH_ENABLED=true`, `QSTASH_TOKEN`, `QSTASH_URL`, and `QSTASH_TARGET_BASE_URL` exactly as on main
  - `PLATFORM_PREVIEW=1` in **Preview only**, so test agents' pages show there.
- Do **not** set any Clerk keys, `AGENT_CRM_*`, `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` or any tracking id.

### 4. Clerk
- Keep sign-up enabled, since invitations use it.
- Allow `https://www.isaacplans.com/en/agent` and `/es/agente` as redirect URLs.
- The Clerk webhook stays as it is. It now skips the GHL sync for agents and may answer 503 (Clerk retries).
- Never give an agent the admin role.

### 5. Resend
Verify the product domain (or a `notifications.` subdomain): SPF, the `resend._domainkey` DKIM record, and DMARC
(start with `p=none`). Create a sending-only API key.

### 6. Database
- Migration `0046_agent_platform` is **applied** (2026-11-23). C2 added no migration.
- A fake test agent `maria-prueba` (`is_test`, fake WhatsApp and IBO, placeholder owner id
  `user_test_maria_prueba`, test agreement rows) exists for checks. Delete it, or keep it as a test agent, before
  launch.

## Pilot flow
1. `/en/admin/agents` → **Add agent** (test agent is ticked by default) → **Invite or link**.
2. The agent signs up from the invitation, accepts the ToS + DPA at `/agent/agreements` and fills in `/agent/profile`.
3. Isaac clicks **Activate**.
4. While `TENANT_PUBLIC_PAGES` is off, a test agent's guide shows only on a product **preview** with
   `PLATFORM_PREVIEW=1`.

## Launch gates (all off)
| Gate | Turns on | Only after |
|---|---|---|
| `TENANT_PUBLIC_PAGES` | Real agents' public guides and Apply | ACN approval, agreements final |
| `TENANT_CLIENT_DATA` | Real (non-test) agents working real applications | ACN approval (data), counsel, QStash on both projects |
| `LEAD_STORE` | Phase 2 lead sales | ACN + Stripe approval |

## Testing
- **Offline:** `pnpm test:tenancy`, `pnpm test:agent-data`, `pnpm test:intake-autosave`, `pnpm test:quote-prefill`.
- **Product surface locally:**
  - Build with `APP_SURFACE=product PRODUCT_PUBLIC_URL=http://localhost:3009 PLATFORM_PREVIEW=1 pnpm build`.
    Use `NODE_OPTIONS=--max-old-space-size=4096`, and never build while a dev server runs.
  - Then run `next start -p 3009` with the same variables.
  - The main build is a separate `pnpm build`; the frame is chosen at build time.
- **Live with a test agent:**
  - a client save that includes a phone sends a "started" email;
  - completion sends an email and queues the purge;
  - "Ya la ingresé en Impact" erases the numbers;
  - `sensitive_access_log` shows reveal, purge, denied and secure_submit rows.

## Not built yet
- **Phase 2, lead store:** consent text naming the agent, `/admin/leads`, `/agent/leads`, and prepaid credits
  through Stripe Payment Links (then Checkout + webhook).
- **Phase 3:**
  - connecting an agent's own GHL and CrankWheel;
  - self-serve sign-up and custom domains;
  - an agent area on the product domain (Clerk satellite);
  - Isaac as tenant #1, KMS keys per agent, and Clerk Organizations.
- **Known gap:** the dashboard's phone column is filled only when the agent creates the application, so
  applications started from a guide show no WhatsApp/SMS buttons on their dashboard row (the form view has them).
