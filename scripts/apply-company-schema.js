#!/usr/bin/env node

/**
 * Script to apply the company schema to the database
 * This loads the schema SQL file and executes it against the database
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a PostgreSQL client
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function applySchema() {
  // Read the schema file
  const schemaPath = path.join(__dirname, '..', 'db', 'migrations', 'enhanced_company_schema.sql');
  
  try {
    console.log(`Reading schema from ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Connecting to database...');
    const client = await pool.connect();

    try {
      console.log('Applying schema...');
      await client.query(schemaSql);
      console.log('Schema applied successfully!');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error applying schema:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applySchema();
