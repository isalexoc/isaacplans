import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL);

async function applyMigrations() {
  try {
    console.log("Applying migrations...\n");

    const migrationsDir = join(process.cwd(), "drizzle");

    // Find all .sql migration files (ignore meta folder)
    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // 0000_..., 0001_..., 0002_..., 0003_...

    if (files.length === 0) {
      console.log("No migration files found in drizzle/");
      return;
    }

    // Split by statement breakpoints and execute each statement
    const parseStatements = (migration: string): string[] => {
      return migration
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"))
        .map((s) => s.replace(/;\s*$/, "")) // Remove trailing semicolons
        .filter((s) => s.length > 0);
    };

    for (const file of files) {
      const fullPath = join(migrationsDir, file);
      console.log(`Applying migration ${file}...`);

      const migration = readFileSync(fullPath, "utf-8");
      const statements = parseStatements(migration);

      for (const statement of statements) {
        if (!statement.trim()) continue;

        try {
          await sql(statement);
          console.log("✓ Executed statement");
        } catch (error: any) {
          // Ignore "already exists" / duplicate errors to keep idempotency
          if (
            error.message?.includes("already exists") ||
            error.message?.includes("duplicate")
          ) {
            console.log("⚠️  Already exists (skipping)");
          } else {
            throw error;
          }
        }
      }

      console.log("");
    }

    console.log("✅ All migrations applied successfully!");
  } catch (error: any) {
    if (
      error.message?.includes("already exists") ||
      error.message?.includes("duplicate")
    ) {
      console.log(
        "⚠️  Some tables/indexes already exist. This is okay if migrations were partially applied."
      );
      console.log("Migration process completed.");
    } else {
      console.error("❌ Error applying migrations:", error);
      process.exit(1);
    }
  }
}

applyMigrations();


