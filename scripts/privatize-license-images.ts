/**
 * Flips all agent license images in Cloudinary from public `upload` delivery
 * to `authenticated` delivery — in place, keeping the same public IDs, so the
 * Sanity `agentLicense` metadata needs no changes.
 *
 * After the flip, the asset itself refuses any unsigned request:
 *   - old public URL  (/image/upload/<id>)         → 404
 *   - unsigned        (/image/authenticated/<id>)  → 401
 *   - signed          (server-generated only)      → 200
 *
 * Idempotent: assets already on authenticated delivery are skipped, so
 * re-running is always safe. Run AFTER deploying the proxy that signs
 * authenticated URLs (app/api/admin/license-image) — it falls back to the
 * legacy public URL until this script runs, so there is no broken window.
 *
 * Run: pnpm privatize:licenses
 */
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import { createClient } from "next-sanity";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ?? process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "anetxoet",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: false,
});

type DeliveryType = "authenticated" | "upload" | "missing";

function isNotFound(error: unknown): boolean {
  const err = error as { error?: { http_code?: number }; http_code?: number } | undefined;
  return err?.error?.http_code === 404 || err?.http_code === 404;
}

async function getDeliveryType(publicId: string): Promise<DeliveryType> {
  try {
    await cloudinary.api.resource(publicId, { resource_type: "image", type: "authenticated" });
    return "authenticated";
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  try {
    await cloudinary.api.resource(publicId, { resource_type: "image", type: "upload" });
    return "upload";
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  return "missing";
}

async function fetchStatus(url: string): Promise<number> {
  const res = await fetch(url);
  return res.status;
}

async function verifyAsset(publicId: string): Promise<boolean> {
  const publicUrl = cloudinary.url(publicId, { resource_type: "image", type: "upload", secure: true });
  const unsignedAuthUrl = cloudinary.url(publicId, { resource_type: "image", type: "authenticated", secure: true });
  const signedAuthUrl = cloudinary.url(publicId, {
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    secure: true,
  });

  const [publicStatus, unsignedStatus, signedStatus] = [
    await fetchStatus(publicUrl),
    await fetchStatus(unsignedAuthUrl),
    await fetchStatus(signedAuthUrl),
  ];

  let ok = true;
  if (publicStatus === 200) {
    console.warn(`   ⚠️  old public URL still serves (CDN invalidation propagating) — re-check in a few minutes`);
  }
  if (unsignedStatus !== 401) {
    console.error(`   ❌ unsigned authenticated URL returned ${unsignedStatus} (expected 401)`);
    ok = false;
  }
  if (signedStatus !== 200) {
    console.error(`   ❌ signed authenticated URL returned ${signedStatus} (expected 200)`);
    ok = false;
  }
  if (ok) {
    console.log(`   🔒 verified: public=${publicStatus}, unsigned=${unsignedStatus}, signed=${signedStatus}`);
  }
  return ok;
}

async function probeOnTheFlyTransforms(publicId: string): Promise<void> {
  const transformedUrl = cloudinary.url(publicId, {
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    secure: true,
    transformation: [{ width: 300, crop: "fit" }],
  });
  const status = await fetchStatus(transformedUrl);
  if (status === 200) {
    console.log("\nℹ️  This account ALLOWS signed on-the-fly transformations on authenticated assets");
    console.log("   (the license-image proxy will serve resized images).");
  } else {
    console.log(`\nℹ️  Signed on-the-fly transformation returned ${status} — this account does NOT allow it.`);
    console.log("   (the license-image proxy will fall back to serving signed originals — expected, fine).");
  }
}

async function main() {
  console.log("🚀 Privatizing agent license images in Cloudinary...\n");

  const docs: { _id: string; cloudinaryPublicId: string | null }[] = await sanity.fetch(
    `*[_type == "agentLicense"]{ _id, cloudinaryPublicId }`
  );
  const publicIds = [...new Set(docs.map((d) => d.cloudinaryPublicId).filter((id): id is string => Boolean(id)))];
  console.log(`Found ${docs.length} agentLicense docs, ${publicIds.length} unique Cloudinary assets\n`);

  let flipped = 0;
  let alreadyAuthenticated = 0;
  let missing = 0;
  let failures = 0;
  let probed = false;

  for (const publicId of publicIds) {
    console.log(`▶ ${publicId}`);
    try {
      const deliveryType = await getDeliveryType(publicId);

      if (deliveryType === "missing") {
        console.error("   ❌ asset not found in Cloudinary (neither upload nor authenticated type)");
        missing++;
        continue;
      }

      if (deliveryType === "authenticated") {
        console.log("   ⏭️  already authenticated — skipping");
        alreadyAuthenticated++;
      } else {
        await cloudinary.uploader.rename(publicId, publicId, {
          resource_type: "image",
          type: "upload",
          to_type: "authenticated",
          invalidate: true,
        });
        console.log("   ✅ flipped to authenticated delivery (CDN invalidated)");
        flipped++;
      }

      if (!(await verifyAsset(publicId))) failures++;

      if (!probed) {
        probed = true;
        await probeOnTheFlyTransforms(publicId);
        console.log("");
      }
    } catch (error) {
      console.error("   ❌ error:", error instanceof Error ? error.message : error);
      failures++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`   ✅ Flipped:               ${flipped}`);
  console.log(`   ⏭️  Already authenticated: ${alreadyAuthenticated}`);
  console.log(`   ❓ Missing assets:        ${missing}`);
  console.log(`   ❌ Failures:              ${failures}`);
  console.log("=".repeat(50));

  if (missing > 0 || failures > 0) {
    process.exit(1);
  }
  console.log("\n✨ All license images are now private (authenticated delivery).");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("❌ Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
