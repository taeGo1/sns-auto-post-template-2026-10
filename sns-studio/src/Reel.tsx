import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, GOTHIC, HANDLE, HandleCtx, LATIN_BOLD, REEL_SAFE, THEMES, TIKTOK_SAFE, type Theme } from './brand';
import { BigNumber, CardStack, Compare, KINETIC_BG, Punch, Wipe } from './scenes2';
import { CtaBlock } from './ctas';
import { COUNTDOWN, Countdown, Flash, NgOk, Quiz, QUIZ_WAIT, RankItem, Reactions, SceneFx } from './scenes3';
import { Background, Bookmark, Confetti, Marked, Pop, Rise, Slam, Sticker, Ticker, lines } from './fx';
import type { Pattern, Scene, SnsProps } from './types';
import { BriefCard, ChatMock, FlowDevices, ImageCard } from './visuals';

// Instagram リール（1080×1920・縦）
// 型（pattern）ごとに背景・出方・音楽を変える。文字は REEL_SAFE の内側だけに置く

export const FPS = 30;

// 文字を避ける範囲（Instagram と TikTok で違う）
const SafeCtx = React.createContext(REEL_SAFE);
const useSafe = () => React.useContext(SafeCtx);
// 横長（1920×1080）：縦長用に作った場面をそのまま使うため、2400×1350 の仮の画面に描いて 0.8 倍で収める
export const WIDE = { W: 1920, H: 1080, VW: 2400, VH: 1350, scale: 0.8 };
const WIDE_SAFE = { top: 60, right: 260, bottom: 60, left: 260 };
// 長さ：beats（拍の数）があれば音楽のテンポから計算、無ければ seconds
export const sceneFrames = (s: Scene, pattern?: Pattern) => {
  const bpm = pattern ? (THEMES[pattern]?.bpm ?? 120) : 120;
  const sec = s.beats ? (s.beats * 60) / bpm : (s.seconds ?? 3);
  return Math.max(1, Math.round(sec * FPS));
};

// 型ごとの「出方」
const Enter: React.FC<{ pattern: Pattern; delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  pattern, delay = 0, children, style,
}) => {
  if (pattern === 'breaking') return <Slam delay={delay} style={style}>{children}</Slam>;
  if (pattern === 'insight') return <Rise delay={delay} style={style}>{children}</Rise>;
  return <Pop delay={delay} style={style}>{children}</Pop>;
};

const Big: React.FC<{ t: Theme; size?: number; children: React.ReactNode }> = ({ t, size = 92, children }) => (
  <div style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: size, lineHeight: 1.3, color: t.ink, letterSpacing: 1 }}>{children}</div>
);

const SubLine: React.FC<{ t: Theme; children: React.ReactNode }> = ({ t, children }) => (
  <div style={{ marginTop: 44, fontSize: 46, fontWeight: 800, lineHeight: 1.5, color: t.sub }}>{children}</div>
);

