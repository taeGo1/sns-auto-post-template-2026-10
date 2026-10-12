import React from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, LATIN_BOLD } from './brand';
import type { Pattern } from './types';

// 動きの部品（別の動画プロジェクト の LabFun.tsx の考え方を、SNS用に作り直したもの）
// カルーセル（静止画）では frame が 0 か小さいので、`still` を true にして「出来上がった状態」で描く

export const lines = (s: string) =>
  s.split('\n').map((l, i) => (
    <React.Fragment key={i}>
      {i > 0 && <br />}
      {l}
    </React.Fragment>
  ));

/* ---------- 背景（型ごと） ---------- */

export const Background: React.FC<{ pattern: Pattern; still?: boolean }> = ({ pattern, still }) => {
  const frame = useCurrentFrame();
  const f = still ? 0 : frame;
  if (pattern === 'breaking') {
    return (
      <AbsoluteFill style={{ background: C.yellow, overflow: 'hidden' }}>
        {/* 紺のななめストライプ（上下の帯） */}
        {[0, 1].map((k) => (
          <div
            key={k}
            style={{
              position: 'absolute', left: -200, right: -200, height: 70,
              top: k === 0 ? 0 : undefined, bottom: k === 1 ? 0 : undefined,
              backgroundImage: `repeating-linear-gradient(-45deg, ${C.navy} 0 34px, ${C.yellow} 34px 68px)`,
              backgroundPosition: `${(k ? -1 : 1) * f * 3}px 0`,
            }}
          />
        ))}
        {/* 大きな薄い文字 */}
        <div
          style={{
            position: 'absolute', right: -40, bottom: 120, fontFamily: LATIN_BOLD, fontSize: 300,
            color: 'rgba(21,32,67,0.06)', transform: `translateX(${-f * 1.5}px)`, whiteSpace: 'nowrap',
          }}
        >
          NEWS NEWS
        </div>
      </AbsoluteFill>
    );
  }
  if (pattern === 'howto') {
    return (
      <AbsoluteFill
        style={{
          background: C.cream,
          backgroundImage: `radial-gradient(rgba(21,32,67,0.10) 5px, transparent 6px)`,
          backgroundSize: '56px 56px',
          backgroundPosition: `${f * 0.6}px ${f * 0.6}px`,
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, background: C.yellow }} />
      </AbsoluteFill>
    );
  }
  if (pattern === 'compare') {
    return (
      <AbsoluteFill
        style={{
          background: C.white,
          backgroundImage: `linear-gradient(rgba(21,32,67,0.06) 2px, transparent 2px), linear-gradient(90deg, rgba(21,32,67,0.06) 2px, transparent 2px)`,
          backgroundSize: '60px 60px', backgroundPosition: `0 ${f * 0.5}px`,
        }}
      />
    );
  }
  if (pattern === 'ngok') {
    return (
      <AbsoluteFill style={{ background: C.white, backgroundImage: `repeating-linear-gradient(-45deg, rgba(229,72,77,0.06) 0 30px, transparent 30px 60px)`, backgroundPosition: `${f}px 0` }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, background: C.red }} />
      </AbsoluteFill>
    );
  }
  if (pattern === 'ranking') {
    return (
      <AbsoluteFill style={{ background: C.yellow, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', width: 120, height: 3000, background: 'rgba(255,255,255,0.28)', transform: `rotate(${i * 22.5 + f * 0.4}deg)` }} />
        ))}
      </AbsoluteFill>
    );
  }
  if (pattern === 'quiz') {
    return (
      <AbsoluteFill style={{ background: `linear-gradient(90deg, #E6F3FF 0 50%, #FFF8D6 50% 100%)` }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, background: `linear-gradient(90deg, ${C.sky} 0 50%, ${C.yellow} 50% 100%)` }} />
      </AbsoluteFill>
    );
  }
  if (pattern === 'pov') {
    return (
      <AbsoluteFill style={{ background: C.chatBg }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, background: C.navy }} />
      </AbsoluteFill>
    );
  }
  if (pattern === 'kinetic') {
    return <AbsoluteFill style={{ background: C.yellow }} />;
  }
  if (pattern === 'naruhodo') {
    const circles = [
      { x: 0.86, y: 0.12, r: 260, c: C.yellow },
      { x: 0.08, y: 0.84, r: 320, c: C.sky },
      { x: 0.9, y: 0.78, r: 120, c: C.yellow },
      { x: 0.12, y: 0.2, r: 70, c: C.sky },
    ];
    return (
      <AbsoluteFill style={{ background: C.white, overflow: 'hidden' }}>
        {circles.map((o, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: `${o.x * 100}%`, top: `${o.y * 100}%`,
              width: o.r * 2, height: o.r * 2, borderRadius: '50%', background: o.c, opacity: 0.55,
              transform: `translate(-50%, -50%) translateY(${Math.sin(f / 20 + i) * 18}px)`,
            }}
          />
        ))}
      </AbsoluteFill>
    );
  }
  // insight
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${C.cream} 0%, ${C.creamDark} 100%)` }}>
      <div style={{ position: 'absolute', inset: 44, border: `1px solid rgba(21,32,67,0.25)` }} />
      <div
        style={{
          position: 'absolute', left: 44, top: 44, width: interpolate(f, [0, 30], [still ? 220 : 0, 220], { extrapolateRight: 'clamp' }),
          height: 6, background: C.yellow,
        }}
      />
    </AbsoluteFill>
  );
};

/* ---------- ぴょんっと出る ---------- */

export const Pop: React.FC<{ delay?: number; still?: boolean; from?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  delay = 0, still, from = 0, style, children,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 2026-10-02：テンポ型に合わせて速く（stiffness 170→250）
  const p = still ? 1 : spring({ frame: f - delay, fps, config: { damping: 10, mass: 0.5, stiffness: 250 } });
  const s = from + (1 - from) * p;
  return <div style={{ opacity: Math.min(1, p * 2), transform: `scale(${s})`, transformOrigin: 'left center', ...style }}>{children}</div>;
};

// 下からすっと浮かぶ（考察の型用・上品）
export const Rise: React.FC<{ delay?: number; still?: boolean; style?: React.CSSProperties; children: React.ReactNode }> = ({
  delay = 0, still, style, children,
}) => {
  const f = useCurrentFrame();
  const p = still ? 1 : interpolate(f - delay, [0, 11], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)`, ...style }}>{children}</div>;
};

