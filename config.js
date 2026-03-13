export const APP_VERSION = "1.4.0";

// ═══════════════════════════════════════════════════════════════
// FIREBASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCjYKsc8eT9gDXEMQsfI0ZJ7UeuLwrDTxw",
  authDomain: "tetris-online-9c827.firebaseapp.com",
  databaseURL: "https://tetris-online-9c827-default-rtdb.firebaseio.com",
  projectId: "tetris-online-9c827",
  storageBucket: "tetris-online-9c827.firebasestorage.app",
  messagingSenderId: "1045054992314",
  appId: "1:1045054992314:web:7fea20b9be543d7cab3783"
};

// ═══════════════════════════════════════════════════════════════
// GAME CONFIGURATION
// ═══════════════════════════════════════════════════════════════
export const GAME_CONFIG = {
  COLS: 10,
  ROWS: 20,
  CELL: 20,
  LOCK_DELAY: 500,
  MAX_RESETS: 15,
  LINE_SCORES: [0, 100, 300, 500, 800],
  TSPIN_SCORES: [400, 800, 1200, 1600],
  B2B_MULTIPLIER: 1.5,
  DAS: 167,
  ARR: 33,
  ENTRY_DELAY: 200,
  SOFT_DROP_INTERVAL: 50,
  PUSH_RATE: 50,
  COUNTDOWN_DELAY: 4800
};

// ═══════════════════════════════════════════════════════════════
// ROOM CODE CONFIGURATION
// ═══════════════════════════════════════════════════════════════
export const ROOM_CONFIG = {
  CODE_MIN: 1000,
  CODE_MAX: 9999,
  MAX_RETRIES: 5,
  RETRY_DELAY: 100
};

// ═══════════════════════════════════════════════════════════════
// ADMIN CONFIGURATION
// ═══════════════════════════════════════════════════════════════
// パスワードはサーバー側で検証するべきですが、デモ用にクライアント側に配置
// 本番環境では Cloud Functions で検証すること
export const ADMIN_PASSWORD = "TETRIS_ADMIN_2026";

export const UPDATE_LOG = [
  {
    version: "1.4.0",
    title: "マルチプレイヤー対戦とソロモードの追加",
    changes: [
      "対戦モードが最大4人まで同時プレイ可能になりました。",
      "新モード「ソロモード」を追加しました（マラソン・40ラインスプリント）。",
      "ゲームエンジンを共通モジュール化し、動作の安定性を向上させました。",
      "ホストによる試合開始タイミングの制御機能を実装しました。",
      "複数の対戦相手へのランダムなお邪魔ブロック送信ロジックを実装しました。"
    ]
  },
  {
    version: "1.3.0",
    title: "セキュリティ強化とバグ修正",
    changes: [
      "Firebase設定を分離し、セキュリティ対策を実装しました。",
      "ルームコード認識時の衝突判定をサーバー側で行うようにしました。",
      "グローバル変数をオブジェクト化し、スコープ管理を改善しました。",
      "エラーハンドリングを強化し、接続エラー時の再試行ロジックを追加しました。",
      "ボットAIの処理を最適化し、フレームレートが低下しにくくしました。",
      "モバイル操作パネルのボタンサイズを拡大し、タッチペインを改善しました。"
    ]
  },
  {
    version: "1.2.0",
    title: "ボットAIとバトルの大幅改善",
    changes: [
      "ボットのAI評価アルゴリズムを改良し、より高度な配置を行うようになりました。",
      "Back-to-Back (B2B) ボーナスを実装し、連続でテトリスやT-Spinを行うと攻撃力が1.5倍になります。",
      "Entry Delay (ARE) を200ms追加し、ライン消去後の操作感を向上させました。",
      "サーバーへの同期レートを50msに最適化し、対戦時のラグを軽減しました。"
    ]
  },
  {
    version: "1.1.0",
    title: "対戦機能の強化",
    changes: [
      "お邪魔ブロックの計算ロジックを修正し、より正確なライン送信が可能になりました。",
      "ルーム作成時のタイムスタンプ同期を改善し、カウントダウンのズレを解消しました。",
      "ホールド機能使用時の重力タイマーリセットを追加しました。"
    ]
  },
  {
    version: "1.0.0",
    title: "正式リリース",
    changes: [
      "オンライン対戦テトリス「TETRIS BATTLE」をリリースしました。",
      "リアルタイム対戦、ボット対戦、管理コンソールを搭載。"
    ]
  }
];

