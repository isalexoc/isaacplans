import type { AcaConfirmationRenderedForm } from "@/lib/aca-confirmation/types";

/**
 * The confirmation text as a document card: shared by the client's signing page and the agent's
 * preview in the dialog, so both show exactly what will be signed.
 *
 * Always light, whatever the site theme: it reads as a paper form, and the PDF the client is
 * effectively signing is black on white. No hooks, so it renders on the server or the client.
 */
export default function ConfirmationDocument({
  form,
  compact = false,
}: {
  form: AcaConfirmationRenderedForm;
  /** Smaller type for the dialog preview. */
  compact?: boolean;
}) {
  const body = compact ? "text-[13px] leading-relaxed" : "text-[15px] leading-relaxed";
  const fine = compact ? "text-[11px] leading-snug" : "text-xs leading-relaxed";

  return (
    <article
      lang={form.language}
      className="rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm [color-scheme:light]"
    >
      <div className={compact ? "space-y-3 p-4" : "space-y-4 p-5 sm:p-6"}>
        <h2
          className={`text-center font-bold uppercase tracking-wide text-gray-900 ${
            compact ? "text-xs" : "text-sm sm:text-base"
          }`}
        >
          {form.title}
        </h2>

        {form.blocks.map((block, i) => {
          if (block.kind === "paragraph") {
            return (
              <p key={i} className={body}>
                {block.text}
              </p>
            );
          }
          if (block.kind === "fields") {
            return (
              <dl key={i} className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-gray-50/60">
                {block.rows.map((row) => (
                  <div key={row.label} className="grid gap-0.5 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-3">
                    <dt className={`${compact ? "text-[11px]" : "text-xs"} text-gray-500`}>{row.label}</dt>
                    <dd className={`${compact ? "text-[13px]" : "text-sm"} break-words font-medium text-gray-900`}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            );
          }
          return (
            <p key={i} className={`${fine} text-gray-600`}>
              {block.text}
            </p>
          );
        })}
      </div>
    </article>
  );
}
