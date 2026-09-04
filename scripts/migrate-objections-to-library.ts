/**
 * Seeds `objection` documents from the Final Expense script's objectionHandling blob.
 *
 * The source is one long rich-text field where each objection is a heading followed by its
 * responses. Splitting it is mechanical; PAIRING English to Spanish is not — the two languages
 * were written independently and do not line up (12 vs 13, each with objections the other lacks).
 * So the parser only supplies answer blocks, and the pairing table below supplies the final
 * titles, types and triggers by hand.
 *
 * Answer blocks are copied VERBATIM. `strong` spans ("Response A (…)"), markDefs, numbered list
 * items and _keys all survive untouched — nothing is rewritten or reformatted.
 *
 * Idempotent: deterministic _ids with createIfNotExists, so re-running never overwrites a Studio
 * edit. Use --force only when the parser was wrong and nothing has been edited yet.
 *
 * Run: pnpm migrate:objections --list      (parse and print; do this FIRST)
 *      pnpm migrate:objections --dry-run   (resolve everything, write nothing)
 *      pnpm migrate:objections             (create what is missing)
 *      pnpm migrate:objections --force     (replace existing documents)
 */
import "dotenv/config";
import { createClient } from "next-sanity";
import { OBJECTION_TYPES, type ObjectionType } from "../lib/objections/types";

const SOURCE_DOC_ID = "231b2fdf-4e0f-481b-9f35-5a9184b22ee3";
const EXPECTED_EN = 12;
const EXPECTED_ES = 13;

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "anetxoet",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

interface Span {
  _type?: string;
  text?: string;
}

interface Block {
  _type?: string;
  _key?: string;
  style?: string;
  listItem?: string;
  children?: Span[];
  [key: string]: unknown;
}

interface ParsedObjection {
  title: string;
  answer: Block[];
}

interface Pairing {
  key: string;
  /** 1-based index into the parsed English list. */
  en?: number;
  /** 1-based index into the parsed Spanish list. */
  es?: number;
  titleEn?: string;
  titleEs?: string;
  objectionType: ObjectionType;
  triggersEn?: string[];
  triggersEs?: string[];
}

/**
 * Final titles, written by hand.
 *
 * The source headings carry "N)" numbering, curly quotes, ALL-CAPS Spanish, trailing colons and
 * stray newlines. A human fixes thirty short strings once; no regex can do it without mangling
 * something. The parsed title is only used for --list output.
 *
 * Spanish #1 is deliberately used TWICE: its heading enumerates both "just shopping / getting
 * quotes" and "mail me something", which are two separate cards in English. Copying that answer
 * into both means both work in Spanish; Isaac can trim one in Studio in ten seconds.
 */
