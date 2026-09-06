/**
 * Does the objection library actually catch what clients say?
 *
 * Answers the question the live dock cannot: not "did a card appear on that call" but "which
 * phrasings would fire today, per product, per language, and which are silently uncovered".
 *
 * Runs the REAL matcher — `buildLiveIndex` and `scoreWindow` from lib/objections/live-match.ts —
 * against the live Sanity corpus, so a pass here means the same words would fire on a real call.
 *
 *   pnpm check:objections                          coverage for every product, both languages
 *   pnpm check:objections --lob iul --lang es      one product
 *   pnpm check:objections --phrase "no puedo pagar eso" --lob iul
 *
 * Read-only. No writes, no calls, no audio.
 */

import "dotenv/config";
import { client } from "@/sanity/lib/client";
import { OBJECTIONS_QUERY } from "@/lib/sanity/queries/objections";
import {
  LiveTranscriptWindow,
  buildLiveIndex,
  nearestCandidate,
  scoreWindow,
} from "@/lib/objections/live-match";
import {
  OBJECTION_LOBS,
  appliesToLob,
  objectionTitle,
  visibleIn,
  type Objection,
} from "@/lib/objections/types";

/**
 * Things clients actually say, in their words.
 *
 * Grouped by the objection they mean rather than by product, because the whole point is to find
 * which ones no product covers. Add to this list whenever a real call produces a phrasing that
 * should have fired.
 */
const PHRASES: Record<string, { es: string[]; en: string[] }> = {
  price: {
    es: [
      "no puedo pagar eso",
      "esta muy caro",
      "no tengo dinero para eso",
      "esta fuera de mi presupuesto",
      "no me alcanza",
      "esta muy alto el precio",
    ],
    en: ["i can't afford that", "that's too expensive", "it's not in my budget", "i'm on a fixed income"],
  },
  thinking: {
    es: ["dejame pensarlo", "lo voy a pensar", "necesito tiempo para pensarlo", "deme unos dias"],
    en: ["let me think about it", "i need to think it over"],
  },
  spouse: {
    es: [
      "tengo que hablar con mi esposa primero",
      "tengo que hablar con mi esposo primero",
      "necesito consultarlo con mi familia",
      "quiero preguntarle a mis hijos",
    ],
    en: ["i need to talk to my wife first", "let me ask my kids"],
  },
  timing: {
    es: ["no tengo tiempo", "ahorita no puedo", "estoy ocupado", "llameme mas tarde", "ahorita estoy trabajando"],
    en: ["i don't have time", "call me back later", "i'm busy right now"],
  },
  already_covered: {
    es: ["ya tengo un seguro", "ya tengo cobertura por el trabajo", "ya estoy cubierto"],
    en: ["i already have coverage", "i have a policy through work"],
  },
  trust: {
    es: ["yo no llame a nadie", "quien le dio mi numero", "no quiero dar mi informacion personal"],
    en: ["i never called anybody", "i don't give out personal information"],
  },
  not_interested: {
    es: ["no me interesa", "no gracias", "ya no quiero"],
    en: ["i'm not interested", "no thank you"],
  },
  shopping: {
    es: ["solo estoy comparando precios", "estoy cotizando"],
    en: ["i'm just shopping around", "i'm getting quotes"],
  },
  mail_it: {
    es: ["mandeme algo por correo", "envieme informacion"],
    en: ["mail me something", "send me a brochure"],
  },
  /**
   * Nobody objects in four words and then goes quiet.
   *
   * These are the same objections with a real sentence wrapped around them, which is how they
   * arrive on a call. They are here because the recency guard used to drop an objection once about
   * fourteen more words followed it — the card simply never appeared, and the panel showed nothing
   * to explain why.
   */
  rambling: {
    es: [
      "dejame pensarlo y despues yo te llamo para darte una respuesta porque ahorita no estoy seguro",
      "mire le agradezco mucho la llamada pero la verdad es que ahorita no me interesa nada de eso",
      "lo que pasa es que ya tengo un seguro por el trabajo y no se si necesito otro la verdad",
    ],
    en: [
      "let me think about it and i'll call you back later once i've had a chance to look at my numbers",
      "i appreciate the call but honestly i'm not interested in any of that right now thank you",
    ],
  },
};

