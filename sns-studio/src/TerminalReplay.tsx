// 作業動画（2026-10-03・作者「説明動画ではなく作業動画」「今のは作られた感が大きい」）
// Claude Code に本当に作業をさせた記録（tools/claude_log_to_replay.py が作る props）を、
// ターミナルの画面として再生する。作業の中身は本物。画面の見た目だけを再現（公式ロゴは描かない）。
// 作者の指定（2026-10-03）：上の見出し・下の「実際の作業記録を再生」は入れない／横長（X・Facebook・Threads）が本命、
// 同じものを縦長（リール・TikTok）にも／名前は SNS ごとに違う（handle で渡す）
// 2026-10-05（作者「毎回同じ流れは意味がない。機能そのものを動かして、その動きを見せ、説明する文字を入れる」）：
//   台本は tools/replay_timeline.py が作る timelines[layout] をそのまま描く（ここでは計算しない）。
//   記録に出てくるものを全部描く：担当（サブエージェント）ごとの小さな画面が同時に進む／直しは赤と緑／
//   2通り比べた記録は2つの画面が並ぶ／説明文字（notes）は白い札で場面の頭に出る
import React from 'react';
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, GOTHIC } from './brand';

export const MONO = '"JetBrains Mono", "Noto Sans JP", monospace';

export type ReplayBlock = {
  type: 'text' | 'tool';
  text?: string;
  label?: string;
  name?: string;
  lines?: string[];
  added?: string[];
  removed?: string[];
  summary?: string;
  ok?: boolean;
  pass?: number;
  lane?: number;
  image?: string;
};

export type ReplayLane = { name: string; blocks: ReplayBlock[]; summary?: string; ok?: boolean };

// 台本（tools/replay_timeline.py が作る）
export type TRow = { t: string; c: string; bg?: string; b?: boolean; s: number; n: number };
export type TLane = { name: string; rows: TRow[]; done: number; summary?: string };
export type TPanel = { start: number; end: number; lanes: TLane[] };
export type TCallout = { at: number; text: string; color: string; kind: 'auto' | 'note'; pane?: number };
export type TPane = { rows: TRow[]; lanePanels: TPanel[]; callouts: TCallout[]; workEnd: number; resultStart: number; total: number };
export type Timeline = { panes: TPane[]; callouts: TCallout[]; total: number };

export type ReplayRecord = {
  title: string;
  prompt: string;
  blocks: ReplayBlock[];
  lanes?: ReplayLane[];
  realSeconds: number;
  outputTokens: number;
  resultFile?: string;
  resultPreview?: string[];
};

export type ReplayProps = ReplayRecord & {
  hook?: string;          // 使わない（作者の指定で見出しは出さない）。記録用に残す
  handle?: string;        // 右下の名前（settings.yml の account）
  layout?: 'wide' | 'tall';
  bgm?: string;           // public/ からの相対パス。tools/make_work_bgm.py が横長・縦長それぞれに作る
  feature?: string;       // 使った機能（正直に。例「サブエージェント（担当分け）」）
  notes?: { block: number; text: string }[];
  compare?: { label_a: string; label_b: string; what?: string; verdict?: string; b: ReplayRecord };
  timelines?: { wide: Timeline; tall: Timeline };
};

export const REPLAY_FPS = 30;

// 画面の寸法（tools/replay_timeline.py の LAYOUTS と「1行の字数・見える行数」を合わせる）
type Box = { left: number; top: number; width: number; height: number };
type Geo = { font: number; lineH: number; rows: number; box: Box; callout: React.CSSProperties; note: React.CSSProperties; card: { left: number; top: number; width: number }; cardMax: number; lanesRow: boolean };

