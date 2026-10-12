// SNS担当（Instagram カルーセル／リール）のデザイン
// 色を変えたいときは、下の C の値を書き換える（Claude に「brand.ts の色を、私のブランドカラー〇〇に合わせて」と頼むと楽）
// 型（Pattern）ごとに配色・書体・動き・音楽が変わる

import React from 'react';
import type { Pattern } from './types';

export const C = {
  navy: '#152043',
  navyDeep: '#0D1530',
  yellow: '#FFD500',
  yellowSoft: '#FFF4A8',
  cream: '#FAF6EA',
  creamDark: '#EFE7CF',
  white: '#FFFFFF',
  muted: '#4B5A75',
  orange: '#F08437',
  sky: '#7CC4FF',
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

export const THEMES: Record<Pattern, Theme> = {
  // 速報：黄色が主役。紺のストライプとオレンジの札で「いま起きている」感
  breaking: {
    bpm: 160, transition: 'flash',
    label: '速報', tag: 'BREAKING NEWS',
    bg: C.yellow, ink: C.navy, sub: C.navy, accent: C.orange, marker: C.white,
    sticker: C.orange, stickerInk: C.white, head: GOTHIC, headWeight: 900,
  },
  // ノウハウ：クリームに水玉。黄色マーカーと番号シールで「保存したくなる」
  howto: {
    bpm: 128, transition: 'wipe',
    label: 'ノウハウ', tag: 'HOW TO',
    bg: C.cream, ink: C.navy, sub: C.muted, accent: C.navy, marker: C.yellow,
    sticker: C.yellow, stickerInk: C.navy, head: GOTHIC, headWeight: 900,
  },
  // なるほど：白に黄色と水色の丸。「？」→「！」
  naruhodo: {
    bpm: 140, transition: 'iris',
    label: 'なるほど', tag: 'DID YOU KNOW?',
    bg: C.white, ink: C.navy, sub: C.muted, accent: C.sky, marker: C.yellow,
    sticker: C.sky, stickerInk: C.navy, head: GOTHIC, headWeight: 900,
  },
  // ビフォーアフター：白に方眼。BEFORE はくすんだ色、AFTER は黄色で「変わった」を見せる
  compare: {
    bpm: 108, transition: 'slideup',
    label: 'ビフォーアフター', tag: 'BEFORE / AFTER',
    bg: C.white, ink: C.navy, sub: C.muted, accent: C.orange, marker: C.yellow,
    sticker: C.orange, stickerInk: C.white, head: GOTHIC, headWeight: 900,
  },
  // テンポ：場面ごとに背景色が斜めに切り替わる。文字は中央・大きく。TikTok 向き
  kinetic: {
    bpm: 150, transition: 'wipe',
    label: 'テンポ', tag: 'QUICK',
    bg: C.yellow, ink: C.navy, sub: C.navy, accent: C.orange, marker: C.white,
    sticker: C.navy, stickerInk: C.yellow, head: GOTHIC, headWeight: 900,
  },
  // やりがちNG→OK：白地。NG は赤い×のハンコ、OK は緑の◯。損したくない気持ちで最後まで見てもらう
  ngok: {
    bpm: 132, transition: 'stamp',
    label: 'やりがちNG', tag: 'NG → OK',
    bg: C.white, ink: C.navy, sub: C.muted, accent: C.red, marker: C.yellow,
    sticker: C.red, stickerInk: C.white, head: GOTHIC, headWeight: 900,
  },
  // ランキング：黄色地にスポットライト。1位は最後まで隠す
  ranking: {
    bpm: 120, transition: 'drop',
    label: 'ランキング', tag: 'RANKING',
    bg: C.yellow, ink: C.navy, sub: C.navy, accent: C.orange, marker: C.white,
    sticker: C.navy, stickerInk: C.yellow, head: GOTHIC, headWeight: 900,
  },
  // クイズ：左右に分かれた A（水色）／B（黄色）。タイマーで答えを待たせる
  quiz: {
    bpm: 140, transition: 'split',
    label: 'クイズ', tag: 'QUIZ',
    bg: C.white, ink: C.navy, sub: C.muted, accent: C.sky, marker: C.yellow,
    sticker: C.sky, stickerInk: C.navy, head: GOTHIC, headWeight: 900,
  },
  // POV・あるある：スマホのチャット画面のような明るいグレー。手作り感
  pov: {
    bpm: 124, transition: 'slideup',
    label: 'POV', tag: 'POV',
    bg: C.chatBg, ink: C.navy, sub: C.muted, accent: C.orange, marker: C.yellow,
    sticker: C.navy, stickerInk: C.white, head: GOTHIC, headWeight: 900,
  },
  // 考察：クリームに紺の明朝。大人っぽく、でも暗くしない
  insight: {
    bpm: 84, transition: 'none',
    label: '考察', tag: 'INSIGHT',
    bg: C.cream, ink: C.navy, sub: C.muted, accent: C.yellow, marker: C.yellowSoft,
    sticker: C.navy, stickerInk: C.yellow, head: MINCHO, headWeight: 600,
  },
};
