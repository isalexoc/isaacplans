import { AlertTriangle, Check } from "lucide-react";
import { BENEFIT_LABELS } from "@/lib/illustration-studio/defaults";
import { formatCurrency, formatLongDate } from "@/lib/illustration-studio/format";
import type { BenefitFrequency, IllustrationExtraction } from "@/lib/illustration-studio/types";

const FREQUENCY: Record<BenefitFrequency, string> = {
  lump_sum: "lump sum",
  monthly: "per month",
  annual: "per year",
};

function Verified({ ok }: { ok: boolean }) {
  return ok ? (
    <Check className="inline h-3.5 w-3.5 text-green-600" aria-label="Found in the PDF" />
  ) : (
    <AlertTriangle className="inline h-3.5 w-3.5 text-amber-600" aria-label="Not found in the PDF" />
  );
}

function Facts({ items }: { items: [string, string | number | null | undefined][] }) {
  const shown = items.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-3 gap-y-1">
      {shown.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const money = (value: number | null) => (value === null ? "—" : formatCurrency(value));

/**
 * Everything the AI read from the illustration, with the grounding verdict on each number — so the
 * agent can check the summary without reopening the carrier's PDF.
 */
export default function IllustrationFacts({ extraction }: { extraction: IllustrationExtraction }) {
  const { insured, agent, meta } = extraction;
  return (
    <details className="rounded-lg border bg-white p-5 text-sm shadow-sm dark:bg-gray-950">
      <summary className="cursor-pointer select-none text-base font-semibold">What the AI read from the illustration</summary>
      <div className="mt-4 space-y-5">
        <Facts
          items={[
            ["Insured", [insured.name, insured.gender, insured.issueAge !== null ? `age ${insured.issueAge}` : null].filter(Boolean).join(", ")],
            ["Risk class", insured.riskClass],
            ["Issue state", insured.state],
            ["Product", [extraction.carrierName, extraction.productName].filter(Boolean).join(" ")],
            ["Issued by", [extraction.issuingCompany, extraction.issuerAddress].filter(Boolean).join(", ")],
            ["Policy form", extraction.policyForm],
            ["Death benefit option", extraction.deathBenefitOption],
            ["Illustrated rate", extraction.illustratedRate !== null ? `${extraction.illustratedRate}%` : null],
            ["Prepared", extraction.preparedDate ? formatLongDate(extraction.preparedDate) : null],
            ["Agent", [agent.name, agent.phone, agent.email, agent.license ? `lic. ${agent.license}` : null].filter(Boolean).join(" · ")],
          ]}
        />

        <div>
          <h3 className="mb-2 font-semibold">Living-benefit riders</h3>
          {extraction.livingBenefits.length === 0 ? (
            <p className="text-muted-foreground">None listed.</p>
          ) : (
            <ul className="space-y-3">
              {extraction.livingBenefits.map((benefit, i) => (
                <li key={`${benefit.type}-${i}`}>
                  <div className="font-medium">
                    {benefit.riderName} <span className="font-normal text-muted-foreground">· {BENEFIT_LABELS[benefit.type]}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {[
                      benefit.maxPercentOfDeathBenefit !== null ? `up to ${benefit.maxPercentOfDeathBenefit}% of the death benefit` : null,
                      benefit.maxAmount !== null ? `max ${formatCurrency(benefit.maxAmount)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No maximum stated"}
                    {benefit.maxAmount !== null && (
                      <>
                        {" "}
                        <Verified ok={benefit.maxAmountVerified} />
                      </>
                    )}
                  </div>
                  {benefit.examples.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-4 text-xs">
                      {benefit.examples.map((example, j) => (
                        <li key={j} className={example.verified ? "" : "text-amber-700 dark:text-amber-400"}>
                          <Verified ok={example.verified} /> {example.age !== null ? `Age ${example.age}: ` : ""}
                          <span className="tabular-nums">{formatCurrency(example.amount)}</span> {FREQUENCY[example.frequency]}
                          {example.kind === "max_acceleration" ? " (accelerated, before discount)" : ""}
                          {example.label ? ` — ${example.label}` : ""}
                          {example.verified ? "" : " — not found in the PDF, left out"}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          {extraction.otherRiders.length > 0 && (
            <p className="mt-3 text-muted-foreground">Other riders: {extraction.otherRiders.join(", ")}</p>
          )}
        </div>

        <details>
          <summary className="cursor-pointer select-none font-semibold">
            Ledger — current illustrated scale ({extraction.ledger.length} rows)
          </summary>
          <div className="mt-2 max-h-96 overflow-auto rounded border">
            <table className="w-full text-right text-xs tabular-nums">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Year</th>
                  <th className="px-2 py-1.5">Age</th>
                  <th className="px-2 py-1.5">Premium</th>
                  <th className="px-2 py-1.5">Accumulation</th>
                  <th className="px-2 py-1.5">Cash surrender</th>
                  <th className="px-2 py-1.5">Death benefit</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {extraction.ledger.map((row) => (
                  <tr key={row.policyYear} className={`border-t ${row.verified ? "" : "bg-amber-50 dark:bg-amber-950/40"}`}>
                    <td className="px-2 py-1">{row.policyYear}</td>
                    <td className="px-2 py-1">{row.age}</td>
                    <td className="px-2 py-1">{money(row.premiumOutlay)}</td>
                    <td className="px-2 py-1">{money(row.accumulationValue)}</td>
                    <td className="px-2 py-1">{money(row.cashSurrenderValue)}</td>
                    <td className="px-2 py-1">{money(row.deathBenefit)}</td>
                    <td className="px-2 py-1">
                      <Verified ok={row.verified} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <p className="text-xs text-muted-foreground">
          Read {meta.pageCount} pages with {meta.model}
          {meta.droppedPages.length > 0
            ? ` — pages ${meta.droppedPages.join(", ")} were left out to fit (the least number-heavy ones).`
            : "."}
        </p>
      </div>
    </details>
  );
}
