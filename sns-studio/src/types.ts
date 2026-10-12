// SNS担当が書く「下書きデータ」の形（props/*.json）
// 文字はすべて SNS担当が書く。デザイン側では文字を作らない

// 内容の型（作者の要望 2026-10-01：ニュース・ノウハウ・なるほど…パターンで雰囲気を変える）
// 2026-10-02 追加：compare（ビフォーアフター）・kinetic（テンポ／場面ごとに背景色が切り替わる・TikTok向き）
// 2026-10-02 8パターン化：ngok（やりがちNG→OK）・ranking（ランキング）・quiz（クイズ・どっち？）・pov（POV・あるある）
export type Pattern = 'breaking' | 'howto' | 'naruhodo' | 'insight' | 'compare' | 'kinetic' | 'ngok' | 'ranking' | 'quiz' | 'pov';

// mark：本文の中で黄色マーカーを引く言葉（本文にそのまま含まれている語を1つ）
export type Slide =
  | { type: 'cover'; kicker?: string; title: string; sub?: string; mark?: string }
  | { type: 'point'; no: string; title: string; body: string; mark?: string }
  | { type: 'list'; title: string; items: string[] }
  | { type: 'question'; title: string; sub?: string }
  | { type: 'answer'; title: string; body?: string; mark?: string }
  // やることはこれ（2026-10-05 作者「具体的に何をしたらいいか、最後にもう一度案内する」）：cta の直前に1枚。items＝1〜3手順、say＝頼み方の言葉
  | { type: 'todo'; title?: string; items: string[]; say?: string }
  | { type: 'cta'; title: string; body?: string };

// イメージ図の場面（2026-10-02 追加）：chat＝チャット画面／brief＝チェックの入る紙／flow＝スマホ→PC等の流れ／image＝用意した画像
// 2026-10-02 追加：punch（キーワードを中央に1語ずつ）／number（大きな数字）／compare（上下でBEFORE・AFTER）／cards（カードが飛んできて重なる）
// 2026-10-05 追加：todo（やることはこれ＝cta の直前に、具体的に何をしたらいいかを1〜3手順＋頼み方の言葉で）
export type SceneKind = 'hook' | 'point' | 'list' | 'question' | 'answer' | 'cta' | 'chat' | 'brief' | 'flow' | 'image' | 'punch' | 'number' | 'compare' | 'cards' | 'ngok' | 'rank' | 'quiz' | 'pov' | 'todo';

export type Scene = {
  kind?: SceneKind;   // 省略時は point
  text: string;       // 大きく出す1〜2行（改行は \n）
  sub?: string;       // 小さく添える1行
  no?: string;        // point の番号（"1" など）
  items?: string[];   // list のとき
  mark?: string;      // マーカーを引く言葉
  chat?: { me: string; attach?: string; ai: string; aiMarks?: string[]; note?: string };  // kind: chat（会話はイメージ。aiMarks＝返事の中のマーカー、note＝返事のあとの札）
  brief?: { title: string; items: string[] };          // kind: brief
  steps?: string[];                                    // kind: flow（「スマホ」「PC」を含むと端末の絵になる）
  image?: { src: string; caption?: string };           // kind: image（public/ からの相対パス）
  words?: string[];                                    // kind: punch（1語ずつ中央に。1語8字まで・4語まで）
  value?: string;                                      // kind: number（例 "4" "30%" "1回目"）
  label?: string;                                      // kind: number の下の言葉
  before?: string;                                     // kind: compare（\n で改行・2行まで）
  after?: string;
  cards?: string[];                                    // kind: cards（4枚まで・1枚10字まで）
  align?: 'left' | 'center';                           // hook / point の文字寄せ（省略時：型で決まる）
  ng?: string; ok?: string;                            // kind: ngok（NG の例 → × のハンコ → 裏返って OK の例）
  rank?: number;                                       // kind: rank（3→2→1。1 はスポットライト）
  a?: string; b?: string; answer?: 'a' | 'b';          // kind: quiz（A/B と正解。3秒のタイマーのあと正解が出る）
  countdown?: boolean;                                 // kind: answer（答えの前に 3・2・1）
  reactions?: string[];                                // kind: pov / chat（飛び出す絵文字）
  // 最後のお願い（kind: cta）。並べた順に1行ずつ出る。1〜3個がおすすめ
  cta?: Array<'save' | 'like' | 'follow' | 'line' | 'comment' | 'share' | 'profile'>;
  keyword?: string;                                    // cta の comment でコメント欄に打たれる「例えばこんなコメント」
  commentLabel?: string;                               // cta の comment の文言（省略時「コメントで教えてね」）
  lineLabel?: string; lineSub?: string;                // cta の line の文言（省略時「プロフのLINEから／詳しい情報を受け取れます」）
  say?: string;                                        // kind: todo の「こう頼む」の言葉（2行まで）。items は手順（1〜3つ）
  beats?: number;                                      // 秒数の代わりに「拍の数」で長さを決める（音楽の拍に切り替えが合う）
  seconds?: number;
};

export type SnsProps = {
  pattern: Pattern;
  carousel: { slides: Slide[] };
  reel: { scenes: Scene[] };
  bgm?: string;       // public/ からの相対パス（例 "bgm/2026-10-01_xxx.wav"）。無ければ無音
  platform?: 'instagram' | 'tiktok';  // 文字を避ける範囲が変わる（TikTok は右と下のボタンが多い）
  layout?: 'tall' | 'wide';           // wide＝横長（1920×1080・X と Threads 用）。2026-10-05 作者「縦長だけで横長が無い」
  handle?: string;                    // 画面に出す名前（settings.yml の account.name_on_video）
  handle_wide?: string;               // 横長の動画に出す名前（settings.yml の account.name_on_wide_video）
};

export const EMPTY: SnsProps = {
  pattern: 'howto',
  carousel: {
    slides: [
      { type: 'cover', kicker: 'HOW TO', title: 'サンプルの表紙', sub: 'props の JSON で差し替わります', mark: 'サンプル' },
      { type: 'point', no: '01', title: 'ポイントの見出し', body: '本文が入ります。1枚に伝えることは1つだけ。', mark: '1つだけ' },
      { type: 'list', title: 'まとめ', items: ['1つ目', '2つ目', '3つ目'] },
      { type: 'cta', title: '保存して見返してね', body: 'ほかの投稿はプロフィールから' },
    ],
  },
  reel: {
    scenes: [
      { kind: 'hook', text: 'サンプルの\nリール', sub: 'props の JSON で差し替え', seconds: 2.5 },
      { kind: 'point', no: '1', text: 'ポイント', sub: '補足', seconds: 2.5 },
      { kind: 'cta', text: '保存してね', seconds: 2.5 },
    ],
  },
};
