import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, GOTHIC, HandleCtx, LATIN_BOLD, MINCHO } from './brand';

// 最後のお願い（CTA）の部品（2026-10-02 作者の要望）
// 「保存してね の他に、いいねとフォロー、プロフのLINEから詳しい情報を受け取って…など、色々作って組み合わせたい」
// どの型（pattern）の最後にも使える。scene.cta に並べた順に、1行ずつ出て、指がタップする
//   save    … しおりが黄色に塗られる
//   like    … ハートが赤くなり、小さなハートが弾ける
//   follow  … 「フォロー」→「フォロー中 ✓」
//   line    … 緑の LINE ボタンが脈打つ（ロゴは描かない。色と文字だけ）。**プレゼントは LINE からだけ渡す**（本人 2026-10-02）
//   comment … コメント欄に「例えばこんなコメント」が1文字ずつ打たれて送信。**盛り上げ・リクエストを聞く用。DM で何かを届ける約束はしない**
//   share   … 紙飛行機が飛んで、友だちのアイコンが光る
//   profile … 写真入りのプロフィールカードに「↑」

export type CtaAction = 'save' | 'like' | 'follow' | 'line' | 'comment' | 'share' | 'profile';
export type CtaOptions = { keyword?: string; lineLabel?: string; lineSub?: string; commentLabel?: string };

export const CTA_ROW_GAP = 16;  // 行と行の間（フレーム）
export const CTA_TAP = 9;       // 行が出てからタップまで（フレーム）
export const CTA_FIRST = 10;    // 最初の行が出るまで（フレーム）

const LABELS: Record<CtaAction, string> = {
  save: '保存して見返してね',
  like: '良いなと思ったらいいね',
  follow: 'フォローで続きも届きます',
  line: 'プロフのLINEから',
  comment: 'コメントで',
  share: '知らない人に\n送ってあげてね',
  profile: 'ほかの投稿はプロフィールから',
};

const Hand: React.FC<{ tapAt: number }> = ({ tapAt }) => {
  const f = useCurrentFrame();
  const t = f - tapAt;
  if (t < -8 || t > 14) return null;
  const move = interpolate(t, [-8, 0], [60, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const press = t >= 0 && t < 5 ? 0.85 : 1;
  return (
    <div style={{ position: 'absolute', right: -24, bottom: -40, fontSize: 84, transform: `translate(${move}px, ${move}px) scale(${press})`, opacity: interpolate(t, [8, 14], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), zIndex: 5 }}>
      👆
    </div>
  );
};

const Ripple: React.FC<{ at: number; color: string }> = ({ at, color }) => {
  const t = useCurrentFrame() - at;
  if (t < 0 || t > 14) return null;
  return <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: `6px solid ${color}`, transform: `scale(${1 + t / 8})`, opacity: 1 - t / 14 }} />;
};