const SceneView: React.FC<{ scene: Scene; pattern: Pattern; t: Theme; index: number }> = ({ scene, pattern, t, index }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = sceneFrames(scene, pattern);
  const out = interpolate(f, [len - 6, len], [1, 0], { extrapolateLeft: 'clamp' });
  const kind = scene.kind ?? 'point';
  const mk = t.marker === C.white ? C.white : t.marker;

  const safe = useSafe();
  const handleName = React.useContext(HandleCtx);
  // 横長では左寄せの場面も中央に（右半分が空くため・2026-10-05）
  const center = safe === WIDE_SAFE || scene.align === 'center' || (scene.align !== 'left' && ['kinetic', 'compare', 'ngok', 'ranking', 'quiz'].includes(pattern));
  let body: React.ReactNode;
  const heading = (size = 74) =>
    scene.text ? (
      <Enter pattern={pattern}>
        <Big t={t} size={size}><Marked text={scene.text} mark={scene.mark} color={pattern === 'ranking' ? C.white : mk} delay={12} /></Big>
      </Enter>
    ) : null;
  if (kind === 'ngok') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 50 }}>
        {heading()}
        <NgOk ng={scene.ng ?? ''} ok={scene.ok ?? ''} />
      </div>
    );
  } else if (kind === 'rank') {
    body = <div style={{ display: 'flex', justifyContent: 'center' }}><RankItem rank={scene.rank ?? 1} text={scene.text} sub={scene.sub} /></div>;
  } else if (kind === 'quiz') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 44 }}>
        {heading(70)}
        <Quiz a={scene.a ?? ''} b={scene.b ?? ''} answer={scene.answer ?? 'a'} />
      </div>
    );
  } else if (kind === 'pov') {
    body = (
      <>
        <Pop>
          <div style={{ marginBottom: 26 }}><Sticker bg={C.navy} color={C.white} size={48} rotate={-3}>POV</Sticker></div>
        </Pop>
        {heading(80)}
        {scene.chat && <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}><ChatMock chat={scene.chat} delay={8} /></div>}
      </>
    );
  } else if (kind === 'punch' || kind === 'number' || kind === 'compare' || kind === 'cards') {
    // 中央に大きく見せる場面（2026-10-02 追加）
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        {scene.text && kind !== 'punch' && (
          <Enter pattern={pattern}>
            <Big t={t} size={74}><Marked text={scene.text} mark={scene.mark} color={pattern === 'kinetic' || pattern === 'breaking' ? C.white : mk} delay={14} /></Big>
          </Enter>
        )}
        <div style={{ marginTop: kind === 'punch' ? 0 : 44, display: 'flex', justifyContent: 'center', width: '100%' }}>
          {kind === 'punch' && <Punch words={scene.words ?? scene.text.split('\n')} />}
          {kind === 'number' && <BigNumber value={scene.value ?? ''} label={scene.label} ink={C.navy} />}
          {kind === 'compare' && <Compare before={scene.before ?? ''} after={scene.after ?? ''} />}
          {kind === 'cards' && <CardStack cards={scene.cards ?? []} />}
        </div>
        {scene.sub && <Enter pattern={pattern} delay={22}><SubLine t={t}>{lines(scene.sub)}</SubLine></Enter>}
      </div>
    );
  } else if (kind === 'chat' || kind === 'brief' || kind === 'flow' || kind === 'image') {
    // イメージ図の場面：上に短い見出し、下に図
    body = (
      <>
        <Enter pattern={pattern}>
          <Big t={t} size={76}><Marked text={scene.text} mark={scene.mark} color={pattern === 'breaking' ? C.white : mk} delay={14} /></Big>
        </Enter>
        <div style={{ marginTop: 50, display: 'flex', justifyContent: 'center' }}>
          {kind === 'chat' && scene.chat && <ChatMock chat={scene.chat} delay={8} />}
          {kind === 'chat' && scene.reactions && <Reactions emojis={scene.reactions} delay={70} />}
          {kind === 'brief' && scene.brief && <BriefCard title={scene.brief.title} items={scene.brief.items} delay={8} />}
          {kind === 'flow' && scene.steps && <FlowDevices steps={scene.steps} delay={6} />}
          {kind === 'image' && scene.image && <ImageCard src={scene.image.src} caption={scene.image.caption} delay={6} />}
        </div>
        {scene.sub && <Enter pattern={pattern} delay={20}><SubLine t={t}>{lines(scene.sub)}</SubLine></Enter>}
      </>
    );
  } else if (kind === 'question') {
    const bob = Math.sin(f / 5) * 10;
    body = (
      <>
        <Pop>
          <div style={{ fontFamily: LATIN_BOLD, fontSize: 300, lineHeight: 1, color: C.sky, WebkitTextStroke: `7px ${C.navy}`, transform: `translateY(${bob}px) rotate(${Math.sin(f / 7) * 6}deg)` }}>?</div>
        </Pop>
        <Enter pattern={pattern} delay={6}><Big t={t}>{lines(scene.text)}</Big></Enter>
        {scene.sub && <Enter pattern={pattern} delay={14}><SubLine t={t}>{lines(scene.sub)}</SubLine></Enter>}
      </>
    );
  } else if (kind === 'answer') {
    const cd = scene.countdown ? COUNTDOWN : 0;
    const inner = (
      <div>
        <Pop from={0.3}>
          <div style={{ fontFamily: LATIN_BOLD, fontSize: 300, lineHeight: 1, color: C.yellow, WebkitTextStroke: `7px ${C.navy}`, transform: `rotate(${Math.sin(f / 4) * 4}deg)` }}>!</div>
        </Pop>
        <Enter pattern={pattern} delay={4}><Big t={t}><Marked text={scene.text} mark={scene.mark} color={mk} delay={12} /></Big></Enter>
        {scene.sub && <Enter pattern={pattern} delay={10}><SubLine t={t}>{lines(scene.sub)}</SubLine></Enter>}
      </div>
    );
    body = cd ? (
      <>
        {f < cd && <Countdown />}
        <Sequence from={cd} layout="none">{inner}</Sequence>
      </>
    ) : inner;
  } else if (kind === 'list') {
    body = (
      <>
        <Enter pattern={pattern}><Big t={t} size={80}>{lines(scene.text)}</Big></Enter>
        <div style={{ marginTop: 40 }}>
          {(scene.items ?? []).map((it, i) => (
            <Pop key={i} delay={8 + i * 7}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20, padding: '22px 30px', background: C.white, borderRadius: 22, border: `4px solid ${C.navy}`, boxShadow: `6px 6px 0 ${C.navy}` }}>
                <div style={{ width: 58, height: 58, borderRadius: '50%', background: C.yellow, border: `3px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: LATIN_BOLD, fontSize: 28, flexShrink: 0, color: C.navy }}>{i + 1}</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: C.navy }}>{it}</div>
              </div>
            </Pop>
          ))}
        </div>
      </>
    );
  } else if (kind === 'todo') {
    // やることはこれ（2026-10-05 作者「なるほど！の部分が欠けている。具体的に何をしたらいいか、最後にもう一度案内する」）
    // cta の直前に置く。手順1〜3つ＋「こう頼む」の言葉
    body = (
      <>
        <Pop>
          <div style={{ marginBottom: 34 }}>
            <Sticker bg={pattern === 'breaking' ? C.navy : t.sticker} color={pattern === 'breaking' ? C.yellow : t.stickerInk} size={46} rotate={-3}>やることはこれ</Sticker>
          </div>
        </Pop>
        {scene.text && <Enter pattern={pattern} delay={4}><Big t={t} size={72}>{lines(scene.text)}</Big></Enter>}
        <div style={{ marginTop: 34 }}>
          {(scene.items ?? []).map((it, i) => (
            <Pop key={i} delay={10 + i * 8}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 18, padding: '20px 28px', background: C.white, borderRadius: 22, border: `4px solid ${C.navy}`, boxShadow: `6px 6px 0 ${C.navy}` }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.green, border: `3px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: LATIN_BOLD, fontSize: 26, flexShrink: 0, color: C.white }}>{i + 1}</div>
                <div style={{ fontSize: 40, fontWeight: 800, color: C.navy, textAlign: 'left' }}>{it}</div>
              </div>
            </Pop>
          ))}
        </div>
        {scene.say && (
          <Pop delay={14 + (scene.items?.length ?? 0) * 8}>
            <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: t.sub, marginBottom: 8 }}>こう頼む</div>
              <div style={{ background: C.yellow, color: C.navy, borderRadius: 26, padding: '20px 30px', fontSize: 38, fontWeight: 800, lineHeight: 1.45, border: `3px solid ${C.navy}`, maxWidth: 900, textAlign: 'left' }}>
                「{lines(scene.say)}」
              </div>
            </div>
          </Pop>
        )}
      </>
    );
  } else if (kind === 'cta' && scene.cta && scene.cta.length) {
    // 最後のお願いの組み合わせ（2026-10-02）
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 44 }}>
        {scene.text && <Enter pattern={pattern}><Big t={t} size={78}>{lines(scene.text)}</Big></Enter>}
        <CtaBlock actions={scene.cta} pattern={pattern} opts={{ keyword: scene.keyword, lineLabel: scene.lineLabel, lineSub: scene.lineSub, commentLabel: scene.commentLabel }} />
      </div>
    );
  } else if (kind === 'cta') {
    const b = spring({ frame: f - 4, fps, config: { damping: 7, mass: 0.6, stiffness: 160 } });
    body = (
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', transform: `scale(${b}) rotate(${(1 - b) * -30}deg)`, marginBottom: 40 }}>
          <Bookmark size={190} color={pattern === 'breaking' ? C.white : C.yellow} />
        </div>
        <Enter pattern={pattern} delay={8}><Big t={t} size={88}>{lines(scene.text)}</Big></Enter>
        {scene.sub && <Enter pattern={pattern} delay={16}><SubLine t={t}>{lines(scene.sub)}</SubLine></Enter>}
        <Pop delay={24} style={{ marginTop: 56, display: 'flex', justifyContent: 'center' }}>
          <Sticker bg={C.navy} color={C.yellow} size={46} rotate={-3}>{handleName}</Sticker>
        </Pop>
      </div>
    );
  } else {
    // hook / point
    const isHook = kind === 'hook';
    body = (
      <>
        {isHook && pattern === 'breaking' && (
          <Pop>
            <div style={{ marginBottom: 40, opacity: f % 16 < 11 ? 1 : 0.35 }}>
              <Sticker bg={C.orange} color={C.white} size={58} rotate={-4}>⚡ 速報</Sticker>
            </div>
          </Pop>
        )}
        {isHook && pattern !== 'breaking' && (
          <Pop>
            <div style={{ marginBottom: 40 }}>
              <Sticker bg={t.sticker} color={t.stickerInk} size={44} rotate={-4}>{t.label}</Sticker>
            </div>
          </Pop>
        )}
        {!isHook && scene.no && (
          <Pop>
            <div style={{ marginBottom: 40 }}>
              <Sticker bg={pattern === 'breaking' ? C.navy : t.sticker} color={pattern === 'breaking' ? C.yellow : t.stickerInk} size={72} rotate={-6}>
                {scene.no}
              </Sticker>
            </div>
          </Pop>
        )}
        <Enter pattern={pattern} delay={4}>
          <Big t={t} size={isHook ? 104 : 92}><Marked text={scene.text} mark={scene.mark} color={pattern === 'breaking' ? C.white : mk} delay={16} /></Big>
        </Enter>
        {scene.sub && <Enter pattern={pattern} delay={12}><SubLine t={t}>{lines(scene.sub)}</SubLine></Enter>}
      </>
    );
  }

  return (
    <AbsoluteFill
      style={{
        paddingTop: safe.top + 90, paddingBottom: safe.bottom + 20,
        paddingLeft: safe.left + 24, paddingRight: safe.right + 24,
        justifyContent: 'center', opacity: out,
        alignItems: center ? 'center' : undefined, textAlign: center ? 'center' : undefined,
        // 場面の頭で少し寄って止まる（速報は揺れも）
        transform: `scale(${interpolate(f, [0, 8], [t.transition === 'flash' || t.transition === 'stamp' ? 1.12 : 1.04, 1], { extrapolateRight: 'clamp' })}) translateX(${t.transition === 'flash' && f < 10 ? Math.sin(f * 3) * (10 - f) * 2 : 0}px)`,
      }}
    >
      {body}
      {(kind === 'answer' || (kind === 'cta' && pattern !== 'breaking')) && <Confetti delay={kind === 'answer' ? 4 + (scene.countdown ? COUNTDOWN : 0) : 10} seed={`s${index}`} />}
      {kind === 'answer' && scene.countdown && <Flash at={COUNTDOWN} />}
      {kind === 'quiz' && <Flash at={QUIZ_WAIT} />}
      {kind === 'quiz' && <Confetti delay={QUIZ_WAIT + 2} seed={`q${index}`} count={50} />}
      {kind === 'rank' && scene.rank === 1 && <Confetti delay={10} seed={`r${index}`} count={70} />}
      {kind === 'pov' && scene.reactions && <Reactions emojis={scene.reactions} delay={60} />}
    </AbsoluteFill>
  );
};