const geometry = (layout: 'wide' | 'tall', panes: number): Geo[] => {
  if (layout === 'wide') {
    if (panes === 1) {
      return [{ font: 28, lineH: 40, rows: 18, box: { left: 90, top: 70, width: 1740, height: 900 }, callout: { right: 140, bottom: 150 }, note: { left: 120, bottom: 150 }, card: { left: 420, top: 120, width: 1080 }, cardMax: 14, lanesRow: true }];
    }
    // 2つの画面を比べるとき：担当の小さな画面は横に並べると狭すぎるので縦に積む
    return [0, 1].map((i) => ({ font: 22, lineH: 32, rows: 18, box: { left: 60 + i * 930, top: 110, width: 870, height: 860 }, callout: { right: 1920 - (60 + i * 930 + 870) + 30, bottom: 130 }, note: { left: 60 + i * 930 + 30, bottom: 130 }, card: { left: 60 + i * 930 + 40, top: 160, width: 790 }, cardMax: 12, lanesRow: false }));
  }
  if (panes === 1) {
    // 縦長はリールと TikTok の両方で使うので、TikTok の右のボタン列（右170）と下の文字（下460）、上のタブ（上200）を避ける
    return [{ font: 26, lineH: 39, rows: 25, box: { left: 50, top: 240, width: 860, height: 1220 }, callout: { right: 190, bottom: 540 }, note: { left: 70, bottom: 540 }, card: { left: 60, top: 380, width: 840 }, cardMax: 18, lanesRow: false }];
  }
  return [0, 1].map((i) => ({ font: 24, lineH: 34, rows: 10, box: { left: 50, top: 240 + i * 620, width: 860, height: 590 }, callout: { right: 190, bottom: 1920 - (240 + i * 620 + 590) + 20 }, note: { left: 70, bottom: 1920 - (240 + i * 620 + 590) + 20 }, card: { left: 70, top: 240 + i * 620 + 40, width: 820 }, cardMax: 8, lanesRow: false }));
};

const T = { bg: '#16181d', text: '#e6e6e6', dim: '#8b8f98', green: '#5fd38d', red: '#ff6b6b', orange: '#e8875b', addBg: 'rgba(95,211,141,0.14)', delBg: 'rgba(255,107,107,0.16)', userBg: '#2a2e36' };
const COLOR: Record<string, string> = { user: '#ffffff', text: T.text, dim: T.dim, green: T.green, red: T.red, yellow: C.yellow };
const BG: Record<string, string> = { userBg: T.userBg, addBg: T.addBg, delBg: T.delBg };

