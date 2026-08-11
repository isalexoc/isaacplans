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

  headlineEs: "Cobertura médica asequible para usted y su familia",
  headlineEn: "Affordable health coverage for you and your family",

  introEs:
    "Sin Fronteras USA lo acompaña en su trámite. Nosotros lo acompañamos en su salud. Un agente con licencia le explica sus opciones en español, busca un plan que sí se ajuste a su presupuesto y le entrega la constancia de cobertura que necesita presentar. La consulta es gratis.",
  introEn:
    "Sin Fronteras USA guides you through your paperwork. We guide you through your health coverage. A licensed agent explains your options in Spanish, finds a plan that actually fits your budget, and gives you the proof of coverage you need to present. The consultation is free.",

  audienceEs:
    "En muchos trámites migratorios le piden demostrar que usted puede cubrir sus propios gastos médicos y que no será una carga para el gobierno. Cumplir ese requisito no debería costarle lo que no tiene. Le ayudamos a conseguir una cobertura real, a un precio que sí puede pagar cada mes, con la documentación por escrito que puede presentar cuando se la pidan.",
  audienceEn:
    "Many immigration applications ask you to show that you can cover your own medical costs and will not become a burden on the government. Meeting that requirement should not cost you what you do not have. We help you get real coverage, at a price you can actually pay each month, with written documentation you can present when it is asked for.",

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
