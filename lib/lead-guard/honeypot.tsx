import { LEAD_HONEYPOT_FIELD } from "./constants";

/**
 * An input people never see or reach (off-screen, aria-hidden, out of the tab order) and that
 * autofill and password managers skip (meaningless name, autocomplete off, ignore attributes).
 * A bot that fills every input fills this one. Place it inside the <form> of a server-action lead
 * form; the server reads it as LEAD_HONEYPOT_FIELD.
 */
export function LeadGuardHoneypot({ locale }: { locale?: string }) {
  const es = locale?.startsWith("es");
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[10000px] top-0 h-px w-px overflow-hidden opacity-0"
    >
      <label>
        {es ? "Deje este campo vacío" : "Leave this field empty"}
        <input
          type="text"
          name={LEAD_HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
          data-1p-ignore=""
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
          data-protonpass-ignore="true"
        />
      </label>
    </div>
  );
}
