/**
 * Seeds (or refreshes) the Sin Fronteras USA referral partner record.
 *
 * Safe to re-run: it upserts by slug, so editing the copy here and running it again updates the
 * existing partner instead of creating a duplicate. Everything it writes is also editable from
 * /admin/referral-partners, so this is a convenience, not the source of truth.
 *
 * Talks to Drizzle directly rather than through lib/referral-partners/server.ts, because that
 * module is marked `server-only` and cannot be imported outside the Next.js runtime.
 *
 *   npx tsx scripts/seed-sin-fronteras-partner.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../lib/db";
import { referralPartners } from "../lib/db/schema";

const SLUG = "sin-fronteras";

const PARTNER = {
  slug: SLUG,
  companyName: "Sin Fronteras USA",
  contactName: "Josarih Basantes",
  contactTitle: "CEO",
  // Login email — whoever signs in at /partner with this address gets the dashboard.
  email: "info@sinfronterasusa.com",
  phone: "+1 (832) 429-2848",
  website: "https://sinfronterasusa.com",
  logoUrl: null as string | null,
  accentColor: "#1D4E89",
  commissionBps: 500, // 5%
  defaultLocale: "es",
  status: "active",

  headlineEs: "No deje que una sola cuenta del hospital borre años de trabajo",
  headlineEn: "Don't let one hospital bill undo years of work",

  introEs:
    "Usted ha puesto años, esfuerzo y miles de dólares en su caso y en su familia. Una sola visita a emergencias sin cobertura puede costar miles de dólares en una tarde, y esa deuda no espera a que su trámite se resuelva. Una cobertura médica privada protege lo que ya construyó. No pide número de Seguro Social ni residencia, y puede empezar en días.",
  introEn:
    "You have put years, effort, and thousands of dollars into your case and your family. One uninsured emergency room visit can cost thousands of dollars in a single afternoon, and that debt does not wait for your case to be resolved. Private health coverage protects what you have already built. It does not require a Social Security number or permanent residency, and it can start in days.",

  audienceEs:
    "Sin Fronteras USA lo acompaña en su trámite. Nosotros nos encargamos de su salud. Estas son las situaciones más comunes que vemos en las familias que ellos nos envían, y lo que cuesta que lo agarren desprevenido.",
  audienceEn:
    "Sin Fronteras USA handles your case. We handle your health coverage. These are the situations we see most often in the families they send us, and what it costs to be caught without it.",

  // Turns on the "when this matters" + "what being uninsured costs" blocks on their page.
  audienceKind: "immigration",

  notes:
    "First referral partner. Immigration services firm in Austin, TX (asylum, TPS, parole, adjustment of status). Referrals arrive tagged referral_sin_fronteras in Agent CRM. 5% of monthly premium.",
};

async function main() {
  const existing = await db
    .select()
    .from(referralPartners)
    .where(eq(referralPartners.slug, SLUG))
    .limit(1);

  if (existing[0]) {
    await db
      .update(referralPartners)
      .set({ ...PARTNER, updatedAt: new Date() })
      .where(eq(referralPartners.id, existing[0].id));
    console.log(`✓ Updated partner ${PARTNER.companyName} (${existing[0].id})`);
  } else {
    const id = nanoid();
    await db.insert(referralPartners).values({ id, ...PARTNER });
    console.log(`✓ Created partner ${PARTNER.companyName} (${id})`);
  }

  console.log(`  Landing page:    /es/socios/${SLUG}  ·  /en/partners/${SLUG}`);
  console.log(`  Dashboard login: ${PARTNER.email} → /es/socio`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
