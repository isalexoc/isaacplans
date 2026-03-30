import { ArrowRight, ClipboardCheck, FileSearch, ShieldCheck } from "lucide-react";

export type UhoneEnrollmentStepsProps = {
  title: string;
  subtitle: string;
  step1Title: string;
  step1Body: string;
  step2Title: string;
  step2Body: string;
  step3Title: string;
  step3Body: string;
};

const STEP_ICONS = [FileSearch, ClipboardCheck, ShieldCheck] as const;

export default function UhoneEnrollmentSteps({
  title,
  subtitle,
  step1Title,
  step1Body,
  step2Title,
  step2Body,
  step3Title,
  step3Body,
}: UhoneEnrollmentStepsProps) {
  const steps = [
    { title: step1Title, body: step1Body },
    { title: step2Title, body: step2Body },
    { title: step3Title, body: step3Body },
  ];

  return (
    <section
      className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-muted/40 via-background to-background py-14 sm:py-16 lg:py-20"
      aria-labelledby="uhone-enrollment-steps-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15] dark:opacity-[0.1]"
        aria-hidden
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.4) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="uhone-enrollment-steps-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
        </div>

        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-8">
          {steps.map((step, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <li key={i} className="relative flex flex-col items-center text-center">
                <div className="relative z-[1] flex flex-col items-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[hsl(var(--custom)/0.25)] bg-gradient-to-br from-[hsl(var(--custom)/0.18)] to-background shadow-lg ring-4 ring-background dark:from-[hsl(var(--custom)/0.22)]">
                    <Icon
                      className="h-9 w-9 text-[hsl(var(--custom))]"
                      aria-hidden
                      strokeWidth={1.75}
                    />
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--custom)/0.12)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[hsl(var(--custom))] dark:bg-[hsl(var(--custom)/0.2)]">
                    {i + 1}
                    <ArrowRight className="h-3 w-3 opacity-70" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