const PAIRINGS: Pairing[] = [
  {
    key: "mail-me-something",
    en: 1,
    es: 1,
    titleEn: "Can you just mail me something?",
    titleEs: "¿No puedes enviarme algo por correo?",
    objectionType: "other",
    triggersEn: ["mail me something", "send me a brochure", "put it in the mail", "email me the information", "send me something in writing"],
    triggersEs: ["mandame algo por correo", "enviame informacion", "mandeme un folleto", "por correo"],
  },
  {
    key: "call-me-back",
    en: 2,
    es: 2,
    titleEn: "Can you call me back?",
    titleEs: "¿Puedes llamarme luego?",
    objectionType: "timing",
    triggersEn: ["call me back", "call me later", "not a good time", "i'm busy right now", "can you call tomorrow"],
    triggersEs: ["llamame luego", "llamame despues", "ahora no puedo", "estoy ocupado", "mas tarde"],
  },
  {
    key: "didnt-request-this",
    en: 3,
    es: 3,
    titleEn: "I don't remember requesting this / I didn't call",
    titleEs: "No llamé ni recuerdo haber llamado",
    objectionType: "trust",
    triggersEn: ["i didn't call", "i never requested", "i don't remember asking", "how did you get my number", "who gave you my information"],
    triggersEs: ["yo no llame", "no recuerdo", "no pedi informacion", "quien le dio mi numero"],
  },
  {
    key: "already-have-life-insurance",
    en: 4,
    es: 4,
    titleEn: "I already have life insurance",
    titleEs: "Ya tengo un seguro de vida",
    objectionType: "already_covered",
    triggersEn: ["already have life insurance", "i'm already covered", "i have a policy", "got insurance through work"],
    triggersEs: ["ya tengo seguro", "ya estoy cubierto", "tengo una poliza", "seguro por el trabajo"],
  },
  {
    key: "not-interested",
    en: 5,
    es: 5,
    titleEn: "I'm not interested / I changed my mind",
    titleEs: "No me interesa / cambié de opinión",
    objectionType: "other",
    triggersEn: ["not interested", "changed my mind", "i don't want it", "no thank you"],
    triggersEs: ["no me interesa", "cambie de opinion", "no gracias", "ya no quiero"],
  },
  {
    key: "cant-afford-it",
    en: 6,
    titleEn: "I can't afford it / I'm on a fixed income",
    objectionType: "price",
    triggersEn: ["can't afford", "too expensive", "fixed income", "no money", "too much money", "it's not in my budget"],
  },
  {
    key: "talk-to-my-kids",
    en: 7,
    es: 6,
    titleEn: "I need to talk to my kids first",
    titleEs: "Quiero hablar primero con mis hijos",
    objectionType: "spouse",
    triggersEn: ["talk to my kids", "talk to my husband", "talk to my wife", "ask my family", "my kids make my decisions", "discuss with my daughter", "discuss with my son"],
    triggersEs: ["hablar con mis hijos", "consultar con mi esposo", "consultar con mi esposa", "mi familia decide", "hablar con mi hija"],
  },
  {
    key: "want-to-think-about-it",
    en: 8,
    es: 7,
    titleEn: "I want to think about it",
    titleEs: "Quiero pensarlo",
    objectionType: "thinking_about_it",
    triggersEn: ["think about it", "let me think", "i need time", "sleep on it", "get back to you"],
    triggersEs: ["pensarlo", "dejame pensar", "necesito tiempo", "lo voy a pensar"],
  },
  {
    key: "better-price",
    en: 9,
    titleEn: "Can you give me a better price?",
    objectionType: "price",
    triggersEn: ["better price", "any discount", "cheaper option", "lower the price", "is that the best you can do"],
  },
  {
    key: "just-shopping",
    en: 10,
    es: 1,
    titleEn: "I'm just shopping / just getting quotes",
    titleEs: "Solo estoy comprando / recibiendo cotizaciones",
    objectionType: "other",
    triggersEn: ["just shopping", "getting quotes", "comparing prices", "looking around", "just browsing"],
    triggersEs: ["solo estoy comprando", "cotizaciones", "comparando precios", "solo viendo"],
  },
  {
    key: "wont-share-personal-info",
    en: 11,
    es: 8,
    titleEn: "I don't want to share personal or banking info",
    titleEs: "No quiero dar mi información personal ni bancaria",
    objectionType: "trust",
    triggersEn: ["not giving my banking", "personal information", "social security number", "don't trust", "is this a scam", "account number"],
    triggersEs: ["informacion bancaria", "informacion personal", "numero de seguro social", "no confio", "es una estafa"],
  },
  {
    key: "not-interested-call-back",
    en: 12,
    titleEn: "Not interested / call me back / didn't request",
    objectionType: "other",
    triggersEn: ["not interested call me back", "didn't request", "remove me"],
  },
  {
    key: "remove-my-mother",
    es: 9,
    titleEs: "Remueva a mi mamá de la lista",
    objectionType: "other",
    triggersEs: ["remueva de la lista", "quiteme de la lista", "no llame mas", "no quiero ser grosera"],
  },
  {
    key: "ill-wait-a-while",
    es: 10,
    titleEs: "Voy a esperar un poco / más adelante",
    objectionType: "timing",
    triggersEs: ["voy a esperar", "mas adelante", "no por ahora", "despues"],
  },
  {
    key: "already-got-the-info",
    es: 11,
    titleEs: "Ya me dieron la información, muchas gracias",
    objectionType: "other",
    triggersEs: ["ya me dieron la informacion", "ya me llamaron", "ya tengo la informacion"],
  },
  {
    key: "is-this-free-or-paid",
    es: 12,
    titleEs: "¿Esto es gratis o hay que pagar?",
    objectionType: "price",
    triggersEs: ["esto es gratis", "hay que pagar", "cuanto cuesta", "es gratuito"],
  },
  {
    key: "card-not-bank-account",
    es: 13,
    titleEs: "No le voy a dar mi cuenta, use mi tarjeta",
    objectionType: "trust",
    triggersEs: ["use mi tarjeta", "no le doy mi cuenta", "todo lo hago con tarjeta", "tarjeta de credito"],
  },
];

/** Every child joined, never children[0]. Five Spanish headings hide their text behind a "\n\n". */
function joinText(block: Block): string {
  return (block.children ?? []).map((child) => child.text ?? "").join("");
}

function hasText(block: Block): boolean {
  return block._type !== "block" || joinText(block).trim().length > 0;
}

