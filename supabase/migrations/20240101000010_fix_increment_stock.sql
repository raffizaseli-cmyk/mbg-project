-- Drop the old conflicting signature from 006_triggers.sql
DROP FUNCTION IF EXISTS public.increment_stock(uuid, numeric, uuid);
