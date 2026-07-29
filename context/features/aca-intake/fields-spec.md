# ACA Intake — Field Spec (DRAFT for review)

Mirrors the IUL intake (`/iul/intake`) pattern: agent creates a session → secure token link →
client fills a multi-step, autosaving form on their phone → data lands in Neon (sensitive fields
encrypted) and syncs to Agent CRM.

**Status:** proposal — Isaac to edit/add/remove before any code is written.
**Rev 2 — 2026-07-28.** Trimmed hard per Isaac's review: consent, tax filing, per-member income,
current coverage, health factors, and the attestation step are all gone. Immigration data is now
collected as **document uploads instead of typed fields**.

Legend:
- **R** = required to submit
- **C** = conditional (only shows when a prior answer triggers it)
- 🔒 = sensitive → encrypted at rest, masked in the UI, reveal is admin-only
- 👤 = owner-only → the client never sees it; only the agent filling in the dashboard
- 🔁 = repeats per household member
- 📷 = file upload with mobile camera capture (take a photo *or* pick a file)

---

## The one big structural difference from IUL

IUL collects **one insured** + up to 4 beneficiary slots. ACA collects a **household** — every member
needs their own DOB, SSN, and citizenship status.

So the new UI piece is a **household members repeater** (up to 8), the same way `beneficiaries` is a
composite field type today. Row 1 is the primary applicant, prefilled from Step 1.

**Assumption to confirm:** everyone listed in the repeater is applying for coverage. There's no longer
a per-member "are you applying?" flag, so if you ever list someone who's in the household but *not*
going on the plan, we'd have no way to tell them apart. Say the word if that case comes up.

---

## Step sequence (what the client walks through)

| # | Step | Why here |
|---|------|----------|
| 1 | About you (primary applicant) | Easiest questions first — builds momentum. |
| 2 | Home address & county | County drives the rating area, so it must be exact. |
| 3 | Household members 🔁 | The heavy step, placed after they're invested. SSNs and citizenship docs live here. |
| 4 | Household income | One question, its own screen. The most important number on the form. |
| 5 | Doctors & prescriptions | Gated behind yes/no — skips entirely for healthy clients. |
| 6 | Documents (optional) | Low pressure, "helps us go faster." |
| 7 | Payment | Highest-friction block, placed last — they've invested everything by now. |
| 8 | 👤 Agent notes | Owner-only, never shown to the client. |

Same philosophy as IUL: cheap questions up front, sensitive identifiers in the middle once there's
sunk cost, money last.

---

## Step 1 — About you (primary applicant)

| Field | Type | Notes |
|---|---|---|
| `firstName` **R** | text | → CRM native |
| `middleName` | text | Marketplace asks; helps ID matching. |
| `lastName` **R** | text | → CRM native |
| `secondLastName` | text | Common for Hispanic clients; the marketplace match fails without it surprisingly often. |
| `dateOfBirth` **R** | dob | → CRM native |
| `sex` **R** | select | Male / Female — must match the SSA record, not gender identity. |
| `ssn` **R** 🔒 | ssn | |
| `maritalStatus` **R** | select | Single / Married / Divorced / Widowed / Separated / Domestic partnership |
| `phone` **R** | tel | → CRM native |
| `altPhone` | tel | |
| `email` **R** | email | → CRM native. Needed for the healthcare.gov account. |

---

## Step 2 — Home address & county

| Field | Type | Notes |
|---|---|---|
| `address1` **R** | address (autocomplete) | No P.O. box. Autofills the four below. |
| `address2` | text | Apt / unit / suite |
| `city` **R** | text | |
| `state` **R** | text | Must be a licensed state — validate against `lib/licensed-states.ts`. |
| `postalCode` **R** | text | 5 digits |
| `county` **R** | select | **Critical.** Rating areas are county-level and one ZIP can span two counties. Auto-suggest from ZIP, but let them confirm. |
| `mailingSameAsHome` **R** | select | Yes/No |
| `mailingAddress` **C** | address | Shows when `mailingSameAsHome = No` |

---

## Step 3 — Household members 🔁 (repeater, up to 8)

Row 1 is the primary applicant. Name / DOB / sex / SSN are prefilled read-only from Step 1, but the
citizenship questions and uploads below are **active for row 1 too** — the primary needs documents
like anyone else.

