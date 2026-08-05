"use client";

/**
 * Final Expense client intake wizard — one question per screen (Typeform/Ethos-style), not the
 * dense multi-field-per-section stepper IUL/ACA use. Thin animated progress bar, icon-illustrated
 * single-select cards, sticky disabled→active Next button. Schema-driven off the same
 * lib/fe-intake/fields.ts catalog the agent dashboard and CRM sync use — only the rendering
 * layer differs from the IUL/ACA pattern.
 *
 * Screens are derived from `data` on every render (not a fixed list): a repeater like
 * `medications` expands into one screen per sub-field per existing row, plus an "add another?"
 * control screen once its `minRows` are satisfied. Answering a field writes straight into `data`
 * (autosaved by useFeIntakeAutosave); Next re-derives the screen list from the just-updated data
 * so a newly revealed conditional field (e.g. `ssn` after `hasSsn = yes`) appears immediately
 * after it. A field's `addressTargets` siblings (city/state/zip) never get their own screen —
 * they're folded onto the same screen as the address search box.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Check,
  User,
  UserRound,
  HeartHandshake,
  Baby,
  Users,
  Sprout,
  HelpCircle,
  Droplet,
  Syringe,
  HeartPulse,
  Activity,
  Brain,
  CircleDot,
  Bone,
  Phone,
  type LucideIcon,
} from "lucide-react";
import IntakeAddressInput, { type ResolvedAddress } from "@/components/shared/intake-address-input";
import { MONTHS, buildDobIso, splitDobIso } from "@/lib/intake-shared/format";
import { fetchFeIntake, completeFeIntake, searchMedications } from "@/lib/fe-intake-api";
import { useFeIntakeAutosave } from "@/hooks/use-fe-intake-autosave";
import {
  FE_SECTIONS,
  isFieldVisible,
  emptyRow,
  fieldByKey,
  type FeField,
  type RepeaterRow,
} from "@/lib/fe-intake/fields";
import { fieldFormatError } from "@/lib/fe-intake/validation";
import {
  UI,
  pickLocale,
  tr,
  fieldLabel,
  fieldHelp,
  fieldNote,
  fieldPlaceholder,
  optionLabel,
  applyDrugToken,
  type FeLocale,
} from "@/lib/fe-intake/ui-strings";
import type { FeIntakeData } from "@/lib/fe-intake/schema";
import type { FeIntakeSession } from "@/lib/fe-intake/types";

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// ─── Screen model — derived from data, not a fixed list ──────────────────────

type Screen =
  | { screenKey: string; kind: "field"; field: FeField }
  | { screenKey: string; kind: "repeaterRow"; field: FeField; repeaterKey: string; rowIndex: number }
  | { screenKey: string; kind: "addAnother"; repeaterKey: string; rowIndex: number }
  | { screenKey: string; kind: "finish" };

/** Sibling keys folded onto an `address` field's own screen — never their own screen. */
function addressTargetKeys(fields: FeField[]): Set<string> {
  const keys = new Set<string>();
  for (const f of fields) {
    if (f.type !== "address" || !f.addressTargets) continue;
    if (f.addressTargets.city) keys.add(f.addressTargets.city);
    if (f.addressTargets.state) keys.add(f.addressTargets.state);
    if (f.addressTargets.zip) keys.add(f.addressTargets.zip);
  }
  return keys;
}

function buildScreens(data: FeIntakeData): Screen[] {
  const screens: Screen[] = [];
  for (const section of FE_SECTIONS) {
    const foldedKeys = addressTargetKeys(section.fields);
    for (const field of section.fields) {
      if (foldedKeys.has(field.key)) continue;
      if (!isFieldVisible(field, data)) continue;
      if (field.type !== "repeater") {
        screens.push({ screenKey: `field:${field.key}`, kind: "field", field });
        continue;
      }
      const rows: RepeaterRow[] = Array.isArray(data[field.key]) ? (data[field.key] as RepeaterRow[]) : [];
      const minRows = field.minRows ?? 1;
      const maxRows = field.maxRows ?? 15;
      const rowCount = Math.max(minRows, rows.length);
      for (let i = 0; i < rowCount; i++) {
        const row = rows[i] ?? {};
        for (const sub of field.rowFields ?? []) {
          if (!isFieldVisible(sub, row as Record<string, unknown>)) continue;
          screens.push({
            screenKey: `repeater:${field.key}:${i}:${sub.key}`,
            kind: "repeaterRow",
            field: sub,
            repeaterKey: field.key,
            rowIndex: i,
          });
        }
        // Only offer "add another" once the mandatory minimum rows are satisfied.
        if (i >= minRows - 1 && i < maxRows - 1) {
          screens.push({ screenKey: `addAnother:${field.key}:${i}`, kind: "addAnother", repeaterKey: field.key, rowIndex: i });
        }
      }
    }
  }
  screens.push({ screenKey: "finish", kind: "finish" });
  return screens;
}

