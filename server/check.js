require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';`)
  .then(res => {
    console.log('--- TABLES IN NEON DATABASE ---');
    console.log(`Total tables found: ${res.rows.length}`);
    res.rows.forEach(r => console.log(`- ${r.tablename}`));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
