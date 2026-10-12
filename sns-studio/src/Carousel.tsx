import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, GOTHIC, HANDLE, HandleCtx, LATIN_BOLD, THEMES, type Theme } from './brand';
const Name: React.FC = () => <>{React.useContext(HandleCtx)}</>;
import { Background, Bookmark, Marked, Sticker, Ticker, lines } from './fx';
import type { Pattern, Slide, SnsProps } from './types';

// Instagram カルーセル（1080×1350・4:5）。1フレーム＝1枚
// `remotion render --sequence` で枚数ぶんの PNG が出る。静止画なので動きは「出来上がった状態」で描く

const PAD = 96;

const Shell: React.FC<{ pattern: Pattern; t: Theme; index: number; total: number; children: React.ReactNode }> = ({
  pattern, t, index, total, children,
}) => (
  <AbsoluteFill style={{ color: t.ink, fontFamily: GOTHIC }}>
    <Background pattern={pattern} still />
    {/* 上：型のシール＋ページ */}
    <div style={{ position: 'absolute', top: 96, left: PAD, right: PAD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Sticker bg={t.sticker} color={t.stickerInk} size={30} rotate={-3}>
        {false ? '⚡ 速報' : t.label}
      </Sticker>
      <div style={{ fontFamily: LATIN_BOLD, fontSize: 30, color: t.ink, opacity: 0.8 }}>
        {index + 1}<span style={{ opacity: 0.5 }}> / {total}</span>
      </div>
    </div>
    {/* 中身（上下中央寄せ） */}
    <div
      style={{
        position: 'absolute', left: PAD, right: PAD, top: 200, bottom: false ? 230 : 170,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}
    >
      {children}
    </div>
    {/* 下：ハンドル＋次へ */}
    {true && (
      <div
        style={{
          position: 'absolute', bottom: 80, left: PAD, right: PAD, display: 'flex', justifyContent: 'space-between',
          fontSize: 26, fontWeight: 700, color: t.sub, letterSpacing: 2,
        }}
      >
        <span><Name /></span>
        {index < total - 1 && <span>スワイプ →</span>}
      </div>
    )}
    {/* 速報：帯の下に小さく名前 */}
    {false && (
      <div style={{ position: 'absolute', bottom: 22, left: PAD, fontSize: 22, fontWeight: 700, color: t.sub, letterSpacing: 2, opacity: 0.85 }}>
        <Name />
      </div>
    )}
  </AbsoluteFill>
);

const Title: React.FC<{ t: Theme; size: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ t, size, children, style }) => (
  <div style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: size, lineHeight: 1.32, letterSpacing: 1, ...style }}>{children}</div>
);

const Body: React.FC<{ t: Theme; children: React.ReactNode }> = ({ t, children }) => (
  <div style={{ fontSize: 40, lineHeight: 1.8, fontWeight: 600, color: t.ink }}>{children}</div>
);