function rowOf(data: FeIntakeData, repeaterKey: string, rowIndex: number): Record<string, unknown> {
  const rows = Array.isArray(data[repeaterKey]) ? (data[repeaterKey] as RepeaterRow[]) : [];
  return (rows[rowIndex] ?? {}) as Record<string, unknown>;
}

function containerFor(screen: Screen, data: FeIntakeData): Record<string, unknown> {
  return screen.kind === "repeaterRow" ? rowOf(data, screen.repeaterKey, screen.rowIndex) : data;
}

function isScreenValid(screen: Screen, data: FeIntakeData): boolean {
  if (screen.kind === "finish" || screen.kind === "addAnother") return true;
  const container = containerFor(screen, data);
  const field = screen.field;
  const value = str(container[field.key]).trim();
  if (field.required && !value) return false;
  if (value && fieldFormatError(field, value)) return false;

  // An address screen bundles its city/state/zip siblings — all of them must be valid too.
  if (field.type === "address" && field.addressTargets) {
    for (const key of [field.addressTargets.city, field.addressTargets.state, field.addressTargets.zip]) {
      if (!key) continue;
      const sibling = fieldByKey(key);
      const siblingValue = str(container[key]).trim();
      if (sibling?.required && !siblingValue) return false;
      if (siblingValue && sibling && fieldFormatError(sibling, siblingValue)) return false;
    }
  }
  return true;
}

/**
 * Resume at the screen the client last had open (`data.__cursor`, updated on every Next/Back),
 * not the first unanswered field. A pre-filled-from-CRM field (name/email/phone/DOB/address
 * reused from an earlier CTA submission) is deliberately still its own screen the first time —
 * confirmed with a tap, not silently skipped — so a typo from the ad form gets one more look
 * before it flows into an actual insurance application.
 */
function resumeScreenKey(screens: Screen[], data: FeIntakeData): string {
  const cursor = typeof data.__cursor === "string" ? data.__cursor : null;
  if (cursor && screens.some((s) => s.screenKey === cursor)) return cursor;
  return screens[0].screenKey;
}

// ─── Icon choices for single-select "card" questions ──────────────────────────

const RELATIONSHIP_ICON: Record<string, LucideIcon> = {
  Self: User,
  Spouse: HeartHandshake,
  Son: Baby,
  Daughter: Baby,
  Parent: Users,
  Sibling: Users,
  Grandchild: Sprout,
  Other: HelpCircle,
};
const GENDER_ICON: Record<string, LucideIcon> = { Male: User, Female: UserRound };
const USAGE_ICON: Record<string, LucideIcon> = {
  Cholesterol: Droplet,
  Diabetes: Syringe,
  "Blood Pressure": HeartPulse,
  "Heart Disease": Activity,
  "Depression/Anxiety": Brain,
  Thyroid: CircleDot,
  "Pain/Arthritis": Bone,
  Other: HelpCircle,
};

function iconForOption(fieldKey: string, value: string): LucideIcon {
  if (value === "yes") return CheckCircle2;
  if (value === "no") return XCircle;
  if (fieldKey === "relationship") return RELATIONSHIP_ICON[value] ?? HelpCircle;
  if (fieldKey === "gender") return GENDER_ICON[value] ?? User;
  if (fieldKey === "usage") return USAGE_ICON[value] ?? HelpCircle;
  return HelpCircle;
}

// ─── Shared styling ────────────────────────────────────────────────────────────

const BIG_INPUT =
  "w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-lg text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100";

const SMALL_INPUT =
  "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100";

const SMALL_LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

