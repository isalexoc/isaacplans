/**
 * Seeds Spanish trigger phrases on the IUL objections.
 *
 * Triggers are the corpus the live-call listener matches against: without them an objection can
 * never be suggested, however clearly the client is transcribed. The IUL set had 11 of 12 empty,
 * which is why live listening looked broken on that tab.
 *
 * The phrases here are written in the CLIENT's voice, not the agent's. The objection titles are
 * stage directions ("SI DICE QUE NO LE CONVIENE..."), so they cannot be used as triggers directly —
 * nobody says "si dice que no le conviene" on a call, they say "no me conviene".
 *
 * Only objections whose `triggersEs` is EMPTY are touched, so anything hand-written in Studio wins
 * and re-running is safe.
 *
 * Run: pnpm seed:iul-triggers --dry-run
 *      pnpm seed:iul-triggers
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

/**
 * Keyed by document id rather than title: the titles are long, ALL-CAPS and easy to edit, and a
 * near-miss would silently seed the wrong objection.
 *
 * Deliberately no phrase appears under two objections. "llámame después" belongs to the
 * call-me-back objection alone; the working/specific-time one gets phrases about being at work,
 * because two objections sharing a trigger makes the winner arbitrary.
 */
const TRIGGERS: Record<string, { note: string; phrases: string[] }> = {
  "0ac0bc2c-cad3-4eea-9cc6-6fb3ff16139d": {
    note: "wants to start next month",
    phrases: [
      "quiero empezar el mes que viene",
      "mejor el proximo mes",
      "empezamos el mes entrante",
      "prefiero comenzar mas adelante",
      "este mes no puedo",
    ],
  },
  "0ac8b6f3-d3df-4ed1-b778-dd796fb0c0c8": {
    note: "asks whether you are selling life insurance",
    phrases: [
      "esto es un seguro de vida",
      "me estas vendiendo un seguro",
      "que me estas vendiendo",
      "esto es una poliza de vida",
      "usted es vendedor",
    ],
  },
  "0ea529da-f1cb-4db5-a2a0-b9992c9b403a": {
    note: "asks about stopping payments at retirement",
    phrases: [
      "cuando me retire dejo de pagar",
      "hasta cuando tengo que pagar",
      "voy a dejar de pagar",
      "cuanto tiempo hay que pagar",
      "tengo que pagar toda la vida",
    ],
  },
  "14c9edbf-6ee0-49cd-8f38-01e5e66af16a": {
    note: "divorcing / fears the spouse's legal claim",
    phrases: [
      "me estoy divorciando",
      "estoy en un divorcio",
      "mi esposo puede reclamar",
      "mi esposa puede reclamar",
      "problemas legales con mi pareja",
    ],
  },
  "251542a5-b1a4-4695-8f7f-48a596090c7b": {
    note: "asks whether this has to be paid",
    phrases: [
      "esto hay que pagarlo",
      "esto se tiene que pagar",
      "tengo que pagar algo",
      "eso cuesta dinero",
      "hay que pagar mensual",
    ],
  },
  "3a48030a-0362-4179-8252-e984d6d7db69": {
    note: "says it does not suit them because it is long term",
    phrases: [
      "es a largo plazo",
      "no me conviene",
      "es mucho tiempo",
      "muy largo plazo",
      "no me sirve a largo plazo",
    ],
  },
  "5525d955-0804-4908-8cbf-6519e2121cd2": {
    note: "no time right now",
    phrases: [
      "no tengo tiempo",
      "ando muy ocupado",
      "estoy apurado",
      "no puedo hablar ahora",
      "tengo prisa",
    ],
  },
  "ae276ebc-5b7e-4ea3-a798-81b181cc9874": {
    note: "insists you call back later (no specific reason)",
    phrases: [
      "llamame despues",
      "llamame mas tarde",
      "me llamas luego",
      "mejor despues",
      "puede llamar otro dia",
    ],
  },
  "ce35d8bc-f385-4e3b-b408-a75557e5d58a": {
    note: "sceptical about insurance in general",
    phrases: [
      "no creo en los seguros",
      "los seguros son una estafa",
      "no confio en los seguros",
      "eso es un robo",
      "los seguros nunca pagan",
    ],
  },
  "f34d3406-406d-43f7-84ae-b56e987d78ee": {
    note: "asks whether money can be withdrawn",
    phrases: [
      "puedo sacar el dinero",
      "se puede retirar el dinero",
      "puedo retirar mi dinero",
      "y si necesito el dinero",
      "puedo sacarlo cuando quiera",
    ],
  },
  "fb76b96a-264a-4a05-a325-e42cbde1dda7": {
    note: "at work, asks for a specific later time",
    phrases: [
      "estoy trabajando ahora",
      "estoy en el trabajo",
      "llamame cuando salga del trabajo",
      "llamame a las",
      "salgo a las",
    ],
  },
};

type Doc = { _id: string; titleEs?: string; triggersEs?: string[] };

async function main() {
  const dry = process.argv.includes("--dry-run");
  if (!process.env.SANITY_API_WRITE_TOKEN && !dry) {
    throw new Error("SANITY_API_WRITE_TOKEN is required to write triggers.");
  }

  const ids = Object.keys(TRIGGERS);
  const docs = await client.fetch<Doc[]>(`*[_id in $ids]{_id, titleEs, triggersEs}`, { ids });
  const byId = new Map(docs.map((d) => [d._id, d]));

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new Error(`These objection ids no longer exist:\n  ${missing.join("\n  ")}`);
  }

  let seeded = 0;
  let skipped = 0;

  for (const [id, { note, phrases }] of Object.entries(TRIGGERS)) {
    const doc = byId.get(id)!;
    const existing = doc.triggersEs ?? [];
    const title = (doc.titleEs ?? "").slice(0, 46);

    if (existing.length > 0) {
      console.log(`   skip  ${title}\n         already has ${existing.length} phrase(s) — left alone`);
      skipped += 1;
      continue;
    }

    console.log(`   seed  ${title}\n         (${note}) ${phrases.length} phrases`);
    if (!dry) {
      await client.patch(id).set({ triggersEs: phrases }).commit();
    }
    seeded += 1;
  }

  console.log(
    `\n${dry ? "DRY RUN — nothing written. " : ""}${seeded} objection(s) ${dry ? "would be" : ""} seeded, ${skipped} left alone.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌", error instanceof Error ? error.message : error);
    process.exit(1);
  });