const SlideView: React.FC<{ s: Slide; t: Theme; pattern: Pattern }> = ({ s, t, pattern }) => {
  if (s.type === 'cover') {
    return (
      <>
        {s.kicker && (
          <div style={{ fontFamily: LATIN_BOLD, fontSize: 34, letterSpacing: 4, color: false ? C.orange : t.sub, marginBottom: 28 }}>
            {s.kicker}
          </div>
        )}
        <Title t={t} size={false ? 104 : 96}>
          <Marked text={s.title} mark={s.mark} color={t.marker} still />
        </Title>
        {s.sub && (
          <div style={{ marginTop: 48, fontSize: 42, lineHeight: 1.6, fontWeight: 700, color: t.sub }}>{lines(s.sub)}</div>
        )}
      </>
    );
  }
  if (s.type === 'point') {
    return (
      <>
        <div style={{ marginBottom: 40 }}>
          {false ? (
            <div style={{ fontFamily: LATIN_BOLD, fontSize: 96, color: C.yellow, WebkitTextStroke: `3px ${C.navy}` }}>{s.no}</div>
          ) : (
            <Sticker bg={false ? C.navy : t.sticker} color={false ? C.yellow : t.stickerInk} size={64} rotate={-5}>
              {s.no}
            </Sticker>
          )}
        </div>
        <Title t={t} size={76} style={{ marginBottom: 44 }}>{lines(s.title)}</Title>
        <div
          style={{
            background: false ? C.white : 'rgba(255,255,255,0.75)', borderRadius: 28,
            border: `3px solid ${C.navy}`, padding: '36px 40px', boxShadow: false ? 'none' : `8px 8px 0 ${C.navy}`,
          }}
        >
          <Body t={t}><Marked text={s.body} mark={s.mark} color={t.marker === C.white ? C.yellow : t.marker} still /></Body>
        </div>
      </>
    );
  }
  if (s.type === 'list') {
    return (
      <>
        <Title t={t} size={76} style={{ marginBottom: 48 }}>{lines(s.title)}</Title>
        {s.items.map((it, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 28, marginBottom: 22, padding: '24px 32px',
              background: C.white, borderRadius: 22, border: `3px solid ${C.navy}`,
            }}
          >
            <div
              style={{
                width: 60, height: 60, borderRadius: '50%', background: pattern === 'naruhodo' ? C.sky : C.yellow,
                border: `3px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: LATIN_BOLD, fontSize: 28, flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.4 }}>{it}</div>
          </div>
        ))}
      </>
    );
  }
  if (s.type === 'question') {
    return (
      <>
        <div style={{ fontFamily: LATIN_BOLD, fontSize: 260, lineHeight: 1, color: C.sky, WebkitTextStroke: `6px ${C.navy}`, marginBottom: 20 }}>?</div>
        <Title t={t} size={84}>{lines(s.title)}</Title>
        {s.sub && <div style={{ marginTop: 40, fontSize: 40, fontWeight: 700, color: t.sub }}>{lines(s.sub)}</div>}
      </>
    );
  }
  if (s.type === 'answer') {
    return (
      <>
        <div style={{ fontFamily: LATIN_BOLD, fontSize: 260, lineHeight: 1, color: C.yellow, WebkitTextStroke: `6px ${C.navy}`, marginBottom: 20 }}>!</div>
        <Title t={t} size={84}><Marked text={s.title} mark={s.mark} color={t.marker} still /></Title>
        {s.body && <div style={{ marginTop: 40 }}><Body t={t}>{lines(s.body)}</Body></div>}
      </>
    );
  }
  if (s.type === 'todo') {
    // やることはこれ（2026-10-05 作者「具体的に何をしたらいいか、最後にもう一度案内する」）：cta の直前の1枚
    return (
      <>
        <div style={{ marginBottom: 36 }}>
          <Sticker bg={false ? C.navy : t.sticker} color={false ? C.yellow : t.stickerInk} size={44} rotate={-3}>やることはこれ</Sticker>
        </div>
        {s.title && <Title t={t} size={72} style={{ marginBottom: 40 }}>{lines(s.title)}</Title>}
        {s.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, marginBottom: 20, padding: '22px 30px', background: C.white, borderRadius: 22, border: `3px solid ${C.navy}`, boxShadow: `6px 6px 0 ${C.navy}` }}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', background: C.green, border: `3px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: LATIN_BOLD, fontSize: 26, flexShrink: 0, color: C.white }}>{i + 1}</div>
            <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.4 }}>{it}</div>
          </div>
        ))}
        {s.say && (
          <div style={{ marginTop: 26 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: t.sub, marginBottom: 10 }}>こう頼む</div>
            <div style={{ background: C.yellow, color: C.navy, borderRadius: 26, padding: '22px 30px', fontSize: 38, fontWeight: 800, lineHeight: 1.5, border: `3px solid ${C.navy}` }}>「{lines(s.say)}」</div>
          </div>
        )}
      </>
    );
  }
  // cta
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
        <Bookmark size={150} color={false ? C.white : C.yellow} />
      </div>
      <Title t={t} size={88}>{lines(s.title)}</Title>
      {s.body && <div style={{ marginTop: 44, fontSize: 40, fontWeight: 700, color: t.sub, lineHeight: 1.7 }}>{lines(s.body)}</div>}
      <div style={{ marginTop: 64 }}>
        <Sticker bg={C.navy} color={C.yellow} size={44} rotate={-2}><Name /></Sticker>
      </div>
    </div>
  );
};

export const Carousel: React.FC<SnsProps> = ({ pattern, carousel, handle }) => {
  const frame = useCurrentFrame();
  const slides = carousel.slides;
  const i = Math.min(frame, slides.length - 1);
  const t = THEMES[pattern] ?? THEMES.howto;
  return (
    <HandleCtx.Provider value={handle || HANDLE}>
    <Shell pattern={pattern} t={t} index={i} total={slides.length}>
      <SlideView s={slides[i]} t={t} pattern={pattern} />
    </Shell>
    </HandleCtx.Provider>
  );
};

export const CAROUSEL_SIZE = { width: 1080, height: 1350 };
