import { pool } from "./db.js";

const SQL = `
CREATE TABLE IF NOT EXISTS drives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  eligible_departments TEXT[] NOT NULL,
  graduation_year INT NOT NULL,
  min_cgpa NUMERIC(4,2) NOT NULL DEFAULT 0,
  max_backlogs INT NOT NULL DEFAULT 0,
  ctc TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  registration_deadline TIMESTAMPTZ NOT NULL,
  rounds JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'dashboard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id UUID NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  department TEXT NOT NULL,
  cgpa NUMERIC(4,2) NOT NULL,
  backlogs INT NOT NULL DEFAULT 0,
  graduation_year INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','shortlisted','rejected','selected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS applicants_drive_email_uq ON applicants (drive_id, lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS applicants_drive_roll_uq ON applicants (drive_id, lower(roll_number));
CREATE INDEX IF NOT EXISTS applicants_drive_idx ON applicants (drive_id, status);
CREATE TABLE IF NOT EXISTS activity (
  id BIGSERIAL PRIMARY KEY,
  drive_id UUID REFERENCES drives(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_created_idx ON activity (created_at DESC);
`;

export async function migrate() {
  // gen_random_uuid() is built in on PG13+; pgcrypto is a fallback for older versions
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto").catch(() => {});
  await pool.query(SQL);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().then(() => { console.log("migration complete"); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
