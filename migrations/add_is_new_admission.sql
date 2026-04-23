-- Migration: Add is_new_admission flag to students table
-- This column tracks whether a student is a new admission for the current session.
-- New admissions get an extra ₹3900 admission fee row in the fee ledger.
-- The flag is auto-cleared when the admission fee is fully paid.

ALTER TABLE students ADD COLUMN IF NOT EXISTS is_new_admission BOOLEAN DEFAULT FALSE;

-- Optional: If you have students who were already registered as new admissions
-- in session 2026-27 and need the flag set retroactively, uncomment and run:
--
-- UPDATE students
-- SET is_new_admission = TRUE
-- WHERE admission_date >= '2026-04-01'
--   AND status = 'active';
