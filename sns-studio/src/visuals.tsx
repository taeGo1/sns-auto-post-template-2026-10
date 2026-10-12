import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, GOTHIC, LATIN_BOLD } from './brand';

// リールの「イメージ図」部品（作者の要望 2026-10-02：「Claudeが出てこない」「画像やイメージできるものが入っていない」）
// ・ChatMock  … チャット画面のイメージ（右＝自分、左＝Claude）。Claude の公式ロゴは描かない（商標のため文字で表す）
// ・BriefCard … 1枚の紙（ブリーフ）に項目のチェックが入っていく
// ・FlowDevices … スマホ → パソコン → 動き → 公開 の流れ
// ・ImageCard … 用意した画像（スクショ・写真・Lovart画像など）を枠付きで見せる（public/ に置いたファイル）

const useSpring = (delay: number, damping = 12) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping, mass: 0.6, stiffness: 160 } });
};

const Window: React.FC<{ title: string; children: React.ReactNode; width?: number }> = ({ title, children, width = 860 }) => (
  <div style={{ width, background: C.white, borderRadius: 32, border: `4px solid ${C.navy}`, boxShadow: `10px 10px 0 ${C.navy}`, overflow: 'hidden' }}>
    <div style={{ height: 70, background: C.navy, display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px' }}>
      {['#FF6B5E', C.yellow, '#3DDC84'].map((c) => (
        <div key={c} style={{ width: 20, height: 20, borderRadius: '50%', background: c }} />
      ))}
      <div style={{ marginLeft: 18, color: C.white, fontSize: 30, fontWeight: 800, fontFamily: GOTHIC }}>{title}</div>
    </div>
    <div style={{ padding: 34 }}>{children}</div>
  </div>
);

// Claude を表す丸いマーク（公式ロゴではない。オレンジの丸に C）
const ClaudeBadge: React.FC = () => (
  <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.orange, border: `3px solid ${C.navy}`, color: C.white, fontFamily: LATIN_BOLD, fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>C</div>
);

const Bubble: React.FC<{ side: 'me' | 'ai'; delay: number; children: React.ReactNode }> = ({ side, delay, children }) => {
  const p = useSpring(delay);
  return (
    <div style={{ display: 'flex', justifyContent: side === 'me' ? 'flex-end' : 'flex-start', gap: 16, marginBottom: 24, opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 30}px)` }}>
      {side === 'ai' && <ClaudeBadge />}
      <div
        style={{
          maxWidth: 600, padding: '22px 28px', borderRadius: 26, whiteSpace: 'pre-line', fontSize: 36, fontWeight: 700, lineHeight: 1.5, fontFamily: GOTHIC,
          background: side === 'me' ? C.yellow : C.cream, color: C.navy, border: `3px solid ${C.navy}`,
          borderBottomRightRadius: side === 'me' ? 6 : 26, borderBottomLeftRadius: side === 'ai' ? 6 : 26,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const Typing: React.FC<{ delay: number; until: number }> = ({ delay, until }) => {
  const f = useCurrentFrame();
  if (f < delay || f >= until) return null;
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
      <ClaudeBadge />
      <div style={{ padding: '26px 30px', borderRadius: 26, background: C.cream, border: `3px solid ${C.navy}`, display: 'flex', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: C.navy, opacity: 0.3 + 0.7 * Math.abs(Math.sin((f - delay) / 5 + i)) }} />
        ))}
      </div>
    </div>
  );
};

// aiMarks：Claude の返事の中でマーカーを引く言葉（例：勝手に決まったターゲット）
// note：返事のあとに出る小さな札（例：「誰も決めていないのに…」）
export type ChatSpec = { me: string; attach?: string; ai: string; aiMarks?: string[]; note?: string };

// 返事の中の言葉に、時間差で黄色いマーカーを引く
const MarkedReply: React.FC<{ text: string; marks?: string[]; delay: number }> = ({ text, marks, delay }) => {
  const f = useCurrentFrame();
  if (!marks || marks.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest.length) {
    const hits = marks.map((m) => ({ m, i: rest.indexOf(m) })).filter((h) => h.i >= 0).sort((a, b) => a.i - b.i);
    if (!hits.length) { parts.push(rest); break; }
    const { m, i } = hits[0];
    if (i > 0) parts.push(rest.slice(0, i));
    const w = interpolate(f - delay - k * 8, [0, 10], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    parts.push(
      <span key={k} style={{ backgroundImage: `linear-gradient(transparent 55%, ${C.yellow} 55%)`, backgroundSize: `${w}% 100%`, backgroundRepeat: 'no-repeat' }}>{m}</span>,
    );
    rest = rest.slice(i + m.length);
    k++;
  }
  return <>{parts}</>;
};

const Note: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 8, mass: 0.6, stiffness: 180 } });
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
      <div
        style={{
          transform: `scale(${p}) rotate(${-4 * p}deg)`, opacity: Math.min(1, p * 2), transformOrigin: 'right center',
          background: C.orange, color: C.white, fontFamily: GOTHIC, fontWeight: 900, fontSize: 34,
          padding: '10px 24px', borderRadius: 14, border: `4px solid ${C.navy}`, boxShadow: `5px 5px 0 ${C.navy}`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const ChatMock: React.FC<{ chat: ChatSpec; delay?: number }> = ({ chat, delay = 0 }) => {
  const meAt = delay + 4;
  const aiAt = delay + 34;
  const p = useSpring(delay, 14);
  return (
    <div style={{ transform: `scale(${0.85 + 0.15 * p})`, opacity: p, transformOrigin: 'center top' }}>
      <Window title="Claude（イメージ）">
        <Bubble side="me" delay={meAt}>
          {chat.attach && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.white, border: `3px solid ${C.navy}`, borderRadius: 14, padding: '10px 16px', marginBottom: 12, fontSize: 30 }}>
              <span>📄</span><span>{chat.attach}</span>
            </div>
          )}
          {chat.me}
        </Bubble>
        <Typing delay={meAt + 10} until={aiAt} />
        <Bubble side="ai" delay={aiAt}><MarkedReply text={chat.ai} marks={chat.aiMarks} delay={aiAt + 14} /></Bubble>
        {chat.note && <Note text={chat.note} delay={aiAt + 34} />}
      </Window>
    </div>
  );
};

export const BriefCard: React.FC<{ title: string; items: string[]; delay?: number }> = ({ title, items, delay = 0 }) => {
  const f = useCurrentFrame();
  const p = useSpring(delay, 10);
  return (
    <div style={{ transform: `rotate(${-2 * p}deg) scale(${0.8 + 0.2 * p})`, opacity: p }}>
      <div style={{ width: 820, background: C.white, borderRadius: 18, border: `4px solid ${C.navy}`, boxShadow: `12px 12px 0 ${C.navy}`, padding: '40px 46px', position: 'relative' }}>
        {/* クリップ */}
        <div style={{ position: 'absolute', top: -34, left: '50%', transform: 'translateX(-50%)', width: 180, height: 56, background: C.yellow, border: `4px solid ${C.navy}`, borderRadius: 14 }} />
        <div style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: 52, color: C.navy, marginBottom: 26, borderBottom: `4px solid ${C.navy}`, paddingBottom: 14 }}>
          📝 {title}
        </div>
        {items.map((it, i) => {
          const at = delay + 14 + i * 12;
          const on = f >= at;
          const q = interpolate(f - at, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '16px 0', borderBottom: `2px dashed rgba(21,32,67,0.25)` }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, border: `4px solid ${C.navy}`, background: on ? C.yellow : C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 900, color: C.navy }}>
                <span style={{ transform: `scale(${q})` }}>✓</span>
              </div>
              <div style={{ fontFamily: GOTHIC, fontWeight: 800, fontSize: 42, color: C.navy }}>{it}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Phone: React.FC<{ active: boolean }> = ({ active }) => (
  <div style={{ width: 120, height: 210, borderRadius: 24, border: `5px solid ${C.navy}`, background: active ? C.yellow : C.white, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
    {[60, 90, 70, 90].map((w, i) => <div key={i} style={{ width: `${w}%`, height: 14, borderRadius: 7, background: C.navy, opacity: 0.6 }} />)}
  </div>
);
const Pc: React.FC<{ active: boolean }> = ({ active }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div style={{ width: 230, height: 150, borderRadius: 14, border: `5px solid ${C.navy}`, background: active ? C.yellow : C.white, padding: 14, display: 'flex', gap: 10 }}>
      <div style={{ width: '40%', background: C.navy, opacity: 0.5, borderRadius: 6 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[90, 70, 80].map((w, i) => <div key={i} style={{ width: `${w}%`, height: 14, borderRadius: 7, background: C.navy, opacity: 0.6 }} />)}
      </div>
    </div>
    <div style={{ width: 90, height: 26, background: C.navy }} />
  </div>
);

export const FlowDevices: React.FC<{ steps: string[]; delay?: number }> = ({ steps, delay = 0 }) => {
  const f = useCurrentFrame();
  const icon = (i: number, active: boolean) => {
    const label = steps[i] ?? '';
    if (label.includes('スマホ')) return <Phone active={active} />;
    if (label.includes('PC') || label.includes('パソコン')) return <Pc active={active} />;
    const emoji = label.includes('動') || label.includes('アニメ') ? '✨' : label.includes('UP') || label.includes('公開') ? '🚀' : label.includes('修正') ? '✏️' : '📄';
    return (
      <div style={{ width: 150, height: 150, borderRadius: '50%', border: `5px solid ${C.navy}`, background: active ? C.yellow : C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72 }}>{emoji}</div>
    );
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px 30px', width: 860 }}>
      {steps.map((s, i) => {
        const at = delay + 6 + i * 16;
        const p = spring({ frame: f - at, fps: 30, config: { damping: 9, mass: 0.6, stiffness: 170 } });
        const active = f >= at + 6;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, transform: `scale(${p})`, opacity: Math.min(1, p * 2) }}>
            <div style={{ height: 230, display: 'flex', alignItems: 'center' }}>{icon(i, active)}</div>
            <div style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: 38, color: C.navy, background: C.white, border: `3px solid ${C.navy}`, borderRadius: 999, padding: '8px 26px' }}>
              {i + 1}. {s}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ImageCard: React.FC<{ src: string; caption?: string; delay?: number }> = ({ src, caption, delay = 0 }) => {
  const f = useCurrentFrame();
  const p = useSpring(delay, 12);
  const zoom = 1 + interpolate(f, [0, 120], [0, 0.06], { extrapolateRight: 'clamp' });
  return (
    <div style={{ opacity: p, transform: `scale(${0.85 + 0.15 * p}) rotate(${-1.5 * p}deg)` }}>
      <div style={{ width: 860, borderRadius: 26, border: `5px solid ${C.navy}`, boxShadow: `12px 12px 0 ${C.navy}`, overflow: 'hidden', background: C.white }}>
        <Img src={staticFile(src)} style={{ width: '100%', display: 'block', transform: `scale(${zoom})` }} />
      </div>
      {caption && <div style={{ marginTop: 22, fontFamily: GOTHIC, fontSize: 30, fontWeight: 700, color: C.muted }}>{caption}</div>}
    </div>
  );
};
