-- Migration: 20260905000000_fix_security_definer_and_rls_recursion.sql
-- Purpose:
-- 1. Fix Security Definer View warning on public.nutrition_ref_with_summary (Supabase linter)
-- 2. Fix Infinite Recursion error (42P17) on public.users table RLS policies

-- ============================================================================
-- 1. FIX SECURITY DEFINER VIEW
-- ============================================================================
-- Set security_invoker = true so that views enforce the permissions and RLS
-- of the querying user rather than the view creator.
ALTER VIEW IF EXISTS public.nutrition_ref_with_summary SET (security_invoker = true);

-- ============================================================================
-- 2. FIX INFINITE RECURSION ON USERS TABLE RLS (Error 42P17)
-- ============================================================================
-- The previous policy `tenant_isolation ON users` checked:
-- `tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())`
-- which caused Postgres error 42P17 (infinite recursion detected in policy for relation "users").

-- Create a SECURITY DEFINER helper function to safely lookup tenant_id without RLS recursion
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_tenant_id() TO authenticated, anon, service_role;

-- Drop old recursive policy on users
DROP POLICY IF EXISTS tenant_isolation ON public.users;
DROP POLICY IF EXISTS users_isolation ON public.users;
DROP POLICY IF EXISTS users_self_access ON public.users;

-- Recreate safe non-recursive policy on users
CREATE POLICY users_self_access ON public.users
  FOR ALL
  USING (
    id = auth.uid() OR tenant_id = public.get_auth_tenant_id()
  )
  WITH CHECK (
    id = auth.uid() OR tenant_id = public.get_auth_tenant_id()
  );
