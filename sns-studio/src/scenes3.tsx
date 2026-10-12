import React from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, GOTHIC, LATIN_BOLD, type Transition } from './brand';

// 2026-10-02 8パターン化で追加した場面と、場面の切り替え演出
// 作者の要望：「テンポ型ぐらいの速さ」「アニメーションを単純化しない」「伸びそうな、思わず見てしまう」
//  NgOk      … NG の例に赤い×のハンコ → カードが裏返って OK の例（やりがちNG→OK）
//  RankItem  … 「第3位」が上から落ちてくる。1位は光の筋と王冠と紙吹雪（ランキング）
//  Quiz      … A / B に分かれ、3秒のタイマー → 正解が大きくなり、不正解は崩れ落ちる（クイズ）
//  Reactions … 絵文字が下から飛び出して揺れながら上がる（POV・あるある）
//  Countdown … 3・2・1（なるほど の答えの前）
//  SceneFx   … 場面の頭の切り替え演出（型ごとに違う）

const sp = (f: number, fps: number, damping = 10, stiffness = 220, mass = 0.5) =>
  spring({ frame: f, fps, config: { damping, stiffness, mass } });

/* ---------- やりがちNG → OK ---------- */

const Side: React.FC<{ kind: 'ng' | 'ok'; text: string }> = ({ kind, text }) => (
  <AbsoluteFill
    style={{
      background: kind === 'ng' ? '#F6F1F1' : '#F0FBF6', borderRadius: 36, border: `5px solid ${C.navy}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: 40,
      backfaceVisibility: 'hidden', transform: kind === 'ok' ? 'rotateY(180deg)' : undefined,
    }}
  >
    <div style={{ background: kind === 'ng' ? C.red : C.green, color: C.white, fontFamily: LATIN_BOLD, fontSize: 52, padding: '6px 40px', borderRadius: 999, border: `4px solid ${C.navy}` }}>
      {kind === 'ng' ? 'NG' : 'OK'}
    </div>
    <div style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: 60, lineHeight: 1.35, color: C.navy, textAlign: 'center', whiteSpace: 'pre-line' }}>{text}</div>
  </AbsoluteFill>
);

export const NgOk: React.FC<{ ng: string; ok: string }> = ({ ng, ok }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = sp(f, fps, 12, 200);
  const stamp = sp(f - 16, fps, 9, 320, 0.4);
  const flip = interpolate(f, [40, 52], [0, 180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shake = f >= 18 && f < 26 ? Math.sin(f * 4) * (26 - f) * 2 : 0;
  const okStamp = sp(f - 56, fps, 8, 300, 0.4);
  return (
    <div style={{ width: 860, height: 600, perspective: 2000, transform: `translateX(${shake}px) scale(${0.6 + 0.4 * enter})`, opacity: enter }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateY(${flip}deg)`, boxShadow: `12px 12px 0 ${C.navy}`, borderRadius: 36 }}>
        <Side kind="ng" text={ng} />
        <Side kind="ok" text={ok} />
      </div>
      {flip < 90 && f >= 16 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 520, lineHeight: 1, color: C.red, fontWeight: 900, opacity: 0.9, transform: `scale(${3 - 2 * stamp}) rotate(${-12 * stamp}deg)`, textShadow: `8px 8px 0 ${C.navy}` }}>×</div>
        </div>
      )}
      {flip >= 180 && (
        <div style={{ position: 'absolute', right: -30, top: -60, transform: `scale(${okStamp}) rotate(${10 - 10 * okStamp}deg)` }}>
          <div style={{ width: 200, height: 200, borderRadius: '50%', border: `22px solid ${C.green}`, boxShadow: `0 0 0 5px ${C.navy}, inset 0 0 0 5px ${C.navy}` }} />
        </div>
      )}
    </div>
  );
};

/* ---------- ランキング ---------- */

