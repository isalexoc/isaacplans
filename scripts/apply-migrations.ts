import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const sql = neon(process.env.DATABASE_URL);

async function applyMigrations() {
  try {
    console.log('Applying migrations...\n');

    // Read migration files
    const migration1 = readFileSync(
      join(process.cwd(), 'drizzle', '0001_great_thundra.sql'),
      'utf-8'
    );
    const migration2 = readFileSync(
      join(process.cwd(), 'drizzle', '0002_steady_sage.sql'),
      'utf-8'
    );

    // Split by statement breakpoints and execute each statement
    const parseStatements = (migration: string): string[] => {
      return migration
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
        .map(s => s.replace(/;\s*$/, '')) // Remove trailing semicolons
        .filter(s => s.length > 0);
    };

    const statements1 = parseStatements(migration1);
    const statements2 = parseStatements(migration2);

    console.log('Applying migration 0001_great_thundra.sql...');
    for (const statement of statements1) {
      if (statement.trim()) {
        try {
          await sql(statement);
          console.log('✓ Executed statement');
        } catch (error: any) {
          // Ignore "already exists" errors
          if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
            console.log('⚠️  Already exists (skipping)');
          } else {
            throw error;
          }
        }
      }
    }

    console.log('\nApplying migration 0002_steady_sage.sql...');
    for (const statement of statements2) {
      if (statement.trim()) {
        try {
          await sql(statement);
          console.log('✓ Executed statement');
        } catch (error: any) {
          // Ignore "already exists" errors
          if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
            console.log('⚠️  Already exists (skipping)');
          } else {
            throw error;
          }
        }
      }
    }

    console.log('\n✅ All migrations applied successfully!');
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      console.log('⚠️  Some tables/indexes already exist. This is okay if migrations were partially applied.');
      console.log('Migration process completed.');
    } else {
      console.error('❌ Error applying migrations:', error);
      process.exit(1);
    }
  }
}

applyMigrations();

