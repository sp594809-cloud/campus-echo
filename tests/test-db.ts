import { PGlite } from '@electric-sql/pglite';
import { drizzle } from '../lib/db/node_modules/drizzle-orm/pglite';
import * as schema from '../lib/db/src/schema';
export const engine = new PGlite();
export const db = drizzle(engine, { schema });
export * from '../lib/db/src/schema';
