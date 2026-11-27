import pg from "pg";
import { config } from "./config.js";

// pg returns NUMERIC/BIGINT as strings by default; parse to numbers
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});
pool.on("error", (e) => console.error("[pg] idle client error", e.message));
