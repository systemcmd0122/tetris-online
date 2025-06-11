-- Create game_rooms table
CREATE TABLE IF NOT EXISTS game_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  player1_id TEXT,
  player2_id TEXT,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  winner_id TEXT,
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0
);

-- Create game_states table
CREATE TABLE IF NOT EXISTS game_states (
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

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE game_states;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_states_room_id ON game_states(room_id);
CREATE INDEX IF NOT EXISTS idx_game_states_player_id ON game_states(player_id);

-- Enable RLS (Row Level Security)
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations for now
DROP POLICY IF EXISTS "Allow all operations on game_rooms" ON game_rooms;
DROP POLICY IF EXISTS "Allow all operations on game_states" ON game_states;

CREATE POLICY "Allow all operations on game_rooms" ON game_rooms FOR ALL USING (true);
CREATE POLICY "Allow all operations on game_states" ON game_states FOR ALL USING (true);