### Identity
| Field | Type | Notes |
|---|---|---|
| `relationship` **R** | select | Self (row 1) / Spouse / Domestic partner / Son / Daughter / Stepchild / Foster child / Parent / Grandchild / Other relative / Unrelated |
| `firstName` **R** | text | |
| `lastName` **R** | text | |
| `dateOfBirth` **R** | dob | |
| `sex` **R** | select | |
| `ssn` **C** 🔒 | ssn | Required if they have one. |
| `noSsnReason` **C** | select | Shows when SSN is blank. Not eligible for an SSN / Applied but not received / Religious objection |

### Citizenship — three questions, then a photo

No typed immigration data at all. The document carries the A-number, card number, category code and
expiration, so we ask for the picture instead of making a client transcribe numbers off a card on
their phone. Fewer typos, faster form, and you get the actual evidence you'd need anyway.

| Field | Type | Notes |
|---|---|---|
| `isUsCitizen` **R** | select | Yes / No |
| `isNaturalizedCitizen` **C R** | select | Shows when `isUsCitizen = Yes`. Yes / No. **Answering No ends this section — nothing further is asked.** |
| `docCitizenshipCertificate` **C R** 📷 | file | Shows when `isNaturalizedCitizen = Yes`. Naturalization certificate or certificate of citizenship. |
| `docLegalPresenceFront` **C R** 📷 | file | Shows when `isUsCitizen = No`. **Front** of the green card / work permit. |
| `docLegalPresenceBack` **C R** 📷 | file | Shows when `isUsCitizen = No`. **Back** of the same card. Both sides required. |

The resulting flow:

```
Are you a US citizen?
├─ Yes → Are you a naturalized citizen?
│        ├─ No  → done, nothing else asked
│        └─ Yes → upload naturalization / citizenship certificate
└─ No  → upload legal presence document, FRONT and BACK
          (green card, work permit, etc.)
```

> **Implementation note:** these are per-member file uploads, which is new. Today
> `allFileFields()` flattens sections and assumes one file per top-level key. Per-member files need a
> composite key (`members[2].docLegalPresenceFront`) in the files API and the CRM media sync. It's the
> one piece of real new plumbing in this build — everything else is config.

> **Mobile:** all 📷 inputs use `capture="environment"` so tapping opens the camera directly, with
> "choose a file" still available. Most clients will photograph the card in place.

---

## Step 4 — Household income

One question, its own screen, asked of the primary applicant.

| Field | Type | Notes |
|---|---|---|
| `expectedAnnualHouseholdIncome` **R** | money | Label renders the live year: *"What is your estimated total family income for 2026?"* Same `{currentYear}` token the IUL form already uses for its income fields. |

---

## Step 5 — Doctors & prescriptions

| Field | Type | Notes |
|---|---|---|
| `hasDoctorsToKeep` **R** | select | Yes/No — "Are there doctors you want to keep seeing?" Gates the repeater below. |
| `doctorsToKeep` **C** 🔁 | repeater | Shows on Yes. Name / Specialty / Facility / City. Up to 5 rows. |
| `hasPrescriptions` **R** | select | Yes/No — "Do you take any prescription medications?" Gates the repeater below. |
| `prescriptions` **C** 🔁 | repeater | Shows on Yes. Drug name / Dosage / Frequency. Up to 10 rows. |
| `interestedInDental` | select | Yes/No — cross-sell |
| `interestedInVision` | select | Yes/No — cross-sell |
| `additionalQuestions` | textarea | "Anything you want Isaac to know?" |

---

## Step 6 — Documents (optional)

Immigration documents are **not** here — they're collected per member in Step 3.

| Field | Type | Notes |
|---|---|---|
| `docPhotoId` 📷 | file | Driver's license or state ID |
| `docSsnCard` 📷 | file | |
| `docProofOfIncome` 📷 | file | Paystubs, tax return, ledger |
| `docCurrentInsuranceCard` 📷 | file | |
| `docOther` 📷 | file | |

---

## Step 7 — Payment

Client-facing. Framing in the copy matters: the binder payment goes to the **carrier** after the plan
is chosen on the call, so this is *"payment details on file so we can set it up the moment you pick a
plan"* — not a charge happening now.

