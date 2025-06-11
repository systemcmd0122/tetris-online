-- Function to clean up old game data
CREATE OR REPLACE FUNCTION cleanup_old_games()
RETURNS void AS $$
BEGIN
  -- Delete finished games older than 1 day
  DELETE FROM game_rooms 
  WHERE status = 'finished' 
  AND created_at < NOW() - INTERVAL '1 day';
  
  -- Delete abandoned waiting rooms older than 1 hour
  DELETE FROM game_rooms 
  WHERE status = 'waiting' 
  AND created_at < NOW() - INTERVAL '1 hour';
  
  -- Delete orphaned game states (games that no longer exist)
  DELETE FROM game_states 
  WHERE room_id NOT IN (SELECT id FROM game_rooms);
  
  -- Delete old game states (older than 1 day)
  DELETE FROM game_states 
  WHERE updated_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup every hour
-- Note: This requires pg_cron extension to be enabled
SELECT cron.schedule('cleanup-old-games', '0 * * * *', 'SELECT cleanup_old_games();');

-- Manual cleanup for immediate effect
SELECT cleanup_old_games();
