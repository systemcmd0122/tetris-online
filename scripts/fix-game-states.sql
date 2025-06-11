-- Drop the existing unique constraint if it exists
ALTER TABLE game_states DROP CONSTRAINT IF EXISTS game_states_room_id_player_id_key;

-- Recreate the table with proper upsert handling
DROP TABLE IF EXISTS game_states;

CREATE TABLE game_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  board_state JSONB NOT NULL,
  current_piece JSONB,
  score INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  lines_cleared INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, player_id)
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE game_states;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_game_states_room_id ON game_states(room_id);
CREATE INDEX IF NOT EXISTS idx_game_states_player_id ON game_states(player_id);

-- Enable RLS
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on game_states" ON game_states FOR ALL USING (true);