/** Heading starts a new objection; everything after it belongs to that objection. */
function splitByHeading(blocks: Block[], headingStyle: "h1" | "h2"): ParsedObjection[] {
  const out: ParsedObjection[] = [];
  for (const block of blocks) {
    if (block._type === "block" && block.style === headingStyle) {
      out.push({ title: joinText(block).trim(), answer: [] });
    } else if (out.length > 0) {
      out[out.length - 1].answer.push(block);
    }
    // Blocks before the first heading are the section banner. Dropped on purpose.
  }
  return out.map((objection) => ({ ...objection, answer: objection.answer.filter(hasText) }));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const listOnly = args.has("--list");
  const dryRun = args.has("--dry-run");
  const force = args.has("--force");

  if (!process.env.SANITY_API_WRITE_TOKEN && !listOnly && !dryRun) {
    throw new Error("SANITY_API_WRITE_TOKEN is required to write objections.");
  }

  console.log("📖 Reading the Final Expense script…");
  const source = await client.fetch<{ contentEn?: Block[]; contentEs?: Block[] } | null>(
    `*[_id == $id][0].objectionHandling{contentEn, contentEs}`,
    { id: SOURCE_DOC_ID }
  );

  if (!source) throw new Error(`Source document ${SOURCE_DOC_ID} not found.`);

  const en = splitByHeading(source.contentEn ?? [], "h2");
  const es = splitByHeading(source.contentEs ?? [], "h1");

  console.log(`   English: ${en.length} objections   Spanish: ${es.length} objections`);

  if (listOnly) {
    console.log("\n--- ENGLISH ---");
    en.forEach((o, i) => console.log(`${String(i + 1).padStart(2)}. [${o.answer.length} blocks] ${o.title}`));
    console.log("\n--- SPANISH ---");
    es.forEach((o, i) => console.log(`${String(i + 1).padStart(2)}. [${o.answer.length} blocks] ${o.title}`));
    return;
  }

  // If the script was edited in Studio the indices in PAIRINGS shift, and every document would be
  // built from the wrong answer. Refuse rather than write garbage.
  if (en.length !== EXPECTED_EN || es.length !== EXPECTED_ES) {
    throw new Error(
      `Source changed: expected ${EXPECTED_EN} English / ${EXPECTED_ES} Spanish objections, ` +
        `found ${en.length} / ${es.length}. Re-run with --list and update PAIRINGS before writing.`
    );
  }

  // Silent omission is the failure mode a hand-written table invites. Catch it.
  const usedEn = new Set(PAIRINGS.map((p) => p.en).filter(Boolean));
  const usedEs = new Set(PAIRINGS.map((p) => p.es).filter(Boolean));
  const orphans: string[] = [];
  for (let i = 1; i <= en.length; i += 1) if (!usedEn.has(i)) orphans.push(`EN #${i}: ${en[i - 1].title}`);
  for (let i = 1; i <= es.length; i += 1) if (!usedEs.has(i)) orphans.push(`ES #${i}: ${es[i - 1].title}`);
  if (orphans.length > 0) {
    throw new Error(`These source objections are not in PAIRINGS:\n  ${orphans.join("\n  ")}`);
  }

  const documents = PAIRINGS.map((pairing) => {
    const enSource = pairing.en ? en[pairing.en - 1] : undefined;
    const esSource = pairing.es ? es[pairing.es - 1] : undefined;

    if (!OBJECTION_TYPES.includes(pairing.objectionType)) {
      throw new Error(`${pairing.key}: unknown objectionType "${pairing.objectionType}"`);
    }

    return {
      _id: `objection-${pairing.key}`,
      _type: "objection",
      titleEn: pairing.titleEn ?? enSource?.title,
      titleEs: pairing.titleEs ?? esSource?.title,
      objectionType: pairing.objectionType,
      triggersEn: pairing.triggersEn ?? [],
      triggersEs: pairing.triggersEs ?? [],
      answerEn: enSource?.answer ?? [],
      answerEs: esSource?.answer ?? [],
      // Final Expense only: the wording is product-specific ("the high cost of final expenses").
      // Isaac widens any of these to other products by ticking a box in Studio.
      linesOfBusiness: ["finalExpense"],
      order: 0,
      status: "published",
      updatedAt: new Date().toISOString(),
    };
  });

  if (dryRun) {
    console.log(`\n🧪 Dry run — ${documents.length} documents, nothing written:\n`);
    for (const doc of documents) {
      console.log(
        `  ${doc._id}\n` +
          `    EN: ${doc.titleEn ?? "—"}  (${(doc.answerEn as Block[]).length} blocks)\n` +
          `    ES: ${doc.titleEs ?? "—"}  (${(doc.answerEs as Block[]).length} blocks)\n` +
          `    type: ${doc.objectionType}`
      );
    }
    const empty = documents.filter(
      (d) => (d.answerEn as Block[]).length === 0 && (d.answerEs as Block[]).length === 0
    );
    if (empty.length > 0) {
      console.log(`\n⚠️  ${empty.length} document(s) have no answer in either language.`);
    }
    return;
  }

  console.log(`\n✍️  Writing ${documents.length} objections…`);
  // Ask first. createIfNotExists returns the stored document either way, and a freshly seeded row
  // still has _createdAt === _updatedAt, so its response cannot tell you which of the two happened.
  const existingIds = new Set(
    await client.fetch<string[]>(`*[_id in $ids]._id`, { ids: documents.map((d) => d._id) })
  );

  let created = 0;
  let skipped = 0;

  for (const doc of documents) {
    if (force) {
      await client.createOrReplace(doc);
      console.log(`   ♻️  Replaced ${doc._id}`);
      created += 1;
      continue;
    }

    if (existingIds.has(doc._id)) {
      console.log(`   ⏭️  Skipped  ${doc._id} (already exists)`);
      skipped += 1;
      continue;
    }

    await client.createIfNotExists(doc);
    console.log(`   ✅ Created  ${doc._id}`);
    created += 1;
  }

  console.log(`\n🎉 Done. ${created} written, ${skipped} left alone.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌", error instanceof Error ? error.message : error);
    process.exit(1);
  });
