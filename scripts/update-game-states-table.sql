-- Add new columns to the game_states table if they don't exist
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS attack_sent INTEGER DEFAULT 0;
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS game_over BOOLEAN DEFAULT FALSE;

-- Update the table to ensure these columns are included in the realtime subscription
BEGIN;
  -- Temporarily disable the realtime publication
  ALTER PUBLICATION supabase_realtime DROP TABLE game_states;
  
  -- Re-add the table to include all columns
  ALTER PUBLICATION supabase_realtime ADD TABLE game_states;
COMMIT;

-- Notify about the update
DO $$
BEGIN
  RAISE NOTICE 'Game states table updated with attack_sent and game_over columns';
END $$;
