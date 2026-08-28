-- Create or replace the increment_batch_counter function for atomic batch updates
CREATE OR REPLACE FUNCTION increment_batch_counter(
  p_batch_id UUID,
  p_tenant_id UUID,
  p_trx_ids TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_processed INTEGER;
  v_notes TEXT;
  v_merged_json jsonb;
  v_new_notes_json jsonb;
  v_is_complete BOOLEAN;
  v_status TEXT;
BEGIN
  -- Row-level lock the batch record to prevent race conditions
  SELECT total_photos, processed_photos, notes
  INTO v_total, v_processed, v_notes
  FROM photo_batches
  WHERE id = p_batch_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Use JSONB || operator to merge existing notes with new trx_ids
  BEGIN
    v_merged_json := COALESCE(v_notes::jsonb, '[]'::jsonb) || COALESCE(p_trx_ids::jsonb, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_merged_json := '[]'::jsonb || COALESCE(p_trx_ids::jsonb, '[]'::jsonb);
  END;

  -- Ensure unique values in the merged JSONB array
  SELECT COALESCE(jsonb_agg(DISTINCT elem), '[]'::jsonb)
  INTO v_new_notes_json
  FROM jsonb_array_elements(v_merged_json) AS elem;

  -- Increment the processed photos count
  v_processed := v_processed + 1;

  -- Determine completion status
  v_is_complete := (v_processed >= v_total);
  v_status := CASE WHEN v_is_complete THEN 'done' ELSE 'processing' END;

  -- Update the batch record in database
  UPDATE photo_batches
  SET
    processed_photos = v_processed,
    notes = v_new_notes_json::text,
    status = v_status
  WHERE id = p_batch_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'total_photos', v_total,
    'processed_photos', v_processed,
    'status', v_status,
    'notes', v_new_notes_json::text,
    'is_complete', v_is_complete
  );
END;
$$;