// ---- 古い記録（timelines 無し）のための簡単な台本（以前の計算と同じ。tools/replay_timeline.py と同じ値）----
const width = (s: string) => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
const wrap = (s: string, cols: number): string[] => {
  const out: string[] = [];
  let cur = '';
  for (const ch of [...s]) {
    if (width(cur + ch) > cols) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out;
};
const cut = (s: string, cols: number) => (width(s) <= cols ? s : wrap(s, cols - 1)[0] + '…');

const legacyTimeline = (p: ReplayProps): Timeline => {
  const cols = p.layout === 'tall' ? 52 : 104;
  const rows: TRow[] = [];
  const callouts: TCallout[] = [];
  let f = 18;
  const add = (t: string, c: string, n: number, opt: Partial<TRow> = {}) => rows.push({ t, c, s: f, n, ...opt });
  wrap('> ' + p.prompt, cols - 2).forEach((l) => { add(l, 'user', 14, { bg: 'userBg', b: true }); f += 14; });
  f += 12;
  for (const b of p.blocks) {
    if (b.type === 'text' && b.text) {
      wrap('● ' + b.text.replace(/`/g, ''), cols).forEach((l) => { add(l, 'text', 8); f += 6; });
      f += 6;
      continue;
    }
    add('● ' + (b.label ?? ''), b.ok === false ? 'red' : 'green', 6, { b: true }); f += 9;
    (b.added ?? []).forEach((l, i) => { add(cut(`  ${String(i + 1).padStart(2)} + ${l}`, cols), 'green', 2, { bg: 'addBg' }); f += 3; });
    if (b.summary) { add('  ⎿ ' + b.summary, 'dim', 4); f += 5; }
    (b.lines ?? []).forEach((l) => { add(cut('  ⎿ ' + l, cols), b.ok === false ? 'red' : l.endsWith(' ok') || l.trim() === 'OK' ? 'green' : 'dim', 3); f += 4; });
    if (b.ok === false) { callouts.push({ at: f, text: 'エラー → 自分で別の方法に切り替え', color: 'red', kind: 'auto', pane: 0 }); f += 34; }
    if (b.pass) { callouts.push({ at: f, text: `テスト ${b.pass}件 すべて合格`, color: 'green', kind: 'auto', pane: 0 }); f += 34; }
    f += 8;
  }
  const workEnd = f;
  callouts.push({ at: f, text: p.resultFile ? `${p.resultFile} が完成` : '完成', color: 'yellow', kind: 'auto', pane: 0 });
  const resultStart = f + 18;
  const total = resultStart + (p.resultPreview?.length ? 120 : 30);
  return { panes: [{ rows, lanePanels: [], callouts, workEnd, resultStart, total }], callouts, total };
};

export const timelineOf = (p: ReplayProps): Timeline => p.timelines?.[p.layout ?? 'wide'] ?? legacyTimeline(p);
export const replayFrames = (p: ReplayProps) => timelineOf(p).total;

// ---- 部品 ----
const Spinner: React.FC<{ f: number; realSeconds: number; outputTokens: number; workEnd: number; font: number; lineH: number }> = ({ f, realSeconds, outputTokens, workEnd, font, lineH }) => {
  const done = f >= workEnd;
  const ratio = Math.min(1, Math.max(0, (f - 18) / Math.max(1, workEnd - 18)));
  const sec = Math.round(realSeconds * ratio);
  const tok = ((outputTokens * ratio) / 1000).toFixed(1);
  const glyphs = ['✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳'];
  const time = `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
  return (
    <div style={{ fontFamily: MONO, fontSize: font - 2, color: done ? T.green : T.orange, height: lineH, display: 'flex', alignItems: 'center' }}>
      {done ? `✓ 完了（${time} · ↓ ${tok}k tokens）` : `${glyphs[Math.floor(f / 4) % glyphs.length]} 作業中…（${time} · ↓ ${tok}k tokens）`}
    </div>
  );
};

// 1行ずつ打ち出す行の列
const Rows: React.FC<{ rows: TRow[]; f: number; font: number; lineH: number; visibleRows: number }> = ({ rows, f, font, lineH, visibleRows }) => {
  const visible = rows.filter((r) => f >= r.s);
  const scrollY = Math.max(0, visible.length - visibleRows) * lineH;
  return (
    <div style={{ transform: `translateY(${-scrollY}px)` }}>
      {visible.map((r, i) => {
        const n = Math.max(0, Math.min(r.t.length, Math.floor(((f - r.s) / Math.max(1, r.n)) * r.t.length)));
        return (
          <div key={i} style={{
            height: lineH, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: font, color: COLOR[r.c] ?? T.text,
            background: r.bg ? BG[r.bg] : undefined, fontWeight: r.b ? 700 : 400, whiteSpace: 'pre', paddingLeft: r.bg ? 10 : 0,
          }}>
            {r.t.slice(0, n)}
          </div>
        );
      })}
    </div>
  );
};

// 担当（サブエージェント）ごとの小さな画面。横長は横に並ぶ、縦長は縦に並ぶ。同時に進む
const LanePanels: React.FC<{ panel: TPanel; f: number; layout: 'wide' | 'tall'; g: Geo }> = ({ panel, f, layout, g }) => {
  const { fps } = useVideoConfig();
  const hold = 36;
  if (f < panel.start - 6 || f > panel.end + hold) return null;
  const inS = spring({ frame: f - panel.start + 6, fps, config: { damping: 14 } });
  const out = interpolate(f - panel.end, [hold - 12, hold], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const n = panel.lanes.length;
  const pad = 16;
  const areaW = g.box.width - 56, areaH = g.box.height - 140;
  const horizontal = g.lanesRow;
  const w = horizontal ? (areaW - pad * (n - 1)) / n : areaW;
  const h = horizontal ? areaH : (areaH - pad * (n - 1)) / n;
  const font = horizontal ? Math.min(20, g.font - 6) : Math.min(22, g.font - 4);
  const lineH = font + 10;
  const visibleRows = Math.max(3, Math.floor((h - 50) / lineH));
  // 本流の行の上にかぶせる（背景を塗って、下の行が透けないように）
  return (
    <div style={{ position: 'absolute', left: 28, top: 70, width: areaW, height: areaH, background: T.bg, display: 'flex', flexDirection: horizontal ? 'row' : 'column', gap: pad, opacity: out, transform: `scale(${0.96 + 0.04 * inS})`, transformOrigin: '50% 0%' }}>
      {panel.lanes.map((ln, i) => {
        const done = f >= ln.done;
        return (
          <div key={i} style={{ width: w, height: h, background: '#0f1115', border: `1px solid ${done ? T.green : '#3a3f4b'}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
            <div style={{ height: 40, background: done ? 'rgba(95,211,141,0.18)' : '#22252c', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, fontFamily: GOTHIC, fontWeight: 800, fontSize: font, color: done ? T.green : '#cfd5e2' }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: done ? T.green : T.orange }} />
              {ln.name}
              <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: font - 4, color: T.dim, fontWeight: 400 }}>{done ? '✓' : '作業中…'}</span>
            </div>
            <div style={{ padding: '6px 12px', height: h - 52, overflow: 'hidden' }}>
              <Rows rows={ln.rows} f={f} font={font} lineH={lineH} visibleRows={visibleRows} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ResultCard: React.FC<{ rec: ReplayRecord; start: number; g: Geo }> = ({ rec, start, g }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - start, fps, config: { damping: 16 } });
  if (f < start) return null;
  const lines = (rec.resultPreview ?? []).filter((l) => l.trim() && !/^\|?\s*-{3}/.test(l) && l.trim() !== '---');
  const small = g.cardMax <= 12;
  return (
    <div style={{
      position: 'absolute', left: g.card.left, width: g.card.width, top: g.card.top, background: '#ffffff', borderRadius: 22, padding: small ? '22px 28px' : '30px 40px',
      boxShadow: '0 30px 80px rgba(0,0,0,0.45)', transform: `translateY(${(1 - s) * 1100}px)`, color: C.navy,
    }}>
      <div style={{ fontFamily: MONO, fontSize: small ? 18 : 22, color: C.muted, marginBottom: 12 }}>{rec.resultFile}</div>
      {lines.slice(0, g.cardMax).map((l, i) => {
        const isHead = l.startsWith('#');
        const isRow = l.startsWith('|');
        const cells = isRow ? l.split('|').slice(1, -1).map((c) => c.trim()) : [];
        const appear = interpolate(f - start - 10 - i * 3, [0, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const fs = small ? 19 : 23;
        return (
          <div key={i} style={{ opacity: appear }}>
            {isHead ? (
              <div style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: (l.startsWith('## ') ? 30 : 40) * (small ? 0.8 : 1), margin: '12px 0 6px' }}>{l.replace(/^#+\s*/, '')}</div>
            ) : isRow ? (
              <div style={{ display: 'flex', fontFamily: GOTHIC, fontSize: fs, borderBottom: '1px solid #e3e6ee', padding: '5px 0', fontWeight: 500 }}>
                {cells.map((c, j) => (
                  <div key={j} style={{ flex: 1, textAlign: j === 0 ? 'left' : 'right', color: c.startsWith('-') && c.endsWith('%') ? C.red : C.navy }}>{c}</div>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: GOTHIC, fontSize: fs, color: C.muted }}>{l}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// 1つの画面（ターミナル）
const TerminalPane: React.FC<{ rec: ReplayRecord; pane: TPane; g: Geo; layout: 'wide' | 'tall'; label?: string; handle?: string; showHandle: boolean }> = ({ rec, pane, g, layout, label, handle, showHandle }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 18 } });
  // 注釈が出ている間だけ、画面の下のほう（いま進んでいる行）に寄る（担当の画面が出ている間は寄らない）
  const laneActive = pane.lanePanels.some((lp) => f >= lp.start - 6 && f <= lp.end + 36);
  const focus = laneActive ? 0 : Math.max(0, ...pane.callouts.filter((c) => c.kind === 'auto').map((c) =>
    interpolate(f - c.at, [0, 8, 34, 44], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  const zoom = 1 + (layout === 'wide' ? 0.07 : 0.1) * focus;
  return (
    <div style={{
      position: 'absolute', ...g.box, background: T.bg, borderRadius: 20,
      boxShadow: '0 30px 90px rgba(0,0,0,0.55)', border: '1px solid #2d313a', overflow: 'hidden',
      transform: `translateY(${(1 - enter) * 100}px) scale(${zoom})`, transformOrigin: '50% 85%',
    }}>
      <div style={{ height: 52, background: '#22252c', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 12 }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 15, height: 15, borderRadius: 8, background: c }} />)}
        {label && <div style={{ fontFamily: GOTHIC, fontWeight: 900, fontSize: 22, color: C.yellow, background: 'rgba(255,213,0,0.14)', padding: '2px 12px', borderRadius: 8 }}>{label}</div>}
        <div style={{ flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 21, color: T.dim }}>{rec.title}</div>
        {showHandle && handle && <div style={{ fontFamily: GOTHIC, fontWeight: 800, fontSize: 22, color: '#cfd5e2' }}>{handle}</div>}
      </div>
      <div style={{ position: 'absolute', top: 70, left: 28, right: 28, height: g.rows * g.lineH, overflow: 'hidden' }}>
        <Rows rows={pane.rows} f={f} font={g.font} lineH={g.lineH} visibleRows={g.rows} />
      </div>
      {pane.lanePanels.map((lp, i) => <LanePanels key={i} panel={lp} f={f} layout={layout} g={g} />)}
      <div style={{ position: 'absolute', left: 28, right: 28, bottom: 18, borderTop: '1px solid #2d313a', paddingTop: 8, background: T.bg }}>
        <Spinner f={f} realSeconds={rec.realSeconds} outputTokens={rec.outputTokens} workEnd={pane.workEnd} font={g.font} lineH={g.lineH} />
      </div>
    </div>
  );
};

export const TerminalReplay: React.FC<ReplayProps> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = p.layout ?? 'wide';
  const tl = timelineOf(p);
  const recs: ReplayRecord[] = p.compare?.b ? [p, p.compare.b] : [p];
  const gs = geometry(layout, recs.length);
  const labels = p.compare?.b ? [p.compare.label_a, p.compare.label_b] : [undefined];

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 0%, #26304d 0%, #0d1018 70%)' }}>
      {p.bgm && <Audio src={staticFile(p.bgm)} />}

      {/* 2通り比べるとき：何を比べているか */}
      {p.compare?.b && p.compare.what && (
        <div style={{ position: 'absolute', top: layout === 'wide' ? 40 : 170, left: 0, right: 0, textAlign: 'center', fontFamily: GOTHIC, fontWeight: 900, fontSize: layout === 'wide' ? 34 : 30, color: '#ffffff' }}>
          {p.compare.what}
        </div>
      )}

      {recs.map((rec, i) => (
        <TerminalPane key={i} rec={rec} pane={tl.panes[i]} g={gs[i]} layout={layout} label={labels[i]} handle={p.handle} showHandle={layout === 'tall' && i === 0} />
      ))}

      {/* 注釈：auto＝起きたこと（色の札）、note＝説明文字（白い札。記録にある出来事だけ） */}
      {tl.callouts.map((c, i) => {
        const g = gs[Math.max(0, Math.min(gs.length - 1, c.pane ?? 0))];
        const life = c.kind === 'note' ? 80 : 48;
        const s = spring({ frame: f - c.at, fps, config: { damping: 12 } });
        const out = interpolate(f - c.at, [life - 8, life], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        if (f < c.at || out <= 0) return null;
        if (c.kind === 'note') {
          // 同時に出ている説明文字は、上に積む（重ならないように）
          const stack = tl.callouts.filter((o, j) => j < i && o.kind === 'note' && (o.pane ?? 0) === (c.pane ?? 0) && f >= o.at && f < o.at + life).length;
          const base: React.CSSProperties = c.pane === -1 ? { left: 0, right: 0, bottom: layout === 'wide' ? 40 : 480, display: 'flex', justifyContent: 'center' } : g.note;
          const pos: React.CSSProperties = { ...base, bottom: (Number(base.bottom) || 0) + stack * (layout === 'wide' ? 76 : 72) };
          return (
            <div key={i} style={{ position: 'absolute', ...pos, opacity: out, transform: `translateY(${(1 - s) * 30}px)` }}>
              <div style={{ background: '#ffffff', color: C.navy, fontFamily: GOTHIC, fontWeight: 900, fontSize: layout === 'wide' ? 34 : 32, padding: '12px 24px', borderRadius: 14, borderLeft: `10px solid ${C.yellow}`, boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }}>
                {c.text}
              </div>
            </div>
          );
        }
        const color = COLOR[c.color] ?? c.color;
        return (
          <div key={i} style={{
            position: 'absolute', ...g.callout, background: color, color: color === C.yellow ? C.navy : '#0d1018',
            fontFamily: GOTHIC, fontWeight: 900, fontSize: gs.length > 1 ? 30 : 38, padding: '14px 26px', borderRadius: 999,
            transform: `scale(${s}) rotate(-2deg)`, opacity: out, boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
          }}>
            {c.text}
          </div>
        );
      })}

      {recs.map((rec, i) => <ResultCard key={`r${i}`} rec={rec} start={tl.panes[i].resultStart} g={gs[i]} />)}

      {/* 使った機能（正直に）。左上に小さく */}
      {p.feature && (
        <div style={{ position: 'absolute', left: layout === 'wide' ? 100 : 60, ...(layout === 'wide' ? { bottom: 28 } : { top: 126 }), fontFamily: GOTHIC, fontWeight: 700, fontSize: 22, color: 'rgba(255,255,255,0.6)' }}>
          使った機能：{p.feature}
        </div>
      )}

      {p.handle && layout !== 'tall' && (
        <div style={{ position: 'absolute', right: 100, bottom: 28, fontFamily: GOTHIC, fontWeight: 800, fontSize: 26, color: 'rgba(255,255,255,0.85)' }}>
          {p.handle}
        </div>
      )}
    </AbsoluteFill>
  );
};
