/**
 * Adds more ways a client phrases each objection, to raise live-call recall.
 *
 * Every objection already had triggers for the languages it is visible in — this is about DEPTH.
 * The matcher only fires when a spoken phrase resembles a stored one, so recall is a direct
 * function of how many real phrasings each objection carries. Measured before this pass: 10/12 in
 * English, 11/12 in Spanish.
 *
 * Two rules the additions follow, both learned from misses:
 *
 *   1. Write what the CLIENT says, never how the objection is labelled. The IUL titles are stage
 *      directions ("SI DICE QUE NO LE CONVIENE..."); nobody says that out loud.
 *   2. Keep a phrase under ONE objection per product and language. Two objections sharing a phrase
 *      makes the winner arbitrary — which is why the card-vs-bank objection gets "prefiero con
 *      tarjeta" and NOT "no doy mi cuenta bancaria", even though a client might say either.
 *
 * Purely additive and deduplicated, so hand-written phrases are never lost and re-running is safe.
 *
 * Run: pnpm enrich:triggers --dry-run
 *      pnpm enrich:triggers
 */
import "dotenv/config";
import { createClient } from "next-sanity";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "anetxoet",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

type Add = { en?: string[]; es?: string[] };

/** Keyed by document id: the titles are long and editable, and a near-miss would seed the wrong one. */
const ADDITIONS: Record<string, Add> = {
  // ── Final Expense ────────────────────────────────────────────────────────────
  "objection-already-have-life-insurance": {
    en: ["i have coverage already", "my job covers me", "i'm covered through my employer",
         "i already got something", "i have a burial policy"],
    es: ["ya tengo cobertura", "mi trabajo me cubre", "ya tengo un plan", "ya compre uno"],
  },
  "objection-better-price": {
    en: ["can you do better", "that's too high", "any way to lower it", "what's the cheapest",
         "is there a discount"],
  },
  "objection-call-me-back": {
    en: ["can you call me another time", "i'm in the middle of something", "this isn't a good time",
         "call me this afternoon", "try me tomorrow"],
    es: ["puede llamar mas tarde", "llameme en la tarde", "ahorita estoy ocupada",
         "me llama en otro momento"],
  },
  "objection-cant-afford-it": {
    en: ["i don't have the money", "money is tight", "i'm on social security",
         "i live on a fixed income", "that's out of my budget", "i can't do that right now"],
  },
  "objection-didnt-request-this": {
    en: ["i didn't fill anything out", "i never signed up", "i didn't ask for this",
         "where did you get my information", "i don't recall requesting",
         "i never called anybody", "i never called anyone", "i didn't call anybody"],
    es: ["yo no pedi nada", "nunca llene nada", "de donde saco mi numero", "no se de que me habla"],
  },
  "objection-just-shopping": {
    en: ["i'm just looking", "getting a few quotes", "shopping around", "comparing options",
         "seeing what's out there"],
    es: ["estoy viendo opciones", "estoy cotizando", "quiero comparar", "solo pregunto"],
  },
  "objection-mail-me-something": {
    en: ["can you send it to me", "just send me the information", "mail me the details",
         "send it by email", "put something in writing"],
    es: ["mandeme informacion", "envieme por correo", "me lo manda por email", "por escrito"],
  },
  "objection-not-interested": {
    en: ["i'm good thanks", "not right now", "i'm not looking for anything", "i'll pass",
         "no i'm okay"],
    es: ["no estoy interesado", "no estoy interesada", "asi estoy bien", "por ahora no gracias"],
  },
  // Deliberately narrow: this one overlaps "not interested" and "call me back", so it only gets
  // the phrases neither of those should own.
  "objection-not-interested-call-back": {
    en: ["take me off your list", "stop calling me", "do not call me again"],
  },
  "objection-talk-to-my-kids": {
    // "discuss it with my daughter" is here because "discuss THIS with my daughter" was a measured
    // miss against the existing "discuss with my daughter" - one extra word broke the match.
    // Both "discuss it" and "discuss this" are listed on purpose. The matcher needs near-literal
    // phrasing, so a one-word difference in the middle of a phrase is a miss - and a client is as
    // likely to say one as the other.
    en: ["let me talk to my family", "i need to check with my son", "discuss it with my daughter",
         "discuss this with my daughter", "discuss this with my son", "talk this over with my family",
         "i want to run it by my daughter", "i'll ask my husband", "i have to discuss it with my wife"],
    es: ["tengo que hablar con mi hijo", "consultar con mi familia", "hablar con mi esposo primero",
         "preguntarle a mi hija"],
  },
  "objection-want-to-think-about-it": {
    en: ["i want to think it over", "give me some time", "let me sleep on it", "i need to think",
         "let me consider it"],
    es: ["lo tengo que pensar", "dejeme pensarlo", "necesito pensarlo bien", "deme tiempo"],
  },
  "objection-wont-share-personal-info": {
    en: ["i'm not giving my information", "i don't give that out over the phone",
         "i'm not comfortable with that", "how do i know this is real", "i don't give my social"],
    es: ["no doy mi informacion bancaria", "no doy mi numero de seguro",
         "no me gusta dar esos datos", "no doy esa informacion por telefono"],
  },
  "objection-remove-my-mother": {
    es: ["sacala de la lista", "no la llame mas", "quitela de ahi", "ya no llamen"],
  },
  "objection-ill-wait-a-while": {
    es: ["voy a esperar un poco", "lo dejo para despues", "por ahora no", "mas adelante lo veo"],
  },
  "objection-already-got-the-info": {
    es: ["ya me explicaron", "ya hable con alguien", "ya me lo dijeron", "ya me atendieron"],
  },
  "objection-is-this-free-or-paid": {
    es: ["eso tiene costo", "es gratis verdad", "cuanto seria", "esto cuesta algo"],
  },
  // Card, not bank account. Keeps clear of the "won't share banking info" objection above.
  "objection-card-not-bank-account": {
    es: ["prefiero con tarjeta", "solo uso tarjeta", "puede ser con debito", "cobreme a la tarjeta"],
  },

  // ── IUL (Spanish only — these objections have no English side) ────────────────
  "04967447-fa20-48b3-ae88-37e1f471572e": {
    // First entry fixes a measured miss: the hand-written triggers said "datos bancarios" and a
    // client saying "informacion bancaria" did not match.
    es: ["no te voy a dar mi informacion bancaria", "para que quieres mi cuenta",
         "no me gusta dar datos bancarios", "no doy mi numero de cuenta"],
  },
  "0ac0bc2c-cad3-4eea-9cc6-6fb3ff16139d": {
    es: ["el mes que viene empiezo", "ahorita no el otro mes", "despues del mes", "en enero empiezo"],
  },
  "0ac8b6f3-d3df-4ed1-b778-dd796fb0c0c8": {
    es: ["que es esto exactamente", "es un seguro verdad", "esto que es", "me quieres vender algo"],
  },
  "0ea529da-f1cb-4db5-a2a0-b9992c9b403a": {
    es: ["cuando me jubile", "hasta cuando pago", "y si dejo de pagar", "pago para siempre"],
  },
  "14c9edbf-6ee0-49cd-8f38-01e5e66af16a": {
    es: ["me voy a divorciar", "me estoy separando", "mi ex puede reclamar", "estamos separados"],
  },
  "251542a5-b1a4-4695-8f7f-48a596090c7b": {
    es: ["y esto cuanto cuesta", "eso se paga aparte", "cuanto tengo que pagar", "es pago mensual"],
  },
  "3a48030a-0362-4179-8252-e984d6d7db69": {
    es: ["es muy a largo plazo", "eso es mucho tiempo", "no me sirve eso", "tarda mucho"],
  },
  "5525d955-0804-4908-8cbf-6519e2121cd2": {
    es: ["ahorita no tengo tiempo", "estoy corriendo", "no tengo chance", "ando ocupado ahorita"],
  },
  "ae276ebc-5b7e-4ea3-a798-81b181cc9874": {
    es: ["me llama despues", "llame en otro momento", "hablamos luego", "me marca despues"],
  },
  "ce35d8bc-f385-4e3b-b408-a75557e5d58a": {
    es: ["no confio en eso", "eso es mentira", "no creo en eso", "las aseguradoras no pagan"],
  },
  "f34d3406-406d-43f7-84ae-b56e987d78ee": {
    es: ["y si lo necesito antes", "se puede sacar antes", "puedo disponer del dinero",
         "esta disponible el dinero"],
  },
  "fb76b96a-264a-4a05-a325-e42cbde1dda7": {
    es: ["en el trabajo no puedo", "salgo a las cinco", "estoy en horario de trabajo",
         "cuando salga te llamo"],
  },
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

type Doc = { _id: string; titleEn?: string; titleEs?: string; triggersEn?: string[]; triggersEs?: string[] };

async function main() {
  const dry = process.argv.includes("--dry-run");
  if (!process.env.SANITY_API_WRITE_TOKEN && !dry) {
    throw new Error("SANITY_API_WRITE_TOKEN is required to write triggers.");
  }

  const ids = Object.keys(ADDITIONS);
  const docs = await client.fetch<Doc[]>(
    `*[_id in $ids]{_id, titleEn, titleEs, triggersEn, triggersEs}`,
    { ids }
  );
  const byId = new Map(docs.map((d) => [d._id, d]));

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`Unknown objection ids:\n  ${missing.join("\n  ")}`);

  let touched = 0;
  let addedEn = 0;
  let addedEs = 0;

  for (const [id, add] of Object.entries(ADDITIONS)) {
    const doc = byId.get(id)!;
    const title = (doc.titleEn || doc.titleEs || id).slice(0, 44);
    const patch: Record<string, string[]> = {};

    for (const lang of ["en", "es"] as const) {
      const incoming = add[lang];
      if (!incoming?.length) continue;
      const key = lang === "en" ? "triggersEn" : "triggersEs";
      const existing = doc[key] ?? [];
      const seen = new Set(existing.map(norm));
      const fresh = incoming.filter((p) => !seen.has(norm(p)));
      if (!fresh.length) continue;
      patch[key] = [...existing, ...fresh];
      if (lang === "en") addedEn += fresh.length; else addedEs += fresh.length;
    }

    if (!Object.keys(patch).length) {
      console.log(`   skip  ${title} — nothing new`);
      continue;
    }

    const parts = Object.entries(patch)
      .map(([k, v]) => `${k === "triggersEn" ? "EN" : "ES"} ${(doc[k as keyof Doc] as string[] | undefined)?.length ?? 0}→${v.length}`)
      .join("  ");
    console.log(`   add   ${title.padEnd(46)} ${parts}`);
    if (!dry) await client.patch(id).set(patch).commit();
    touched += 1;
  }

  console.log(
    `\n${dry ? "DRY RUN — nothing written. " : ""}${touched} objection(s) updated · +${addedEn} English, +${addedEs} Spanish phrases.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌", error instanceof Error ? error.message : error);
    process.exit(1);
  });