export const RankItem: React.FC<{ rank: number; text: string; sub?: string }> = ({ rank, text, sub }) => {
  const f = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const drop = sp(f, fps, 9, 200, 0.7);
  const textIn = sp(f - 12, fps, 12, 220);
  const top = rank === 1;
  return (
    <div style={{ position: 'relative', width: 880, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {top && (
        <div style={{ position: 'absolute', left: '50%', top: 170, width: 0, height: 0 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', left: -40, top: -width, width: 80, height: width * 2, background: 'rgba(255,255,255,0.55)', transform: `rotate(${i * 30 + f * 1.5}deg)`, transformOrigin: '40px center', opacity: Math.min(1, f / 10) }} />
          ))}
        </div>
      )}
      {top && f > 6 && <div style={{ fontSize: 150, transform: `scale(${sp(f - 6, fps, 7, 260)}) rotate(${Math.sin(f / 6) * 6}deg)`, marginBottom: -20, position: 'relative' }}>👑</div>}
      <div style={{ position: 'relative', transform: `translateY(${(1 - drop) * -900}px)`, display: 'flex', alignItems: 'baseline', color: C.navy }}>
        <span style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: 90 }}>第</span>
        <span style={{ fontFamily: LATIN_BOLD, fontSize: top ? 330 : 280, lineHeight: 1, color: top ? C.orange : C.navy, WebkitTextStroke: top ? `8px ${C.navy}` : undefined }}>{rank}</span>
        <span style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: 90 }}>位</span>
      </div>
      <div style={{ position: 'relative', marginTop: 30, background: C.white, border: `5px solid ${C.navy}`, borderRadius: 28, boxShadow: `10px 10px 0 ${C.navy}`, padding: '26px 44px', transform: `translateX(${(1 - textIn) * 900}px) rotate(${-2 * textIn}deg)`, textAlign: 'center' }}>
        <div style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: 70, color: C.navy, whiteSpace: 'pre-line', lineHeight: 1.3 }}>{text}</div>
        {sub && <div style={{ fontFamily: GOTHIC, fontWeight: 800, fontSize: 38, color: C.muted, marginTop: 12 }}>{sub}</div>}
      </div>
    </div>
  );
};

/* ---------- クイズ（A / B） ---------- */

export const QUIZ_WAIT = 75; // 2.5秒のタイマー