function ChoiceCard({
  selected,
  icon: Icon,
  label,
  onClick,
}: {
  selected: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
        selected
          ? "border-brand bg-brand/5"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          selected ? "bg-brand text-white" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{label}</span>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-brand bg-brand" : "border-gray-300 dark:border-gray-700"
        }`}
      >
        {selected && <Check className="h-4 w-4 text-white" />}
      </span>
    </button>
  );
}

function DrugSearchInput({
  value,
  onChange,
  placeholder,
  locale,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  locale: FeLocale;
}) {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [notListed, setNotListed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (notListed || value.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const handle = setTimeout(() => {
      searchMedications(value)
        .then((r) => {
          if (active) setResults(r);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [value, notListed]);

  return (
    <div>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder={notListed ? undefined : placeholder}
        className={BIG_INPUT}
      />
      {!notListed && open && value.trim().length >= 2 && (
        <div className="mt-2 max-h-60 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {tr(UI.searching, locale)}
            </div>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{tr(UI.noMatches, locale)}</p>
          ) : (
            results.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {name}
              </button>
            ))
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setNotListed((n) => !n);
          setOpen(false);
        }}
        className="mt-2 text-sm font-medium text-brand underline"
      >
        {tr(UI.notListed, locale)}
      </button>
    </div>
  );
}

function DobInput({ value, onChange, locale }: { value: string; onChange: (v: string) => void; locale: FeLocale }) {
  const { month, day, year } = splitDobIso(value);
  const months = MONTHS[locale];
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => String(i + 1)), []);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 101 }, (_, i) => String(currentYear - 100 + i));
  }, []);

  function update(nextMonth: string, nextDay: string, nextYear: string) {
    onChange(buildDobIso(nextMonth, nextDay, nextYear));
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <select autoFocus value={month} onChange={(e) => update(e.target.value, day, year)} className={BIG_INPUT}>
        <option value="">{tr(UI.dobMonth, locale)}</option>
        {months.map((m, i) => (
          <option key={m} value={String(i + 1)}>
            {m}
          </option>
        ))}
      </select>
      <select value={day} onChange={(e) => update(month, e.target.value, year)} className={BIG_INPUT}>
        <option value="">{tr(UI.dobDay, locale)}</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select value={year} onChange={(e) => update(month, day, e.target.value)} className={BIG_INPUT}>
        <option value="">{tr(UI.dobYear, locale)}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

const HEIGHT_RE = /^(\d+)'(\d+)"?$/;

function HeightInput({ value, onChange, locale }: { value: string; onChange: (v: string) => void; locale: FeLocale }) {
  const match = HEIGHT_RE.exec(value.trim());
  const feet = match ? match[1] : "";
  const inches = match ? match[2] : "";

  function update(nextFeet: string, nextInches: string) {
    onChange(nextFeet && nextInches ? `${nextFeet}'${nextInches}"` : "");
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <select autoFocus value={feet} onChange={(e) => update(e.target.value, inches)} className={BIG_INPUT}>
        <option value="">{tr(UI.heightFeet, locale)}</option>
        {[3, 4, 5, 6, 7, 8].map((f) => (
          <option key={f} value={String(f)}>
            {f} ft
          </option>
        ))}
      </select>
      <select value={inches} onChange={(e) => update(feet, e.target.value)} className={BIG_INPUT}>
        <option value="">{tr(UI.heightInches, locale)}</option>
        {Array.from({ length: 12 }, (_, i) => i).map((i) => (
          <option key={i} value={String(i)}>
            {i} in
          </option>
        ))}
      </select>
    </div>
  );
}

