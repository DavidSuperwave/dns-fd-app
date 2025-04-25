import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

export async function insertDomain(domain: {
  cloudflare_id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  created_on: string;
  modified_on: string;
  last_synced: string;
  redirect_url: string | null;
}) {
  const query = `
    INSERT INTO domains (
      cloudflare_id, name, status, paused, type, 
      created_on, modified_on, last_synced, redirect_url
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    )
    ON CONFLICT (cloudflare_id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      paused = EXCLUDED.paused,
      type = EXCLUDED.type,
      modified_on = EXCLUDED.modified_on,
      last_synced = EXCLUDED.last_synced,
      redirect_url = EXCLUDED.redirect_url
    RETURNING *;
  `;

  const values = [
    domain.cloudflare_id,
    domain.name,
    domain.status,
    domain.paused,
    domain.type,
    domain.created_on,
    domain.modified_on,
    domain.last_synced,
    domain.redirect_url
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

export async function deleteDomain(cloudflareId: string) {
  const query = 'DELETE FROM domains WHERE cloudflare_id = $1';
  await pool.query(query, [cloudflareId]);
}