const Icon: React.FC<{ action: CtaAction; tapAt: number; opts: CtaOptions; fill?: string }> = ({ action, tapAt, opts, fill = C.yellow }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const done = f >= tapAt;
  const p = spring({ frame: f - tapAt, fps, config: { damping: 8, stiffness: 260, mass: 0.5 } });
  const box: React.CSSProperties = { position: 'relative', width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

  if (action === 'save') {
    return (
      <div style={box}>
        <svg width={100} height={125} viewBox="0 0 40 50" style={{ transform: `scale(${done ? 0.9 + 0.1 * p + (1 - p) * 0.3 : 1})` }}>
          <path d="M4 3 h32 v44 l-16 -11 l-16 11 z" fill={done ? fill : C.white} stroke={C.navy} strokeWidth={3.5} strokeLinejoin="round" />
        </svg>
        <Ripple at={tapAt} color={C.yellow} />
        <Hand tapAt={tapAt} />
      </div>
    );
  }
  if (action === 'like') {
    return (
      <div style={box}>
        <div style={{ fontSize: 110, lineHeight: 1, transform: `scale(${done ? 0.8 + 0.2 * p + (1 - p) * 0.5 : 1})`, filter: done ? 'none' : 'grayscale(1) opacity(0.5)' }}>{done ? '❤️' : '🤍'}</div>
        {done && f - tapAt < 18 && [0, 1, 2, 3, 4, 5].map((i) => {
          const t = f - tapAt;
          const a = (i / 6) * Math.PI * 2;
          return <div key={i} style={{ position: 'absolute', fontSize: 34, transform: `translate(${Math.cos(a) * t * 5}px, ${Math.sin(a) * t * 5}px)`, opacity: 1 - t / 18 }}>❤️</div>;
        })}
        <Hand tapAt={tapAt} />
      </div>
    );
  }
  if (action === 'follow') {
    return (
      <div style={{ ...box, width: 250, justifyContent: 'flex-start' }}>
        <div style={{ padding: '16px 22px', borderRadius: 18, fontFamily: GOTHIC, fontWeight: 900, fontSize: 32, whiteSpace: 'nowrap', background: done ? '#E3E6EC' : C.navy, color: done ? C.navy : C.white, border: `3px solid ${C.navy}`, transform: `scale(${done ? 0.92 + 0.08 * p : 1})` }}>
          {done ? 'フォロー中 ✓' : 'フォロー'}
        </div>
        <Hand tapAt={tapAt} />
      </div>
    );
  }
  if (action === 'line') {
    const pulse = 1 + 0.06 * Math.sin(f / 4);
    return (
      <div style={{ ...box, width: 240 }}>
        <div style={{ position: 'absolute', width: 210, height: 110, borderRadius: 60, border: `6px solid ${C.line}`, transform: `scale(${1 + ((f % 30) / 30) * 0.35})`, opacity: 1 - (f % 30) / 30 }} />
        <div style={{ width: 210, height: 110, borderRadius: 60, background: C.line, border: `4px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white, fontFamily: LATIN_BOLD, fontSize: 46, transform: `scale(${pulse * (done ? 0.95 + 0.05 * p : 1)})` }}>
          LINE
        </div>
        <Hand tapAt={tapAt} />
      </div>
    );
  }
  if (action === 'comment') {
    const word = opts.keyword ?? 'わかる！';
    const shown = Math.max(0, Math.min(word.length, Math.floor((f - (tapAt - 10)) / 3)));
    const sent = f >= tapAt + word.length * 3;
    return (
      <div style={{ ...box, width: 290 }}>
        <div style={{ width: 285, height: 90, borderRadius: 48, background: C.white, border: `4px solid ${C.navy}`, display: 'flex', alignItems: 'center', padding: '0 12px 0 20px', gap: 8 }}>
          <span style={{ flex: 1, fontFamily: GOTHIC, fontWeight: 900, fontSize: word.length > 5 ? 26 : 30, color: C.navy, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {word.slice(0, shown)}
            <span style={{ opacity: !sent && f % 16 < 8 ? 1 : 0 }}>|</span>
          </span>
          <div style={{ width: 58, height: 58, flexShrink: 0, borderRadius: '50%', background: sent ? C.orange : '#C9CDD6', color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, transform: `scale(${sent ? 1.1 : 1})` }}>▶</div>
        </div>
      </div>
    );
  }
  if (action === 'share') {
    const t = Math.max(0, f - tapAt);
    const fly = Math.min(1, t / 14);
    return (
      <div style={{ ...box, width: 230, justifyContent: 'flex-start' }}>
        <div style={{ fontSize: 70, transform: `translate(${fly * 110}px, ${-Math.sin(fly * Math.PI) * 70}px) rotate(${-20 + fly * 30}deg)`, opacity: fly >= 1 ? 0 : 1 }}>✈️</div>
        <div style={{ position: 'absolute', right: 0, display: 'flex', gap: 8 }}>
          {[C.sky, C.yellow, C.orange].map((c, i) => (
            <div key={i} style={{ width: 44, height: 44, borderRadius: '50%', background: fly >= 1 ? c : '#E3E6EC', border: `3px solid ${C.navy}`, transform: `scale(${fly >= 1 ? 1 + 0.15 * Math.max(0, 1 - (t - 14 - i * 2) / 6) : 1})` }} />
          ))}
        </div>
        {t === 0 && <Hand tapAt={tapAt} />}
      </div>
    );
  }
  // profile
  const bob = Math.sin(f / 5) * 8;
  return (
    <div style={{ ...box, width: 150 }}>
      <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: `5px solid ${C.yellow}`, boxShadow: `0 0 0 4px ${C.navy}` }}>
        {/* プロフィール写真を使うときは public/img/profile.jpg を置いて、ここを <Img src={staticFile('img/profile.jpg')} …/> に */}
        <div style={{ width: '100%', height: '100%', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>👤</div>
      </div>
      <div style={{ position: 'absolute', top: -46, right: -6, fontSize: 56, fontWeight: 900, color: C.orange, transform: `translateY(${bob}px)` }}>↑</div>
    </div>
  );
};

// 型（pattern）ごとの見た目と出方（2026-10-02 作者の確認「動画のパターンに合わせてデザインが変わる認識で良い？全て一緒なので」→ 型に合わせる）
type RowStyle = {
  card: (i: number) => React.CSSProperties;
  enter: (p: number, i: number, f: number) => string;   // transform
  label?: string;  // 文字色
  badge?: (i: number) => React.ReactNode;               // 左上の飾り
};

const ROW: Record<string, RowStyle> = {
  breaking: {
    card: () => ({ background: C.yellow, border: `6px solid ${C.navy}`, borderRadius: 14, boxShadow: `10px 10px 0 ${C.navy}` }),
    enter: (p, _i, f) => `scale(${1.5 - 0.5 * p}) translateX(${p < 0.98 ? Math.sin(f * 3) * (1 - p) * 30 : 0}px)`,
    badge: () => <div style={{ position: 'absolute', top: -22, left: 24, background: C.orange, color: C.white, fontFamily: GOTHIC, fontWeight: 900, fontSize: 24, padding: '2px 14px', borderRadius: 8, border: `3px solid ${C.navy}` }}>⚡ NEWS</div>,
  },
  howto: {
    card: () => ({ background: C.cream, border: `4px solid ${C.navy}`, borderRadius: 24, boxShadow: `8px 8px 0 ${C.navy}` }),
    enter: (p, i) => `translateX(${(1 - p) * (i % 2 ? 900 : -900)}px) rotate(${(i % 2 ? 1.5 : -1.5) * p}deg)`,
    badge: (i) => <div style={{ position: 'absolute', top: -24, left: -18, width: 56, height: 56, borderRadius: '50%', background: C.yellow, border: `4px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: LATIN_BOLD, fontSize: 26, color: C.navy, transform: 'rotate(-8deg)' }}>{i + 1}</div>,
  },
  naruhodo: {
    card: () => ({ background: C.white, border: `4px solid ${C.navy}`, borderRadius: 999, boxShadow: `0 10px 0 ${C.sky}` }),
    enter: (p) => `scale(${p}) translateY(${(1 - p) * 60}px)`,
  },
  kinetic: {
    card: (i) => ({ background: C.white, border: `6px solid ${C.navy}`, borderRadius: 20, boxShadow: `12px 12px 0 ${[C.orange, C.sky, C.yellow][i % 3]}` }),
    enter: (p, i) => `translate(${(1 - p) * (i % 2 ? 700 : -700)}px, ${(1 - p) * 300}px) rotate(${(1 - p) * (i % 2 ? 20 : -20) + (i % 2 ? 2 : -2)}deg) scale(${0.8 + 0.2 * p})`,
  },
  ngok: {
    card: () => ({ background: C.white, border: `4px solid ${C.navy}`, borderLeft: `26px solid ${C.green}`, borderRadius: 22, boxShadow: `8px 8px 0 ${C.navy}` }),
    enter: (p) => `rotateY(${(1 - p) * 90}deg)`,
    badge: () => <div style={{ position: 'absolute', top: -26, right: 24, background: C.green, color: C.white, fontFamily: LATIN_BOLD, fontSize: 26, padding: '2px 16px', borderRadius: 999, border: `3px solid ${C.navy}` }}>OK</div>,
  },
  ranking: {
    card: () => ({ background: C.white, border: `5px solid ${C.navy}`, outline: `6px solid #E8B400`, outlineOffset: -16, borderRadius: 22, boxShadow: `8px 8px 0 ${C.navy}` }),
    enter: (p) => `translateY(${(1 - p) * -700}px)`,
    badge: (i) => <div style={{ position: 'absolute', top: -38, left: 20, fontSize: 52 }}>{['🥇', '🥈', '🥉'][i % 3]}</div>,
  },
  quiz: {
    card: (i) => ({ background: i % 2 ? '#FFF6C7' : '#E3F2FF', border: `4px solid ${C.navy}`, borderRadius: 28, boxShadow: `8px 8px 0 ${C.navy}` }),
    enter: (p, i) => `translateX(${(1 - p) * (i % 2 ? 900 : -900)}px)`,
    badge: (i) => <div style={{ position: 'absolute', top: -24, left: 20, width: 52, height: 52, borderRadius: 14, background: i % 2 ? C.yellow : C.sky, border: `4px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: LATIN_BOLD, fontSize: 28, color: C.navy }}>{i % 2 ? 'B' : 'A'}</div>,
  },
  pov: {
    card: (i) => ({ background: i % 2 ? C.yellow : C.white, border: `3px solid ${C.navy}`, borderRadius: 34, borderBottomLeftRadius: i % 2 ? 34 : 8, borderBottomRightRadius: i % 2 ? 8 : 34 }),
    enter: (p) => `translateY(${(1 - p) * 140}px) scale(${0.7 + 0.3 * p})`,
  },
  insight: {
    card: () => ({ background: C.cream, border: `2px solid ${C.navy}`, borderRadius: 4 }),
    enter: (p) => `translateY(${(1 - p) * 40}px)`,
  },
  compare: {
    card: () => ({ background: C.yellow, border: `4px solid ${C.navy}`, borderRadius: 28, boxShadow: `8px 8px 0 ${C.navy}` }),
    enter: (p, i) => `translateX(${(1 - p) * (i % 2 ? 900 : -900)}px)`,
  },
};

export const CtaBlock: React.FC<{ actions: CtaAction[]; opts?: CtaOptions; pattern?: string }> = ({ actions, opts = {}, pattern = 'howto' }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const st = ROW[pattern] ?? ROW.howto;
  const handleName = React.useContext(HandleCtx);
  const soft = false || pattern === 'naruhodo';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 34, width: 880, perspective: 1600 }}>
      {actions.map((a, i) => {
        const at = CTA_FIRST + i * CTA_ROW_GAP;
        const p = spring({ frame: f - at, fps, config: soft ? { damping: 9, stiffness: 200, mass: 0.6 } : { damping: 11, stiffness: 230, mass: 0.5 } });
        let label = LABELS[a];
        let sub: string | undefined;
        if (a === 'line') { label = opts.lineLabel ?? LABELS.line; sub = opts.lineSub ?? 'プロフィールの\nリンクから'; }
        if (a === 'comment') { label = opts.commentLabel ?? 'コメントで\n教えてね'; sub = undefined; }
        if (a === 'profile') sub = handleName;
        return (
          <div
            key={a + i}
            style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 26, padding: '18px 34px',
              ...st.card(i),
              transform: st.enter(p, i, f), opacity: Math.min(1, p * 2),
            }}
          >
            {st.badge && st.badge(i)}
            <Icon action={a} tapAt={at + CTA_TAP} opts={opts} fill={false || pattern === 'compare' || (false && i % 2 === 1) ? C.orange : C.yellow} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: false ? MINCHO : GOTHIC, fontWeight: false ? 600 : 900, fontSize: 40, color: C.navy, lineHeight: 1.35, whiteSpace: 'pre-line' }}>{label}</div>
              {sub && <div style={{ fontFamily: GOTHIC, fontWeight: 800, fontSize: 32, color: C.muted, marginTop: 6, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