export default function FeIntakeForm({ token }: { token: string }) {
  const locale = pickLocale(useLocale());
  const [session, setSession] = useState<FeIntakeSession | null>(null);
  const [data, setData] = useState<FeIntakeData>({});
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [currentKey, setCurrentKey] = useState<string>("finish");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await fetchFeIntake(token);
        if (!active) return;
        setSession(s);
        setData(s.data ?? {});
        const screens = buildScreens(s.data ?? {});
        setCurrentKey(resumeScreenKey(screens, s.data ?? {}));
        setLoadState("ready");
      } catch {
        if (active) setLoadState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const autosave = useFeIntakeAutosave({
    token,
    data,
    onSaved: () =>
      setSession((prev) => (prev && prev.status === "draft" ? { ...prev, status: "in_progress" } : prev)),
  });

  const screens = useMemo(() => buildScreens(data), [data]);
  const idx = Math.max(0, screens.findIndex((s) => s.screenKey === currentKey));
  const screen = screens[idx] ?? screens[screens.length - 1];
  const progressPct = Math.round((idx / Math.max(1, screens.length - 1)) * 100);

  const isOwner = session?.role === "owner";
  const locked = Boolean(session && !isOwner && session.status === "completed" && !session.reopenedForClient);

  function setFieldValue(key: string, value: string) {
    setData({ ...data, [key]: value });
  }

  function setRowValue(repeaterKey: string, rowIndex: number, subKey: string, value: string) {
    const fieldDef = fieldByKey(repeaterKey);
    if (!fieldDef) return;
    const rows: RepeaterRow[] = Array.isArray(data[repeaterKey]) ? [...(data[repeaterKey] as RepeaterRow[])] : [];
    while (rows.length <= rowIndex) rows.push(emptyRow(fieldDef));
    rows[rowIndex] = { ...rows[rowIndex], [subKey]: value };
    setData({ ...data, [repeaterKey]: rows });
  }

  /** Writes into whichever container (top-level data, or a repeater row) the active screen uses. */
  function handleChangeField(key: string, value: string) {
    if (screen.kind === "repeaterRow") {
      setRowValue(screen.repeaterKey, screen.rowIndex, key, value);
    } else {
      setFieldValue(key, value);
    }
  }

  function handleAddressResolve(field: FeField, resolved: ResolvedAddress) {
    const next: FeIntakeData = { ...data, [field.key]: field.addressTargets ? resolved.line1 : resolved.formatted };
    if (field.addressTargets?.city) next[field.addressTargets.city] = resolved.city;
    if (field.addressTargets?.state) next[field.addressTargets.state] = resolved.state;
    if (field.addressTargets?.zip) next[field.addressTargets.zip] = resolved.zip;
    setData(next);
  }

  function goNext() {
    const next = screens[idx + 1] ?? screens[screens.length - 1];
    setData({ ...data, __cursor: next.screenKey });
    setCurrentKey(next.screenKey);
  }

  function goBack() {
    if (idx === 0) return;
    const prev = screens[idx - 1];
    setData({ ...data, __cursor: prev.screenKey });
    setCurrentKey(prev.screenKey);
  }

  function handleAddAnother(repeaterKey: string, rowIndex: number, wantsMore: boolean) {
    const fieldDef = fieldByKey(repeaterKey);
    if (!fieldDef) return;
    const rows: RepeaterRow[] = Array.isArray(data[repeaterKey]) ? [...(data[repeaterKey] as RepeaterRow[])] : [];
    if (wantsMore) {
      while (rows.length <= rowIndex + 1) rows.push(emptyRow(fieldDef));
    }

    const newScreens = buildScreens({ ...data, [repeaterKey]: wantsMore ? rows : rows.slice(0, rowIndex + 1) });
    const firstSubKey = fieldDef.rowFields?.[0]?.key ?? "";
    const targetKey = wantsMore
      ? `repeater:${repeaterKey}:${rowIndex + 1}:${firstSubKey}`
      : `addAnother:${repeaterKey}:${rowIndex}`;
    const targetIdx = newScreens.findIndex((s) => s.screenKey === targetKey);
    const target = wantsMore ? newScreens[targetIdx] : newScreens[targetIdx + 1];
    const targetScreenKey = (target ?? newScreens[newScreens.length - 1]).screenKey;

    const nextData: FeIntakeData = {
      ...data,
      [repeaterKey]: wantsMore ? rows : rows.slice(0, rowIndex + 1),
      __cursor: targetScreenKey,
    };
    setData(nextData);
    setCurrentKey(targetScreenKey);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await autosave.saveNow();
      const result = await completeFeIntake(token);
      if (!result.success) {
        setSubmitError(result.message ?? tr(UI.errRequired, locale));
        setSubmitting(false);
        return;
      }
      setJustSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {tr(UI.loading, locale)}
      </div>
    );
  }
  if (loadState === "error" || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-red-600">
        <AlertCircle className="mr-2 h-5 w-5" /> {tr(UI.loadError, locale)}
      </div>
    );
  }
  if (locked || justSubmitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-brand" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{tr(UI.thankYouTitle, locale)}</h1>
        <p className="max-w-sm text-muted-foreground">{tr(UI.thankYouBody, locale)}</p>
      </div>
    );
  }

  const valid = isScreenValid(screen, data);
  const phoneNumber = process.env.NEXT_PUBLIC_PHONE_NUMBER;
  const container = containerFor(screen, data);

  return (
    // `h-dvh` + `overflow-hidden` pins the header/progress bar and the Next button to the
    // visible viewport; only the question area scrolls. Fixes the Next button landing below
    // the fold on mobile when `min-h-screen` let the page grow taller than the real viewport.
    <div className="flex h-dvh flex-col overflow-hidden bg-white dark:bg-gray-950">
      {/* Progress bar */}
      <div className="h-1.5 w-full shrink-0 bg-gray-100 dark:bg-gray-800">
        <motion.div
          className="h-full bg-gradient-to-r from-brand to-accent"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Chrome */}
      <header className="flex shrink-0 items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={goBack}
          disabled={idx === 0}
          aria-label={tr(UI.back, locale)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold text-brand">Isaac Plans</span>
        {phoneNumber ? (
          <a
            href={`tel:${phoneNumber}`}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Phone className="h-3.5 w-3.5" /> {tr(UI.needHelp, locale)}
          </a>
        ) : (
          <span />
        )}
      </header>

      {/* Question — the only scrollable area, so the footer below always stays on screen */}
      <main className="flex-1 overflow-y-auto px-5 pb-4 pt-2">
        <div className="mx-auto w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen.screenKey}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {screen.kind === "finish" ? (
                <FinishScreen
                  locale={locale}
                  submitting={submitting}
                  submitError={submitError}
                  onSubmit={handleSubmit}
                />
              ) : screen.kind === "addAnother" ? (
                <AddAnotherScreen
                  locale={locale}
                  repeaterKey={screen.repeaterKey}
                  onAnswer={(more) => handleAddAnother(screen.repeaterKey, screen.rowIndex, more)}
                />
              ) : (
                <FieldScreen
                  field={screen.field}
                  container={container}
                  locale={locale}
                  onChangeField={handleChangeField}
                  onAddressResolve={(resolved) => handleAddressResolve(screen.field, resolved)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Sticky Next footer — pinned to the visible viewport, never pushed off-screen */}
      {screen.kind !== "addAnother" && screen.kind !== "finish" && (
        <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              disabled={!valid}
              onClick={goNext}
              className={`w-full rounded-2xl px-6 py-4 text-center text-base font-semibold transition ${
                valid
                  ? "bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
                  : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600"
              }`}
            >
              {tr(UI.next, locale)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldScreen({
  field,
  container,
  locale,
  onChangeField,
  onAddressResolve,
}: {
  field: FeField;
  container: Record<string, unknown>;
  locale: FeLocale;
  onChangeField: (key: string, value: string) => void;
  onAddressResolve: (resolved: ResolvedAddress) => void;
}) {
  const value = str(container[field.key]);
  const onChange = (v: string) => onChangeField(field.key, v);
  const isMedicationUsage = field.key === "usage" || field.key === "usageOther";
  const headline = isMedicationUsage
    ? applyDrugToken(fieldLabel(field, locale), str(container.drugName), locale)
    : fieldLabel(field, locale);

  return (
    <div>
      <h1 className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">{headline}</h1>
      {fieldHelp(field, locale) && <p className="mt-2 text-sm text-muted-foreground">{fieldHelp(field, locale)}</p>}

      <div className="mt-6">
        {field.type === "select" && field.options ? (
          <div className="space-y-2.5" role="radiogroup">
            {field.options.map((opt) => (
              <ChoiceCard
                key={opt.value}
                selected={value === opt.value}
                icon={iconForOption(field.key, opt.value)}
                label={optionLabel(opt, locale)}
                onClick={() => onChange(opt.value)}
              />
            ))}
          </div>
        ) : field.type === "address" ? (
          <div className="space-y-4">
            <IntakeAddressInput
              id={field.key}
              value={value}
              onChange={onChange}
              onResolve={onAddressResolve}
              placeholder={fieldPlaceholder(field, locale)}
              locale={locale}
            />
            {field.addressTargets && (
              <div className="grid grid-cols-2 gap-3">
                {field.addressTargets.city && (
                  <div className="col-span-2">
                    <label className={SMALL_LABEL}>{optionLabelForField(field.addressTargets.city, locale)}</label>
                    <input
                      value={str(container[field.addressTargets.city])}
                      onChange={(e) => onChangeField(field.addressTargets!.city!, e.target.value)}
                      className={SMALL_INPUT}
                    />
                  </div>
                )}
                {field.addressTargets.state && (
                  <div>
                    <label className={SMALL_LABEL}>{optionLabelForField(field.addressTargets.state, locale)}</label>
                    <input
                      value={str(container[field.addressTargets.state])}
                      onChange={(e) => onChangeField(field.addressTargets!.state!, e.target.value)}
                      className={SMALL_INPUT}
                    />
                  </div>
                )}
                {field.addressTargets.zip && (
                  <div>
                    <label className={SMALL_LABEL}>{optionLabelForField(field.addressTargets.zip, locale)}</label>
                    <input
                      value={str(container[field.addressTargets.zip])}
                      onChange={(e) =>
                        onChangeField(field.addressTargets!.zip!, e.target.value.replace(/\D/g, "").slice(0, 5))
                      }
                      inputMode="numeric"
                      className={SMALL_INPUT}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : field.type === "drug" ? (
          <DrugSearchInput value={value} onChange={onChange} placeholder={fieldPlaceholder(field, locale)} locale={locale} />
        ) : field.type === "dob" ? (
          <DobInput value={value} onChange={onChange} locale={locale} />
        ) : field.type === "height" ? (
          <HeightInput value={value} onChange={onChange} locale={locale} />
        ) : field.type === "zip" ? (
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, field.maxLength ?? 5))}
            placeholder={fieldPlaceholder(field, locale)}
            className={BIG_INPUT}
          />
        ) : field.type === "ssn" ? (
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, field.maxLength ?? 9))}
            placeholder="123456789"
            className={BIG_INPUT}
          />
        ) : (
          <input
            autoFocus
            type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
            inputMode={field.type === "tel" ? "tel" : field.digitsOnly ? "numeric" : undefined}
            value={value}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(field.digitsOnly ? raw.replace(/\D/g, "").slice(0, field.maxLength) : raw);
            }}
            placeholder={fieldPlaceholder(field, locale)}
            className={BIG_INPUT}
          />
        )}
      </div>

      {field.key === "hasSsn" && value === "no" && fieldNote(field, locale) && (
        <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/5 p-4 text-sm text-gray-700 dark:text-gray-300">
          {fieldNote(field, locale)}
        </div>
      )}
    </div>
  );
}

/** City/state/zip don't have their own screen, so borrow their catalog label for the inline field. */
function optionLabelForField(key: string, locale: FeLocale): string {
  const field = fieldByKey(key);
  return field ? fieldLabel(field, locale) : key;
}

function AddAnotherScreen({
  locale,
  repeaterKey,
  onAnswer,
}: {
  locale: FeLocale;
  repeaterKey: string;
  onAnswer: (wantsMore: boolean) => void;
}) {
  const dict = repeaterKey === "beneficiaries" ? UI.addBeneficiary : UI.addMedication;
  return (
    <div>
      <h1 className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">{tr(dict, locale)}</h1>
      <div className="mt-6 space-y-2.5">
        <ChoiceCard selected={false} icon={CheckCircle2} label={locale === "es" ? "Sí" : "Yes"} onClick={() => onAnswer(true)} />
        <ChoiceCard selected={false} icon={XCircle} label="No" onClick={() => onAnswer(false)} />
      </div>
    </div>
  );
}

function FinishScreen({
  locale,
  submitting,
  submitError,
  onSubmit,
}: {
  locale: FeLocale;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">{tr(UI.thankYouTitle, locale)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{tr(UI.submitApplication, locale)}</p>
      {submitError && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {submitError}
        </p>
      )}
      <button
        type="button"
        disabled={submitting}
        onClick={onSubmit}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-accent px-6 py-4 text-base font-semibold text-white shadow-md shadow-brand/30 transition hover:opacity-95 disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? tr(UI.submitting, locale) : tr(UI.submitApplication, locale)}
      </button>
    </div>
  );
}
