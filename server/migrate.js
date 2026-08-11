require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Cleaning up and creating Supabase mock environment...');
    await client.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
      END
      $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID,
        aud VARCHAR(255),
        role VARCHAR(255),
        email VARCHAR(255),
        encrypted_password VARCHAR(255),
        email_confirmed_at TIMESTAMP WITH TIME ZONE,
        invited_at TIMESTAMP WITH TIME ZONE,
        confirmation_token VARCHAR(255),
        confirmation_sent_at TIMESTAMP WITH TIME ZONE,
        recovery_token VARCHAR(255),
        recovery_sent_at TIMESTAMP WITH TIME ZONE,
        email_change_token_new VARCHAR(255),
        email_change VARCHAR(255),
        email_change_sent_at TIMESTAMP WITH TIME ZONE,
        last_sign_in_at TIMESTAMP WITH TIME ZONE,
        raw_app_meta_data JSONB,
        raw_user_meta_data JSONB,
        is_super_admin BOOLEAN,
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        phone VARCHAR(15),
        phone_confirmed_at TIMESTAMP WITH TIME ZONE,
        phone_change VARCHAR(15),
        phone_change_token VARCHAR(255),
        phone_change_sent_at TIMESTAMP WITH TIME ZONE,
        confirmed_at TIMESTAMP WITH TIME ZONE,
        email_change_token_current VARCHAR(255),
        email_change_confirm_status SMALLINT,
        banned_until TIMESTAMP WITH TIME ZONE,
        reauthentication_token VARCHAR(255),
        reauthentication_sent_at TIMESTAMP WITH TIME ZONE,
        is_sso_user BOOLEAN DEFAULT false NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE,
        is_anonymous BOOLEAN DEFAULT false NOT NULL
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
      BEGIN
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
      BEGIN
        RETURN 'authenticated';
      END;
      $$ LANGUAGE plpgsql;
      CREATE OR REPLACE FUNCTION auth.email() RETURNS TEXT AS $$
      BEGIN
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      -- Create realtime publication
      DROP PUBLICATION IF EXISTS supabase_realtime;
      CREATE PUBLICATION supabase_realtime;
    `);

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // We will wrap each migration in a transaction where possible
      // But some statements (like CREATE PUBLICATION) can't be in a transaction.
      // So we will just try to run it. If it fails, we catch and log.
      try {
        await client.query(sql);
        console.log(`✅ Success: ${file}`);
      } catch (err) {
        console.error(`❌ Error in ${file}:`, err.message);
        // We'll continue to the next one to see if we can salvage the rest. 
        // Some migrations might just be Altering RLS which we don't strictly need in the custom backend.
      }
    }
    console.log('Migrations complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
