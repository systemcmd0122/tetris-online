"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useGameRoom } from "@/hooks/useGameRoom"
import { Users, Trophy, Zap, Target, Crown, Gamepad2, RefreshCw, Star, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"

// throttle実装
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

const formatTimeAgo = (dateString: string) => {
  const now = new Date()
  const created = new Date(dateString)
  const diffInSeconds = Math.floor((now.getTime() - created.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return "たった今"
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes}分前`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours}時間前`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days}日前`
  }
}

const TETROMINOS = {
  I: { shape: [[1, 1, 1, 1]], color: "bg-cyan-500", name: "I-Block" },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "bg-blue-500",
    name: "J-Block",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: "bg-orange-500",
    name: "L-Block",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "bg-yellow-500",
    name: "O-Block",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: "bg-green-500",
    name: "S-Block",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: "bg-purple-500",
    name: "T-Block",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: "bg-red-500",
    name: "Z-Block",
  },
}

const BOARD_WIDTH = 10
const BOARD_HEIGHT = 20
const INITIAL_DROP_TIME = 600 // Changed from 800 to 600 for faster initial speed
const UPDATE_THROTTLE_MS = 100
const SPEED_INCREASE_FACTOR = 0.9
const ATTACK_FLASH_DURATION = 1000 // ms
const TIME_SPEED_INCREASE_INTERVAL = 30000 // 30 seconds
const TIME_SPEED_INCREASE_FACTOR = 0.95 // 5% faster every interval

const createEmptyBoard = () => Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0))

const randomTetromino = () => {
  const keys = Object.keys(TETROMINOS)
  const randKey = keys[Math.floor(Math.random() * keys.length)]
  return { ...TETROMINOS[randKey], type: randKey }
}

// Particle component for effects
const Particle = ({ x, y, color, delay = 0 }) => (
  <motion.div
    initial={{
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      rotate: 0,
    }}
    animate={{
      opacity: 0,
      scale: 0.2,
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100,
      rotate: Math.random() * 360,
    }}
    exit={{ opacity: 0 }}
    transition={{
      duration: 1.5,
      delay,
      ease: "easeOut",
    }}
    className={`absolute w-2 h-2 ${color} rounded-full pointer-events-none z-50`}
    style={{
      left: x * 24 + 12,
      top: y * 24 + 12,
      transform: "translate(-50%, -50%)",
    }}
  />
)

interface OnlineTetrisProps {
  roomId?: string;
  playerId?: string;
  isPlayer1?: boolean;
}

export default function OnlineTetris({ roomId, playerId, isPlayer1 }: OnlineTetrisProps = {}) {
  // 基本的なゲームステート
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [dropTime, setDropTime] = useState(INITIAL_DROP_TIME);

  // オンライン関連のステート
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixedBlocks, setFixedBlocks] = useState<any[]>([]);
  const [opponentState, setOpponentState] = useState<any>(null);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(0);
  
  // refs
  const lastUpdateRef = useRef(Date.now());
  const moveQueueRef = useRef<any[]>([]);
  const gameRoomRef = useRef<any>(null);

  const { updateGameState, subscribeToGameStates, createRoom, joinRoom } = useGameRoom();

  // エラーハンドリング
  useEffect(() => {
    const handleError = (error: Error) => {
      console.error('Game error:', error);
      setError(error.message);
    };

    window.addEventListener('error', (e) => handleError(e.error));
    window.addEventListener('unhandledrejection', (e) => handleError(e.reason));

    return () => {
      window.removeEventListener('error', (e) => handleError(e.error));
      window.removeEventListener('unhandledrejection', (e) => handleError(e.reason));
    };
  }, []);

  // ゲームステートの同期
  const syncGameState = useCallback(
    throttle(async (state: any) => {
      if (!roomId || !playerId) return;

      try {
        const now = Date.now();
        if (now - lastUpdateRef.current < UPDATE_THROTTLE_MS) {
          moveQueueRef.current.push(state);
          return;
        }

        const currentState = {
          ...state,
          fixedBlocks,
          timestamp: now,
        };

        await updateGameState(roomId, playerId, currentState);
        lastUpdateRef.current = now;

        // キューに溜まった更新を処理
        if (moveQueueRef.current.length > 0) {
          const nextState = moveQueueRef.current.pop();
          moveQueueRef.current = [];
          if (nextState) {
            syncGameState(nextState);
          }
        }
      } catch (err) {
        console.error('Sync error:', err);
        setError(err instanceof Error ? err.message : 'Sync failed');
      }
    }, UPDATE_THROTTLE_MS),
    [roomId, playerId, fixedBlocks, updateGameState]
  );

  // 相手の状態を処理
  const handleOpponentState = useCallback((state: any) => {
    if (!state || state.timestamp <= lastSyncTimestamp) return;
    
    try {
      setLastSyncTimestamp(state.timestamp);
      
      if (state.fixedBlocks && state.isFixed) {
        setOpponentState(prev => ({
          ...prev,
          ...state,
          board: applyFixedBlocksToBoard(state.fixedBlocks)
        }));
      } else {
        setOpponentState(state);
      }
    } catch (err) {
      console.error('Opponent state error:', err);
    }
  }, [lastSyncTimestamp]);

  // ゲームルームの購読設定
  useEffect(() => {
    if (!roomId) return;

    try {
      const subscription = subscribeToGameStates(roomId, handleOpponentState);
      setIsConnected(true);

      return () => {
        subscription.unsubscribe();
        setIsConnected(false);
      };
    } catch (err) {
      console.error('Subscription error:', err);
      setError('Connection failed');
      setIsConnected(false);
    }
  }, [roomId, handleOpponentState, subscribeToGameStates]);

  // エラー表示用コンポーネント
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-red-100 rounded">
        <p className="text-red-600 mb-2">エラーが発生しました: {error}</p>
        <Button onClick={() => window.location.reload()}>
          再読み込み
        </Button>
      </div>
    );
  }

  // 通常のゲームレンダリング
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      {/* 接続状態表示 */}
      <div className="mb-4">
        <Badge variant={isConnected ? "success" : "destructive"}>
          {isConnected ? "オンライン" : "オフライン"}
        </Badge>
      </div>

      {/* メインのゲーム画面 */}
      <div className="flex gap-8">
        {/* プレイヤーのボード */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-2">あなたのボード</h2>
          <GameBoard
            board={board}
            currentPiece={currentPiece}
            fixedBlocks={fixedBlocks}
          />
        </div>

        {/* 対戦相手のボード */}
        {opponentState && (
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-2">対戦相手のボード</h2>
            <GameBoard
              board={opponentState.board}
              currentPiece={opponentState.currentPiece}
              fixedBlocks={opponentState.fixedBlocks}
              isOpponent
            />
          </div>
        )}
      </div>

      {/* スコアと制御 */}
      <div className="mt-4">
        <p className="text-xl">スコア: {score}</p>
        <p className="text-lg">レベル: {level}</p>
      </div>
    </div>
  );
}

// GameBoardコンポーネント
function GameBoard({ board, currentPiece, fixedBlocks, isOpponent = false }) {
  return (
    <div 
      className="grid bg-gray-300" 
      style={{ 
        gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
        width: `${BOARD_WIDTH * 20}px`,
        height: `${BOARD_HEIGHT * 20}px`,
        border: '1px solid #e5e7eb'
      }}
    >
      {board.map((row, y) => 
        row.map((cell, x) => (
          <motion.div 
            key={`${y}-${x}`}
            className={`w-5 h-5 ${cell || 'bg-gray-100'}`}
            initial={false}
            animate={{
              scale: isOpponent ? 1 : (currentPiece && isCurrentPieceCell(currentPiece, x, y) ? 1.1 : 1),
              opacity: 1
            }}
            style={{ border: '1px solid #e5e7eb' }}
          />
        ))
      )}
      {fixedBlocks.map((block, index) => (
        <motion.div
          key={`fixed-${index}`}
          className={`w-5 h-5 ${block.color}`}
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'absolute',
            left: `${block.x * 20}px`,
            top: `${block.y * 20}px`,
            border: '1px solid #e5e7eb'
          }}
        />
      ))}
    </div>
  );
}

// ヘルパー関数
function isCurrentPieceCell(piece: any, x: number, y: number): boolean {
  if (!piece) return false;
  const { tetromino, x: pieceX, y: pieceY } = piece;
  
  return tetromino.shape.some((row: number[], dy: number) =>
    row.some((cell: number, dx: number) =>
      cell !== 0 && x === pieceX + dx && y === pieceY + dy
    )
  );
}
