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

  headlineEs: "Demuestre que puede hacerse cargo de su salud",
  headlineEn: "Show that you can take care of your own health",

  introEs:
    "Una cobertura médica asequible, sin número de Seguro Social ni residencia, que empieza en días. Es una forma clara de demostrar que usted puede cubrir su propia atención médica.",
  introEn:
    "Affordable health coverage, with no Social Security number or residency required, starting in days. A clear way to show you can pay for your own medical care.",

  audienceEs:
    "Sin Fronteras USA lo acompaña en su trámite. Nosotros nos encargamos de su salud.",
  audienceEn:
    "Sin Fronteras USA handles your case. We handle your health coverage.",

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
