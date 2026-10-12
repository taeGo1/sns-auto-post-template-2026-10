// SNS担当（Instagram カルーセル／リール）のデザイン
// 色を変えたいときは、下の C の値を書き換える（Claude に「brand.ts の色を、私のブランドカラー〇〇に合わせて」と頼むと楽）
// 型（Pattern）ごとに配色・書体・動き・音楽が変わる

import React from 'react';
import type { Pattern } from './types';

export const C = {
  navy: '#1E293B',
  navyDeep: '#0F172A',
  yellow: '#5EEAD4',
  yellowSoft: '#CCFBF1',
  cream: '#F8FAFC',
  creamDark: '#E2E8F0',
  white: '#FFFFFF',
  muted: '#64748B',
  orange: '#F97316',
  sky: '#93C5FD',
  red: '#E5484D',     // NG の×（やりがちNG→OK）
  green: '#22B07D',   // OK の◯
  chatBg: '#EEF0F5',  // POV のチャット画面
  line: '#06C755',    // LINE の緑（ロゴは描かない）
};

// 書体は src/fonts.ts で同梱ファイルから読み込む（Mac とクラウドで同じ見た目にするため・2026-10-02）
// 置き換え前：明朝＝ヒラギノ明朝／ゴシック＝ヒラギノ角ゴ／英字＝Didot／英字太＝Arial Black
export const MINCHO = '"Noto Serif JP", "Noto Color Emoji", serif';
export const GOTHIC = '"Noto Sans JP", "Noto Color Emoji", sans-serif';
export const LATIN = '"Playfair Display", "Noto Serif JP", serif';
export const LATIN_BOLD = '"Archivo Black", "Noto Sans JP", sans-serif';

export const HANDLE = '@your_account'; // 既定の名前。ふだんは settings.yml の account から自動で入る
// 画面に出す名前（Reel・Carousel・最後のお願いで共通）
export const HandleCtx = React.createContext(HANDLE);

// Instagram リールで UI に隠れる範囲（別の動画プロジェクト の LabSnsVertical と同じ値）
export const REEL_SAFE = { top: 230, right: 90, bottom: 380, left: 72 };
// TikTok：上のタブ・右のいいね等のボタン列・下のキャプションと音楽表示を避ける
export const TIKTOK_SAFE = { top: 200, right: 170, bottom: 460, left: 72 };

export type Transition = 'wipe' | 'iris' | 'flash' | 'slideup' | 'stamp' | 'drop' | 'split' | 'none';

export type Theme = {
  bpm: number;        // 音楽のテンポ（tools/make_bgm.py の STYLE と同じ値にする）
  transition: Transition; // 場面の切り替え方（約3秒ごとに画面の流れを変える＝パターン崩し）
  label: string;      // 画面に出す型の名前
  tag: string;        // 英字タグ
  bg: string;         // 背景色
  ink: string;        // 文字色
  sub: string;        // 補足の文字色
  accent: string;     // 番号・線など
  marker: string;     // マーカーの色
  sticker: string;    // シールの地色
  stickerInk: string;
  head: string;       // 見出しの書体
  headWeight: number;
};

// 型（パターン）。最初は3つだけ。自分の型は Claude と話しながら足す（rules/型を自分で作る.md）
export const THEMES: Record<string, Theme> = {
  // ノウハウ：手順・チェックリスト。保存したくなる
  howto: {
    bpm: 128, transition: 'wipe',
    label: 'ノウハウ', tag: 'HOW TO',
    bg: C.cream, ink: C.navy, sub: C.muted, accent: C.navy, marker: C.yellow,
    sticker: C.yellow, stickerInk: C.navy, head: GOTHIC, headWeight: 900,
  },
  // なるほど：「？」→「！」
  naruhodo: {
    bpm: 140, transition: 'iris',
    label: 'なるほど', tag: 'DID YOU KNOW?',
    bg: C.white, ink: C.navy, sub: C.muted, accent: C.sky, marker: C.yellow,
    sticker: C.sky, stickerInk: C.navy, head: GOTHIC, headWeight: 900,
  },
  // ビフォーアフター：前と後で何が変わったか
  compare: {
    bpm: 108, transition: 'slideup',
    label: 'ビフォーアフター', tag: 'BEFORE / AFTER',
    bg: C.white, ink: C.navy, sub: C.muted, accent: C.orange, marker: C.yellow,
    sticker: C.orange, stickerInk: C.white, head: GOTHIC, headWeight: 900,
  },
};