export const Quiz: React.FC<{ a: string; b: string; answer: 'a' | 'b' }> = ({ a, b, answer }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inA = sp(f, fps, 12, 200);
  const inB = sp(f - 5, fps, 12, 200);
  const reveal = f >= QUIZ_WAIT;
  const r = sp(f - QUIZ_WAIT, fps, 8, 260);
  const left = Math.max(0, 1 - f / QUIZ_WAIT);
  const sec = Math.ceil(left * (QUIZ_WAIT / 30));
  const box = (k: 'a' | 'b', text: string, bg: string, enter: number) => {
    const win = k === answer;
    const fall = reveal && !win ? interpolate(f - QUIZ_WAIT, [0, 20], [0, 1], { extrapolateRight: 'clamp' }) : 0;
    return (
      <div
        style={{
          width: 410, height: 560, background: bg, borderRadius: 32, border: `5px solid ${C.navy}`, boxShadow: `10px 10px 0 ${C.navy}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 26, position: 'relative',
          transform: `translateY(${(1 - enter) * (k === 'a' ? -700 : 700) + fall * 900}px) rotate(${fall * (k === 'a' ? -25 : 25)}deg) scale(${reveal && win ? 1 + 0.1 * r : 1})`,
          opacity: 1 - fall * 0.8, zIndex: win ? 2 : 1,
        }}
      >
        <div style={{ fontFamily: LATIN_BOLD, fontSize: 150, lineHeight: 1, color: C.navy }}>{k.toUpperCase()}</div>
        <div style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: 46, lineHeight: 1.35, color: C.navy, textAlign: 'center', whiteSpace: 'pre-line' }}>{text}</div>
        {reveal && win && (
          <div style={{ position: 'absolute', bottom: -95, zIndex: 5, transform: `scale(${r}) rotate(-6deg)`, background: C.red, color: C.white, fontFamily: GOTHIC, fontWeight: 900, fontSize: 52, padding: '8px 30px', borderRadius: 18, border: `4px solid ${C.navy}` }}>
            正解！
          </div>
        )}
        {reveal && win && <div style={{ position: 'absolute', inset: -26, borderRadius: 44, border: `14px solid ${C.red}`, opacity: r }} />}
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
      <div style={{ display: 'flex', gap: 40, alignItems: 'center', position: 'relative' }}>
        {box('a', a, C.sky, inA)}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${reveal ? 0 : 1})`, zIndex: 3, width: 120, height: 120, borderRadius: '50%', background: C.white, border: `5px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: LATIN_BOLD, fontSize: 40, color: C.navy }}>VS</div>
        {box('b', b, C.yellow, inB)}
      </div>
      <div style={{ width: 860, height: 40, borderRadius: 20, border: `4px solid ${C.navy}`, background: C.white, overflow: 'hidden', opacity: reveal ? 0 : 1 }}>
        <div style={{ width: `${left * 100}%`, height: '100%', background: left < 0.34 ? C.red : C.orange }} />
      </div>
      {!reveal && (
        <div style={{ fontFamily: LATIN_BOLD, fontSize: 90, color: C.navy, marginTop: -20, transform: `scale(${1 + 0.15 * ((f % 30) < 6 ? 1 : 0)})` }}>{sec}</div>
      )}
    </div>
  );
};

/* ---------- 絵文字リアクション ---------- */

export const Reactions: React.FC<{ emojis: string[]; delay?: number; count?: number }> = ({ emojis, delay = 0, count = 10 }) => {
  const f = useCurrentFrame() - delay;
  const { width, height } = useVideoConfig();
  if (f < 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k: string) => random(`re-${i}-${k}`);
        const t = f - r('d') * 20;
        if (t < 0) return null;
        // 文字（左寄せ）にかぶらないよう、右の端から上がる
        const x = width * (0.78 + r('x') * 0.12) + Math.sin(t / 6 + i) * 20;
        const y = height * 0.8 - t * (14 + r('s') * 10);
        const s = interpolate(t, [0, 6], [0.2, 1], { extrapolateRight: 'clamp' }) * (0.8 + r('z') * 0.7);
        return <div key={i} style={{ position: 'absolute', left: x, top: y, fontSize: 96, transform: `scale(${s}) rotate(${Math.sin(t / 5 + i) * 15}deg)` }}>{emojis[i % emojis.length]}</div>;
      })}
    </AbsoluteFill>
  );
};

/* ---------- 3・2・1 ---------- */

export const COUNTDOWN = 45;
export const Countdown: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = 3 - Math.floor(f / 15);
  const local = f % 15;
  const p = sp(local, fps, 8, 300, 0.4);
  if (n < 1) return null;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 420, height: 420, borderRadius: '50%', background: [C.yellow, C.sky, C.orange][3 - n], border: `8px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${p})`, boxShadow: `14px 14px 0 ${C.navy}` }}>
        <div style={{ fontFamily: LATIN_BOLD, fontSize: 280, color: C.navy, lineHeight: 1 }}>{n}</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 白い光（答え・正解の瞬間） ---------- */

export const Flash: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > 8) return null;
  return <AbsoluteFill style={{ background: C.white, opacity: interpolate(f, [0, 8], [0.95, 0]) }} />;
};

/* ---------- 場面の頭の切り替え演出（型ごと） ---------- */

export const SceneFx: React.FC<{ kind: Transition; index: number; color: string }> = ({ kind, index, color }) => {
  const f = useCurrentFrame();
  if (index === 0 || kind === 'none' || f > 12) return null;
  const p = interpolate(f, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  if (kind === 'flash') return <AbsoluteFill style={{ background: C.white, opacity: 1 - p }} />;
  if (kind === 'iris') {
    return (
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ width: 2600, height: 2600, borderRadius: '50%', border: `${(1 - p) * 1300}px solid ${color}`, transform: `scale(${0.2 + 0.8 * p})` }} />
      </AbsoluteFill>
    );
  }
  if (kind === 'split') {
    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', background: C.sky, transform: `translateX(${-p * 100}%)` }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', background: C.yellow, transform: `translateX(${p * 100}%)` }} />
      </AbsoluteFill>
    );
  }
  if (kind === 'stamp') {
    return <AbsoluteFill style={{ background: color, opacity: (1 - p) * 0.9, transform: `scale(${1 + p * 0.4})` }} />;
  }
  if (kind === 'drop') {
    return <AbsoluteFill style={{ background: C.navy, transform: `translateY(${p * 100}%)` }} />;
  }
  if (kind === 'slideup') {
    return <AbsoluteFill style={{ background: color, transform: `translateY(${-p * 100}%)` }} />;
  }
  // wipe：紺の斜めの帯が横切る
  const dir = index % 2 === 0 ? 1 : -1;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -400, bottom: -400, width: 2600, left: -1300, background: C.navy, transform: `translateX(${dir * (-1 + 2 * p) * 1900}px) rotate(14deg)` }} />
    </AbsoluteFill>
  );
};