/** Ordinary call chatter. Anything that fires on these is a false positive. */
const CHATTER: Record<"es" | "en", string[]> = {
  es: [
    "estamos aqui en houston desde hace treinta anos",
    "si claro digame",
    "mi hija vive conmigo",
    "estoy retirado desde hace seis anos",
    "cuanto seria al mes",
  ],
  en: [
    "we've been here about thirty years",
    "sure, go ahead",
    "my daughter lives with me",
    "how much would that be a month",
  ],
};

type Lang = "en" | "es";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Exactly how the live hook feeds the matcher, so a result here means a result on a call. */
function fires(objections: Objection[], lob: string, lang: Lang, text: string) {
  const index = buildLiveIndex(objections, lob, lang);
  const win = new LiveTranscriptWindow();
  win.commit(text);
  const tokens = win.snapshot().tokens;
  return { hit: scoreWindow(index, tokens), near: nearestCandidate(index, tokens), index };
}

async function main() {
  const objections = await client.fetch<Objection[]>(OBJECTIONS_QUERY);
  const byId = new Map(objections.map((o) => [o._id, o]));
  const title = (id: string, lang: Lang) => objectionTitle(byId.get(id)!, lang) || byId.get(id)?.titleEn || id;

  const onlyLob = arg("lob");
  const onlyLang = arg("lang") as Lang | undefined;
  const phrase = arg("phrase");
  const lobs = OBJECTION_LOBS.filter((l) => !onlyLob || l.value === onlyLob);
  const langs: Lang[] = onlyLang ? [onlyLang] : ["es", "en"];

  console.log(`\n${objections.length} published objections\n`);

  // --- one phrase, on demand ---
  if (phrase) {
    for (const lob of lobs) {
      for (const lang of langs) {
        const { hit, near, index } = fires(objections, lob.value, lang, phrase);
        if (index.triggers.length === 0) continue;
        console.log(`${lob.short} / ${lang}:`);
        if (hit) {
          console.log(`   FIRES ${hit.score.toFixed(2)} -> ${title(hit.objectionId, lang)}  [trigger "${hit.trigger}"]`);
        } else if (near) {
          console.log(
            `   no card. closest ${Math.round(near.coverage * 100)}% -> ${title(near.objectionId, lang)}` +
            `  [trigger "${near.trigger}"]  missing: ${near.missing.join(", ") || "-"}`
          );
        } else {
          console.log("   no card, and nothing resembled it at all");
        }
      }
    }
    return;
  }

  // --- coverage sweep ---
  let uncovered = 0;
  for (const lob of lobs) {
    for (const lang of langs) {
      const index = buildLiveIndex(objections, lob.value, lang);
      const scoped = objections.filter((o) => appliesToLob(o, lob.value) && visibleIn(o, lang));
      if (index.triggers.length === 0) {
        console.log(`${lob.short} / ${lang}:  NO TRIGGERS - nothing can ever fire here\n`);
        continue;
      }

      const misses: string[] = [];
      let hits = 0;
      let total = 0;
      for (const [group, sets] of Object.entries(PHRASES)) {
        for (const text of sets[lang]) {
          total += 1;
          const { hit, near } = fires(objections, lob.value, lang, text);
          if (hit) hits += 1;
          else {
            misses.push(
              `      "${text}"  (${group})` +
                (near ? `  closest ${Math.round(near.coverage * 100)}% ${title(near.objectionId, lang)}` : "")
            );
          }
        }
      }

      const falsePositives: string[] = [];
      for (const text of CHATTER[lang]) {
        const { hit } = fires(objections, lob.value, lang, text);
        if (hit) falsePositives.push(`      "${text}" -> ${title(hit.objectionId, lang)} [${hit.trigger}]`);
      }

      uncovered += misses.length;
      console.log(
        `${lob.short} / ${lang}:  ${hits}/${total} phrasings fire  ` +
          `(${scoped.length} objections, ${index.triggers.length} triggers)`
      );
      if (misses.length) {
        console.log("   NOT COVERED:");
        misses.forEach((m) => console.log(m));
      }
      if (falsePositives.length) {
        console.log("   FALSE POSITIVES on ordinary chatter:");
        falsePositives.forEach((m) => console.log(m));
      }
      console.log("");
    }
  }

  console.log(`${uncovered} uncovered phrasings across everything checked.`);
  console.log("Fix by adding the wording to that objection's triggers in Studio - no deploy needed.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
