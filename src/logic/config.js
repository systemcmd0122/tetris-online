export const APP_VERSION = "3.1.0";

/** Firebase設定 — auth.js / db.js / フィードバックウィジェットで共有 */
export const FB_CONFIG = {
  apiKey:            'AIzaSyCjYKsc8eT9gDXEMQsfI0ZJ7UeuLwrDTxw',
  authDomain:        'tetris-online-9c827.firebaseapp.com',
  databaseURL:       'https://tetris-online-9c827-default-rtdb.firebaseio.com',
  projectId:         'tetris-online-9c827',
  storageBucket:     'tetris-online-9c827.firebasestorage.app',
  messagingSenderId: '1045054992314',
  appId:             '1:1045054992314:web:7fea20b9be543d7cab3783',
};

export const UPDATE_LOG = [
  {
    version: "3.1.0",
    title: "プレイヤー名統一・ログイン情報常時表示・UI修正",
    changes: [
      "Googleアカウントでログイン中は、スプリント・マルチ対戦・ボット対戦のすべてでFirestoreの表示名がPLAYER NAMEに自動反映されるようになりました。入力欄はロックされ、プロフィールから変更した名前がどのモードでも一貫して使用されます。",
      "スプリント・マルチ対戦・ボット対戦のロビー画面にアカウントウィジェットを追加。ログイン状態がゲーム画面でも常に確認できるようになりました。",
      "あそびかた・更新履歴ページの右上にアカウントウィジェットを固定表示するようにしました。全ページでログイン状態を把握できます。",
      "プロフィールのBEST SPRINTカードで時間表示（例: 04:12.30）が途切れていた問題を修正しました。フォントサイズとレターSPACINGを調整し、カード幅内に完全に収まるようになりました。",
    ]
  },
  {
    version: "3.0.1",
    title: "パフォーマンス・UX改善",
    changes: [
      "Firebase設定をconfig.jsに一元化し、コードの重複を解消しました（auth.js・db.js・フィードバックウィジェット）。",
      "SE（効果音）のON/OFF状態をlocalStorageに保存するようにしました。ページを再読み込みしても設定が引き継がれます。",
      "Googleフォントにpreconnectヒントとdisplayオプションを追加し、フォント読み込み速度を改善しました。",
      "iOS Safari向けのPWAメタタグ（apple-mobile-web-app-capable など）を追加しました。",
      "how-to・更新履歴ページにOGP画像・Twitterカード画像メタタグを追加しました。",
      "主要ボタンにaria-labelを付与し、スクリーンリーダー対応を改善しました。",
    ]
  },
  {
    version: "3.0.0",
    title: "Googleアカウント連携・プロフィール機能追加",
    changes: [
      "Googleアカウントでのログイン機能を追加しました。全ページのロビー画面からワンクリックでサインイン/サインアウトできます。",
      "ログイン中はアカウントの表示名が自動でプレイヤー名に反映され、入力欄がロックされます。",
      "プロフィールページ（profile.html）を新設。アバター・表示名・登録日・最終プレイ日などのアカウント情報を表示します。",
      "マルチ対戦の結果（順位・スコア・ライン数・攻撃数・対戦相手名・モード）がFirestoreに自動保存され、プロフィールページで対戦履歴として確認できます。",
      "スプリントのプレイ記録（タイム・スコア・ライン数・グローバル順位）も自動保存され、プロフィールページで全履歴を確認できます。",
      "プロフィールページに統計カードを追加。総対戦数・勝率（バーグラフ付き）・ベストスプリントタイム・総ライン数・連勝数などが一目で確認できます。",
      "未ログインのユーザーはルーム作成・参加・スプリントランキング登録が不可になります。クイックマッチはゲストとして参加可能です（履歴は記録されません）。",
      "メニュー画面にプロフィールページへのリンクボタンを追加しました。"
    ]
  }
];
