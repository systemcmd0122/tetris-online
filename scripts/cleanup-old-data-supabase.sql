-- Function to clean up old game data (Supabase compatible)
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
  
  -- Log cleanup activity
  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Manual cleanup for immediate effect
SELECT cleanup_old_games();

-- Create a simple trigger-based cleanup system
-- This will run cleanup when new rooms are created
CREATE OR REPLACE FUNCTION trigger_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run cleanup occasionally (roughly 10% of the time)
  IF random() < 0.1 THEN
    PERFORM cleanup_old_games();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic cleanup
DROP TRIGGER IF EXISTS auto_cleanup_trigger ON game_rooms;
CREATE TRIGGER auto_cleanup_trigger
  AFTER INSERT ON game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup();
