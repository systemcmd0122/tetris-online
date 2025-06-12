-- ゲームステートテーブルの最適化
ALTER TABLE game_states DROP COLUMN IF EXISTS board_state;
ALTER TABLE game_states DROP COLUMN IF EXISTS current_piece;
ALTER TABLE game_states DROP COLUMN IF EXISTS score;
ALTER TABLE game_states DROP COLUMN IF EXISTS level;
ALTER TABLE game_states DROP COLUMN IF EXISTS lines_cleared;
ALTER TABLE game_states DROP COLUMN IF EXISTS attack_sent;
ALTER TABLE game_states DROP COLUMN IF EXISTS game_over;

-- 圧縮された状態用のカラムを追加
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS compressed_state text;
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS last_move_timestamp bigint;
ALTER TABLE game_states ADD COLUMN IF NOT EXISTS state_hash text;

-- パーティション化とインデックスの最適化
CREATE INDEX IF NOT EXISTS idx_game_states_room_timestamp ON game_states(room_id, last_move_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_game_states_state_hash ON game_states(state_hash);

-- メモリ内キャッシュの有効化
ALTER TABLE game_states SET (fillfactor = 90);

-- クリーンアップ関数の最適化
CREATE OR REPLACE FUNCTION cleanup_old_game_states() RETURNS void AS $$
BEGIN
    -- 30分以上前のゲーム状態を削除
    DELETE FROM game_states 
    WHERE updated_at < NOW() - INTERVAL '30 minutes'
    AND room_id IN (
        SELECT id FROM game_rooms 
        WHERE status = 'finished' 
        OR updated_at < NOW() - INTERVAL '30 minutes'
    );
END;
$$ LANGUAGE plpgsql;

-- トリガー関数の最適化
CREATE OR REPLACE FUNCTION update_game_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_move_timestamp := EXTRACT(EPOCH FROM NOW()) * 1000;
    NEW.state_hash := encode(sha256(NEW.compressed_state::bytea), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- タイムスタンプ更新トリガーの作成
DROP TRIGGER IF EXISTS game_states_timestamp_trigger ON game_states;
CREATE TRIGGER game_states_timestamp_trigger
    BEFORE INSERT OR UPDATE ON game_states
    FOR EACH ROW
    EXECUTE FUNCTION update_game_state_timestamp();

-- パフォーマンス設定の最適化
ALTER TABLE game_states SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_scale_factor = 0.005
);
