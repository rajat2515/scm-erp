-- ─────────────────────────────────────────────────────────────────
--  Fee Receipt Headers Migration
--  Run once in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────
--
--  Purpose: Acts as an IMMUTABLE transaction ledger.
--  Rows in this table are NEVER deleted.
--  The receipt_no is permanent once issued.
--  fee_payments rows link back here via the receipt_no column.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fee_receipt_headers (
    id              BIGSERIAL PRIMARY KEY,
    receipt_no      TEXT UNIQUE NOT NULL,
    sr_no           INTEGER NOT NULL REFERENCES students(sr_no) ON DELETE CASCADE,
    payment_date    DATE NOT NULL,
    payment_mode    TEXT NOT NULL DEFAULT 'cash',
    total_paid      NUMERIC(10,2) DEFAULT 0,
    total_discount  NUMERIC(10,2) DEFAULT 0,
    is_voided       BOOLEAN NOT NULL DEFAULT FALSE,
    voided_reason   TEXT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (mirror the pattern used for fee_payments)this 
ALTER TABLE fee_receipt_headers ENABLE ROW LEVEL SECURITY;

-- Policy: allow all operations for authenticated users (adjust to your RLS setup)
CREATE POLICY "Allow all for authenticated" ON fee_receipt_headers
    FOR ALL USING (true) WITH CHECK (true);
