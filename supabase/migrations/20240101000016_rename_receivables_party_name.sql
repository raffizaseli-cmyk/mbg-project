-- Rename party_name to debtor_name in receivables table to match backend code
-- The backend reports and insert use debtor_name, but the original schema has party_name
ALTER TABLE receivables RENAME COLUMN party_name TO debtor_name;
