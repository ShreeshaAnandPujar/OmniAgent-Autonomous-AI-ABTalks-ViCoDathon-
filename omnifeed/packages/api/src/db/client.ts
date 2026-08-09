import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:dev@localhost:5432/swarmfeed',
});

export const db = drizzle(pool, { schema });
export { pool };
