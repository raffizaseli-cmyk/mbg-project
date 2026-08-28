import os
import sys

sys.path.append(os.path.join(os.getcwd(), "backend"))
from core.database import get_supabase

supabase = get_supabase()

sql = """
CREATE TABLE IF NOT EXISTS ingredient_unit_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES master_ingredients(id) ON DELETE CASCADE,
    from_qty NUMERIC(12, 4) NOT NULL DEFAULT 1.0,
    from_unit VARCHAR(50) NOT NULL,
    to_qty NUMERIC(12, 4) NOT NULL DEFAULT 1.0,
    to_unit VARCHAR(50) NOT NULL,
    multiplier NUMERIC(14, 6) GENERATED ALWAYS AS (to_qty / NULLIF(from_qty, 0)) STORED,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_ingredient_chain UNIQUE (ingredient_id, from_unit, to_unit)
);

CREATE INDEX IF NOT EXISTS idx_ingredient_unit_chains_ing ON ingredient_unit_chains(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_unit_chains_units ON ingredient_unit_chains(ingredient_id, from_unit, to_unit);
"""

# Try various RPC functions
for rpc_name in ["exec_sql", "execute_sql", "run_sql", "exec"]:
    try:
        res = supabase.rpc(rpc_name, {"query": sql}).execute()
        print(f"RPC {rpc_name} SUCCEEDED:", res)
        break
    except Exception as e:
        print(f"RPC {rpc_name} failed: {e}")
