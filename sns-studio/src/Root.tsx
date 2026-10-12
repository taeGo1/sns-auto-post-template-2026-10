import React from 'react';
import { Composition } from 'remotion';
import { Carousel, CAROUSEL_SIZE } from './Carousel';
import { Reel, FPS, sceneFrames } from './Reel';
import { EMPTY, type SnsProps } from './types';
import { TerminalReplay, replayFrames, REPLAY_FPS, type ReplayProps } from './TerminalReplay';

const EMPTY_REPLAY: ReplayProps = { title: '~/demo', hook: '作業動画', prompt: 'props で差し替え', blocks: [], realSeconds: 0, outputTokens: 0 };

// 下書きデータ（props/*.json）を --props で渡すと、枚数・秒数が自動で決まる
export const Root: React.FC = () => (
  <>
    <Composition
      id="Carousel"
      component={Carousel}
      fps={1}
      durationInFrames={EMPTY.carousel.slides.length}
      {...CAROUSEL_SIZE}
      defaultProps={EMPTY}
      calculateMetadata={({ props }: { props: SnsProps }) => ({
        durationInFrames: Math.max(1, props.carousel.slides.length),
      })}
    />
    <Composition
      id="Reel"
      component={Reel}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={60}
      defaultProps={EMPTY}
      calculateMetadata={({ props }: { props: SnsProps }) => ({
        durationInFrames: Math.max(1, props.reel.scenes.reduce((n, s) => n + sceneFrames(s, props.pattern), 0)),
      })}
    />
    {/* TikTok 用（右と下のボタンを避ける配置）。props はリールと同じファイルを使う */}
    <Composition
      id="TikTok"
      component={Reel}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={60}
      defaultProps={{ ...EMPTY, platform: 'tiktok' as const }}
      calculateMetadata={({ props }: { props: SnsProps }) => ({
        durationInFrames: Math.max(1, props.reel.scenes.reduce((n, s) => n + sceneFrames(s, props.pattern), 0)),
        props: { ...props, platform: 'tiktok' as const },
      })}
    />
    {/* 横長のパターン動画（1920×1080・X と Threads 用）。2026-10-05 作者「縦長だけで横長が無い」。props はリールと同じファイル */}
    <Composition
      id="ReelWide"
      component={Reel}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={60}
      defaultProps={{ ...EMPTY, layout: 'wide' as const }}
      calculateMetadata={({ props }: { props: SnsProps }) => ({
        durationInFrames: Math.max(1, props.reel.scenes.reduce((n, s) => n + sceneFrames(s, props.pattern), 0)),
        props: { ...props, layout: 'wide' as const, handle: props.handle_wide || props.handle || '@your_account' },
      })}
    />
    {/* 作業動画（2026-10-03）：Claude Code の実際の作業記録を再生。props は tools/claude_log_to_replay.py が作る
        横長＝X・Facebook・Threads／縦長＝リール・TikTok。名前（handle）は書き出すときに --props で上書きする */}
    <Composition
      id="TerminalWide"
      component={TerminalReplay}
      fps={REPLAY_FPS}
      width={1920}
      height={1080}
      durationInFrames={60}
      defaultProps={EMPTY_REPLAY}
      calculateMetadata={({ props }: { props: ReplayProps }) => ({ durationInFrames: replayFrames({ ...props, layout: 'wide' }), props: { ...props, layout: 'wide' as const } })}
    />
    <Composition
      id="TerminalTall"
      component={TerminalReplay}
      fps={REPLAY_FPS}
      width={1080}
      height={1920}
      durationInFrames={60}
      defaultProps={EMPTY_REPLAY}
      calculateMetadata={({ props }: { props: ReplayProps }) => ({ durationInFrames: replayFrames({ ...props, layout: 'tall' }), props: { ...props, layout: 'tall' as const } })}
    />
  </>
);
