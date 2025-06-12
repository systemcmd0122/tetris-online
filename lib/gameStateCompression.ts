import { deflate, inflate } from 'pako';

// ゲームステートの圧縮と最適化を行うユーティリティ
export interface CompressedGameState {
  b?: string; // board (RLE圧縮)
  f?: number[][]; // fixed blocks (最後に固定されたブロック)
  c?: {  // current piece
    x: number;
    y: number;
    t: string; // tetromino type
    r: number; // rotation
  };
  s?: number; // score
  l?: number; // level
  a?: number; // attack
  o?: boolean; // game over
  t?: number; // timestamp
  h?: string; // move hash
}

// ボードの状態をRLE圧縮
function compressBoardRLE(board: number[][]): string {
  let compressed = '';
  let count = 0;
  let lastCell = board[0][0];

  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y].length; x++) {
      const cell = board[y][x];
      if (cell === lastCell) {
        count++;
      } else {
        compressed += `${count},${lastCell};`;
        count = 1;
        lastCell = cell;
      }
    }
  }
  compressed += `${count},${lastCell}`;
  return compressed;
}

// RLE圧縮されたボードを展開
function decompressBoardRLE(compressed: string): number[][] {
  const board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
  let idx = 0;
  let boardIdx = 0;

  compressed.split(';').forEach(group => {
    const [count, value] = group.split(',').map(Number);
    for (let i = 0; i < count; i++) {
      const y = Math.floor(boardIdx / BOARD_WIDTH);
      const x = boardIdx % BOARD_WIDTH;
      if (y < BOARD_HEIGHT && x < BOARD_WIDTH) {
        board[y][x] = value;
      }
      boardIdx++;
    }
  });

  return board;
}

export function compressGameState(gameState: any): string {
  const minimalState: CompressedGameState = {
    t: Date.now(),
    h: Math.random().toString(36).substring(7)
  };
  
  if (gameState.board) {
    minimalState.b = compressBoardRLE(gameState.board);
  }

  if (gameState.fixedBlocks) {
    minimalState.f = gameState.fixedBlocks;
  }

  if (gameState.currentPiece) {
    minimalState.c = {
      x: gameState.currentPiece.x,
      y: gameState.currentPiece.y,
      t: gameState.currentPiece.tetromino.shape.length === 4 ? 'I' :
         gameState.currentPiece.tetromino.shape.length === 2 ? 'O' :
         gameState.currentPiece.tetromino.shape[0][0] === 1 ? 'Z' :
         gameState.currentPiece.tetromino.shape[0][1] === 1 ? 'T' :
         gameState.currentPiece.tetromino.shape[1][0] === 1 ? 'J' : 'L',
      r: calculateRotation(gameState.currentPiece.tetromino.shape)
    };
  }

  if (gameState.score !== undefined) minimalState.s = gameState.score;
  if (gameState.level !== undefined) minimalState.l = gameState.level;
  if (gameState.attackSent !== undefined) minimalState.a = gameState.attackSent;
  if (gameState.gameOver !== undefined) minimalState.o = gameState.gameOver;

  // 状態を文字列に変換し、圧縮
  const jsonString = JSON.stringify(minimalState);
  const compressed = deflate(jsonString, { to: 'string' });
  return btoa(compressed);
}

export function decompressGameState(compressed: string): any {
  if (!compressed) return null;
  
  try {
    const decompressed = inflate(atob(compressed), { to: 'string' });
    const minimalState: CompressedGameState = JSON.parse(decompressed);
    
    return {
      board: minimalState.b ? decompressBoardRLE(minimalState.b) : [],
      fixedBlocks: minimalState.f || [],
      currentPiece: minimalState.c ? {
        x: minimalState.c.x,
        y: minimalState.c.y,
        tetromino: expandTetromino(minimalState.c.t, minimalState.c.r)
      } : null,
      score: minimalState.s || 0,
      level: minimalState.l || 1,
      attackSent: minimalState.a,
      gameOver: minimalState.o,
      timestamp: minimalState.t,
      moveHash: minimalState.h
    };
  } catch (error) {
    console.error('Decompression error:', error);
    return null;
  }
}

function calculateRotation(shape: number[][]): number {
  // 回転状態を0-3の数値で表現
  // 実装は省略（形状から回転状態を計算）
  return 0;
}

function expandTetromino(type: string, rotation: number): any {
  // テトロミノの形状を再構築
  const shapes = {
    I: { shape: [[1, 1, 1, 1]], color: 'cyan-500' },
    J: { shape: [[1, 0, 0], [1, 1, 1]], color: 'blue-500' },
    L: { shape: [[0, 0, 1], [1, 1, 1]], color: 'orange-500' },
    O: { shape: [[1, 1], [1, 1]], color: 'yellow-500' },
    S: { shape: [[0, 1, 1], [1, 1, 0]], color: 'green-500' },
    T: { shape: [[0, 1, 0], [1, 1, 1]], color: 'purple-500' },
    Z: { shape: [[1, 1, 0], [0, 1, 1]], color: 'red-500' }
  };
  
  // 基本形状を取得
  const base = shapes[type];
  
  // 回転を適用（実装は省略）
  return base;
}