// 上の進み具合バー（横長では位置を直接指定する）
const Progress: React.FC<{ total: number; t: Theme; pos?: React.CSSProperties }> = ({ total, t, pos }) => {
  const f = useCurrentFrame();
  const safe = useSafe();
  const where = pos ?? { top: safe.top + 20, left: safe.left + 24, right: safe.right + 24 };
  return (
    <div style={{ position: 'absolute', ...where, height: 12, borderRadius: 6, background: 'rgba(21,32,67,0.15)' }}>
      <div style={{ width: `${(f / total) * 100}%`, height: '100%', borderRadius: 6, background: t.ink }} />
    </div>
  );
};

export const Reel: React.FC<SnsProps> = ({ pattern, reel, bgm, platform, layout, handle }) => {
  const t = THEMES[pattern] ?? THEMES.howto;
  const wide = layout === 'wide';
  const safe = wide ? WIDE_SAFE : platform === 'tiktok' ? TIKTOK_SAFE : REEL_SAFE;
  const name = handle || HANDLE;
  const total = reel.scenes.reduce((n, s) => n + sceneFrames(s, pattern), 0);
  let from = 0;
  // 横長：場面は 2400×1350 の仮の画面に描き、0.8 倍で 1920×1080 に収める（文字の大きさ・図の部品は縦長と共通）
  const fit = (el: React.ReactNode) => wide
    ? <div style={{ position: 'absolute', left: 0, top: 0, width: WIDE.VW, height: WIDE.VH, transform: `scale(${WIDE.scale})`, transformOrigin: '0 0' }}>{el}</div>
    : el;
  return (
    <SafeCtx.Provider value={safe}>
    <HandleCtx.Provider value={name}>
    <AbsoluteFill style={{ fontFamily: GOTHIC }}>
      <Background pattern={pattern} />
      {/* テンポ型：場面ごとに背景色を斜めのワイプで切り替える */}
      {pattern === 'kinetic' && (() => {
        let at = 0;
        return reel.scenes.map((s, i) => {
          const d = sceneFrames(s, pattern);
          const el = (
            <Sequence key={`w${i}`} from={at} durationInFrames={d}>
              <Wipe color={KINETIC_BG[i % KINETIC_BG.length]} index={i} />
            </Sequence>
          );
          at += d;
          return el;
        });
      })()}
      {pattern === 'breaking' && <Ticker text={`速報　BREAKING NEWS　${name}`} top={wide ? 24 : safe.top - 100} />}
      {/* 横長：速報は上下に紺のストライプがあるので、バーと名前をその内側に */}
      <Progress total={total} t={t} pos={wide ? { bottom: pattern === 'breaking' ? 112 : 24, left: 200, right: 200 } : undefined} />
      {reel.scenes.map((s, i) => {
        const dur = sceneFrames(s, pattern);
        const seq = (
          <Sequence key={i} from={from} durationInFrames={dur}>
            {fit(<SceneView scene={s} pattern={pattern} t={t} index={i} />)}
            {pattern !== 'kinetic' && <SceneFx kind={t.transition} index={i} color={i % 2 ? C.yellow : C.sky} />}
          </Sequence>
        );
        from += dur;
        return seq;
      })}
      {wide && (
        <div style={{ position: 'absolute', right: 44, bottom: pattern === 'breaking' ? 132 : 44, fontFamily: GOTHIC, fontWeight: 800, fontSize: 26, color: t.ink, opacity: 0.85 }}>{name}</div>
      )}
      {bgm && <Audio src={staticFile(bgm)} />}
    </AbsoluteFill>
    </HandleCtx.Provider>
    </SafeCtx.Provider>
  );
};
