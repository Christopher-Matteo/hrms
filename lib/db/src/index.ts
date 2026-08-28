import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
    _db = drizzle(_pool, { schema });
  }
  return _db;
}

export const db: NodePgDatabase<typeof schema> = new Proxy({} as any, {
  get(target, prop) {
    return Reflect.get(getDb(), prop);
  }
});

export const pool: pg.Pool = new Proxy({} as any, {
  get(target, prop) {
    getDb();
    return Reflect.get(_pool!, prop);
  }
});

export * from "./schema";