// ドンッと叩きつける（速報の型用）
export const Slam: React.FC<{ delay?: number; still?: boolean; style?: React.CSSProperties; children: React.ReactNode }> = ({
  delay = 0, still, style, children,
}) => {
  const f = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const p = still ? 1 : spring({ frame: f, fps, config: { damping: 14, mass: 0.5, stiffness: 260 } });
  const shake = still || f < 4 || f > 12 ? 0 : Math.sin(f * 3) * (12 - f);
  return (
    <div style={{ opacity: Math.min(1, p * 3), transform: `scale(${1.6 - 0.6 * p}) translateX(${shake}px)`, transformOrigin: 'left center', ...style }}>
      {children}
    </div>
  );
};

/* ---------- マーカー（本文の一部に黄色の線を引く） ---------- */

export const Marked: React.FC<{ text: string; mark?: string; color: string; delay?: number; still?: boolean }> = ({
  text: rawText, mark: rawMark, color, delay = 0, still,
}) => {
  // 「Sonnet 5.5」のような英字＋数字は切り離さない（数字だけが1行になるのを防ぐ・2026-10-02 Noto 置き換え時）
  const glue = (s: string) => s.replace(/ (?=\d[\d.]*(?:\s|$))/g, '\u00a0');
  const text = glue(rawText);
  const mark = rawMark ? glue(rawMark) : rawMark;
  const f = useCurrentFrame();
  const w = still ? 100 : interpolate(f - delay, [0, 14], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const render = (seg: string) => {
    if (!mark || !seg.includes(mark)) return seg;
    const [a, ...rest] = seg.split(mark);
    return (
      <>
        {a}
        <span
          style={{
            backgroundImage: `linear-gradient(transparent 58%, ${color} 58%)`,
            backgroundSize: `${w}% 100%`, backgroundRepeat: 'no-repeat',
          }}
        >
          {mark}
        </span>
        {rest.join(mark)}
      </>
    );
  };
  return (
    <>
      {text.split('\n').map((l, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {render(l)}
        </React.Fragment>
      ))}
    </>
  );
};

/* ---------- シール（番号・タグ） ---------- */

export const Sticker: React.FC<{ bg: string; color: string; size?: number; rotate?: number; children: React.ReactNode }> = ({
  bg, color, size = 40, rotate = -4, children,
}) => (
  <div
    style={{
      display: 'inline-block', background: bg, color, fontSize: size, fontWeight: 900,
      padding: `${size * 0.22}px ${size * 0.55}px`, borderRadius: size * 0.3,
      border: `4px solid ${C.navy}`, boxShadow: `6px 6px 0 ${C.navy}`,
      transform: `rotate(${rotate}deg)`, whiteSpace: 'nowrap', lineHeight: 1.2,
    }}
  >
    {children}
  </div>
);

/* ---------- 紙吹雪（なるほど の答え・保存のお願い） ---------- */

const CONFETTI = [C.yellow, C.orange, C.sky, C.navy, '#FFFFFF'];
export const Confetti: React.FC<{ delay?: number; count?: number; seed?: string }> = ({ delay = 0, count = 60, seed = 'c' }) => {
  const f = useCurrentFrame() - delay;
  const { width, height } = useVideoConfig();
  if (f < 0 || f > 70) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const a = r('a') * Math.PI * 2;
        const sp = 16 + r('s') * 24;
        const x = width / 2 + Math.cos(a) * sp * f;
        const y = height * 0.45 + (Math.sin(a) * sp - 20) * f + 0.9 * f * f;
        const w = 14 + r('w') * 14;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: x, top: y, width: w, height: w * 0.55,
              background: CONFETTI[i % CONFETTI.length], border: `2px solid ${C.navy}`,
              transform: `rotate(${f * (r('r') * 20 - 10)}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- 速報のテロップ帯（右から左へ流れる） ---------- */

export const Ticker: React.FC<{ text: string; top: number; still?: boolean }> = ({ text, top, still }) => {
  const frame = useCurrentFrame();
  const f = still ? 0 : frame;
  const unit = `${text}　●　`;
  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, top, height: 76, background: C.navy, color: C.yellow,
        overflow: 'hidden', display: 'flex', alignItems: 'center',
      }}
    >
      <div
        style={{
          whiteSpace: 'nowrap', fontSize: 36, fontWeight: 900, letterSpacing: 2,
          transform: `translateX(${-((f * 6) % 1400)}px)`,
        }}
      >
        {unit.repeat(8)}
      </div>
    </div>
  );
};

/* ---------- 保存アイコン（しおり） ---------- */

export const Bookmark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size * 1.25} viewBox="0 0 40 50">
    <path d="M4 3 h32 v44 l-16 -11 l-16 11 z" fill={color} stroke={C.navy} strokeWidth={3} strokeLinejoin="round" />
  </svg>
);