| Field | Type | Notes |
|---|---|---|
| `paymentMethod` **R** | select | Bank draft / Credit card / Debit card |
| `payorSameAsApplicant` **R** | select | Primary applicant / Someone else |
| `payorName` **C** | text | |
| `payorRelationship` **C** | select | Spouse / Parent / Child / Other |
| `bankName` **C R** | text | Shows on bank draft. |
| `routingNumber` **C R** 🔒 | text | 9 digits |
| `accountNumber` **C R** 🔒 | text | |
| `accountType` **C R** | select | Checking / Savings |
| `cardholderName` **C R** | text | Shows on credit/debit card. |
| `cardNumber` **C R** 🔒 | text | |
| `cardExpiration` **C R** 🔒 | text | MM/YY |
| `cardCvv` **C R** 🔒 | text | Stored per Isaac's instruction — see the note in Decisions. |
| `cardBillingZip` **C R** | text | |

---

## Step 8 — 👤 Owner-only (agent side)

| Field | Type | Notes |
|---|---|---|
| `marketplaceAccountExists` 👤 | select | Yes/No/Not sure |
| `marketplaceUsername` 👤 🔒 | text | |
| `marketplaceApplicationId` 👤 | text | Stored **instead of** the password. |
| `planSelected` 👤 | text | |
| `carrierSelected` 👤 | text | |
| `applicationStatus` 👤 | select | Not started / In progress / Submitted / Pending docs / Approved / Enrolled / Declined |
| `agentNotes` 👤 | textarea | |
| `agentNpn` 👤 | text | |

---

## Decisions

### Rev 2 — 2026-07-28

1. **Consent step removed entirely.** Isaac's CRM automation captures CMS consent before the link is
   ever sent, so the form doesn't need to duplicate it.
2. **Step "Household & tax filing" removed entirely** — filing status, dependents, household size,
   MFS exception, custody. All of it.
3. **Immigration → uploads, not typed fields.** Every typed immigration field (A-number, card number,
   I-94, passport, SEVIS, EAD category, entry date, 5-year bar, name-on-document) is gone, replaced by
   the citizen → naturalized → upload flow in Step 3.
4. **Health & status factors removed** — tobacco, pregnancy, student, disability, AI/AN, incarceration,
   foster care.
5. **Other-coverage-per-member removed** — including the employer affordability fields.
6. **Per-member income removed.** One household-level number, asked of the primary, labeled with the
   current year.
7. **Household totals & deductions removed.**
8. **Current coverage & qualifying life event step removed entirely.**
9. **Review / attestation / signature step removed entirely.**
10. **All payment info collected and stored, CVV included.**
11. Individually dropped: `preferredName`, `bestTimeToCall`, `smsConsent`, `livedAtAddressSince`,
    `isTemporaryAddress`, `applyingForCoverage`, `livesAtPrimaryAddress`, `memberAddress`,
    `hospitalsPreferred`, `plannedProcedures`, `planPriority`, `preferredCarrier`,
    `monthlyPremiumBudget`, `preferredPlanType`, `interestedInSupplemental`, `autopayConsent`,
    `preferredDraftDate`, `aptcEstimate`, `preferredLanguage`.

### Three things worth knowing

- **The OEP auto-collapse decision is now moot.** It applied to the qualifying-life-event block, which
  Step 7 removal deleted. Nothing to collapse — no work either way, just closing the loop on it.
- **Tobacco use was the one removal with a direct pricing effect.** Carriers rate tobacco users up to
  1.5× on ACA plans, so a quote built from this form's data alone will be low for a smoker. Presumably
  you're catching that on the call — noting it so it isn't a surprise.
- **CVV storage.** Building it as instructed. Flagging once and then it's settled: PCI-DSS Req. 3.2
  prohibits retaining CVV after authorization, and that's a card-network contractual rule rather than a
  best practice, so the exposure is on the merchant-processing relationship rather than on the app. It
  will be encrypted at rest with `lib/crypto/field-encryption.ts` like every other sensitive field, and
  admin-only to reveal. Your call, your risk — it's built either way.

### Rev 1 — 2026-07-28

1. **Payment — collect it.** Client-facing step, bank draft plus cards.
2. **Marketplace password — not stored.** Username + Application ID only.
3. **Household cap — 8.**
4. **Doctors / prescriptions — structured rows, gated** behind a yes/no.
5. **Subsidy estimate — never shown to the client.**
