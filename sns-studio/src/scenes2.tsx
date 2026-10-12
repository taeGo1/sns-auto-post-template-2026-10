import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, GOTHIC, LATIN_BOLD } from './brand';

// 2026-10-02 追加の場面（作者の指摘「ずっと左寄せの数字と文字」「出方が単純」）
// どれも「真ん中・大きく・動きが違う」ように作る
//  Punch     … キーワードが1語ずつ、中央に傾きながら飛び込む（words）
//  BigNumber … 中央の数字が数え上がり、円が描かれる（number）
//  Compare   … 画面が上下に分かれ、BEFORE のあと AFTER が仕切りを押しのけて出る（before/after）
//  CardStack … カードが右から1枚ずつ飛んできて重なる（cards）
//  Wipe      … 場面の頭で、色の面が斜めにシュッと横切る（テンポ型の切り替え）

const PALETTE = [C.yellow, C.sky, C.orange, C.cream, C.white];

export const Punch: React.FC<{ words: string[]; colors?: string[] }> = ({ words, colors = [C.navy, C.orange, C.navy, C.navy] }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
      {words.map((w, i) => {
        const at = 4 + i * 9;
        const p = spring({ frame: f - at, fps, config: { damping: 9, mass: 0.5, stiffness: 220 } });
        const rot = (i % 2 === 0 ? -6 : 5) * (1 - p) + (i % 2 === 0 ? -2 : 2);
        const size = w.length <= 4 ? 170 : w.length <= 6 ? 140 : 108;
        return (
          <div
            key={i}
            style={{
              fontFamily: GOTHIC, fontWeight: 900, fontSize: size, lineHeight: 1.12, color: colors[i % colors.length],
              transform: `scale(${2.2 - 1.2 * p}) rotate(${rot}deg)`, opacity: Math.min(1, p * 3),
              textShadow: `6px 6px 0 rgba(255,255,255,0.9)`, whiteSpace: 'nowrap',
            }}
          >
            {w}
          </div>
        );
      })}
    </div>
  );
};

export const BigNumber: React.FC<{ value: string; label?: string; ink: string }> = ({ value, label, ink }) => {
  const f = useCurrentFrame();
  const m = value.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
  const target = m ? parseFloat(m[2]) : 0;
  const prog = interpolate(f, [4, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ease = 1 - Math.pow(1 - prog, 3);
  const shown = m ? `${m[1]}${Number.isInteger(target) ? Math.round(target * ease) : (target * ease).toFixed(1)}${m[3]}` : value;
  const R = 330;
  const L = 2 * Math.PI * R;
  const pop = prog >= 1 ? 1 + 0.06 * Math.max(0, 1 - (f - 34) / 8) : 1;
  return (
    <div style={{ position: 'relative', width: 760, height: 760, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={760} height={760} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={380} cy={380} r={R} fill={C.white} stroke="rgba(21,32,67,0.12)" strokeWidth={34} />
        <circle cx={380} cy={380} r={R} fill="none" stroke={C.yellow} strokeWidth={34} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - ease)} />
      </svg>
      <div style={{ position: 'relative', textAlign: 'center', transform: `scale(${pop})` }}>
        <div style={{ fontFamily: LATIN_BOLD, fontSize: shown.length > 4 ? 170 : 230, lineHeight: 1, color: ink }}>{shown}</div>
        {label && <div style={{ marginTop: 18, fontFamily: GOTHIC, fontWeight: 900, fontSize: 48, color: ink }}>{label}</div>}
      </div>
    </div>
  );
};

export const Compare: React.FC<{ before: string; after: string; beforeLabel?: string; afterLabel?: string }> = ({
  before, after, beforeLabel = 'BEFORE', afterLabel = 'AFTER',
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: f - 4, fps, config: { damping: 14 } });
  const b = spring({ frame: f - 34, fps, config: { damping: 11, stiffness: 150 } });
  const half = (label: string, text: string, bg: string, labelBg: string, p: number, dim: boolean) => (
    <div
      style={{
        flex: 1, background: bg, borderRadius: 30, border: `5px solid ${C.navy}`, padding: '36px 40px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22,
        transform: `translateX(${(1 - p) * (dim ? -900 : 900)}px)`, opacity: dim && b > 0.5 ? 0.55 : 1,
        boxShadow: `10px 10px 0 ${C.navy}`,
      }}
    >
      <div style={{ alignSelf: 'flex-start', background: labelBg, color: C.white, fontFamily: LATIN_BOLD, fontSize: 36, padding: '6px 22px', borderRadius: 999, border: `3px solid ${C.navy}` }}>{label}</div>
      <div style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: 58, lineHeight: 1.35, color: C.navy, whiteSpace: 'pre-line' }}>{text}</div>
    </div>
  );
  return (
    <div style={{ width: 880, height: 900, display: 'flex', flexDirection: 'column', gap: 34, position: 'relative' }}>
      {half(beforeLabel, before, '#ECE8DE', C.muted, a, true)}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${b}) rotate(${(1 - b) * 180}deg)`, zIndex: 2, width: 110, height: 110, borderRadius: '50%', background: C.orange, border: `5px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, color: C.white, fontWeight: 900 }}>↓</div>
      {half(afterLabel, after, C.yellow, C.navy, b, false)}
    </div>
  );
};

export const CardStack: React.FC<{ cards: string[]; title?: string }> = ({ cards }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gap = 14;
  return (
    <div style={{ position: 'relative', width: 820, height: 760 }}>
      {cards.map((c, i) => {
        const at = 4 + i * gap;
        const p = spring({ frame: f - at, fps, config: { damping: 12, mass: 0.7, stiffness: 140 } });
        const newer = cards.filter((_, k) => k > i && f >= 4 + k * gap).length; // 後から来たカードの枚数
        const settleRot = [-6, 4, -3, 5, -2][i % 5];
        const y = newer * -26;
        const s = 1 - newer * 0.05;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: 0, right: 0, top: 120,
              height: 460, borderRadius: 36, border: `5px solid ${C.navy}`, boxShadow: `12px 12px 0 ${C.navy}`,
              background: PALETTE[i % PALETTE.length], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
              transform: `translateX(${(1 - p) * 1100}px) translateY(${y}px) rotate(${settleRot * p + (1 - p) * 25}deg) scale(${s})`,
              zIndex: i, opacity: newer >= 3 ? 0 : 1,
            }}
          >
            <div style={{ fontFamily: LATIN_BOLD, fontSize: 90, color: C.navy, lineHeight: 1 }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: c.length > 8 ? 64 : 80, color: C.navy, textAlign: 'center', padding: '0 40px', lineHeight: 1.3 }}>{c}</div>
          </div>
        );
      })}
    </div>
  );
};

export const Wipe: React.FC<{ color: string; index: number }> = ({ color, index }) => {
  const f = useCurrentFrame();
  // 0〜9フレームで色の面が斜めに横切り、新しい背景が残る
  const p = interpolate(f, [0, 9], [0, 1], { extrapolateRight: 'clamp' });
  const dir = index % 2 === 0 ? 1 : -1;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: color }} />
      {p < 1 && (
        <div
          style={{
            position: 'absolute', top: -400, bottom: -400, width: 2600, left: -1300,
            background: C.navy, transform: `translateX(${dir * (-1 + 2 * p) * 1900}px) rotate(14deg)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export const KINETIC_BG = [C.yellow, C.sky, C.white, C.orange, C.cream];
