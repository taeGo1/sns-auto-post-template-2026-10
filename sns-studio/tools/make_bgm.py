"""リール用のBGMを、型（pattern）ごとに手元で合成する（費用ゼロ・著作権の心配なし）。

使い方（sns-studio フォルダで）：
  python3 tools/make_bgm.py --props props/<ファイル>.json --out public/bgm/<ファイル>.wav

props の pattern と、各場面の秒数・種類（kind）を読んで、
  ・曲の長さ ＝ 場面の合計
  ・場面の頭に効果音（型ごとに違う音）
  ・なるほど の「答え」と、保存のお願い（cta）で、きらきら音
を入れる。考え方は 別の動画プロジェクト/tools/make_lab_fun_bgm.py と同じ。

型ごとの曲調
  breaking（速報）  … 160BPM・短調・4つ打ちと警報っぽい音で緊張感
  howto（ノウハウ） … 118BPM・長調・マリンバの分散和音で軽やか
  naruhodo（なるほど）… 140BPM・弾むベースと「ぽんっ」
  insight（考察）   … 84BPM・やわらかいパッドとベルで落ち着き
"""
import argparse
import json

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 44100
rng = np.random.default_rng(7)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, a, d):
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    k = max(1, int(a * SR))
    e[:k] *= np.linspace(0, 1, k)
    return e


def marimba(m, dur=0.35):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / 0.03)
    return s * env(n, 0.002, 0.12)


def bell(m, dur=0.8):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t + 0.7 * np.sin(2 * np.pi * f * 3.5 * t) * np.exp(-t / 0.12))
    return s * env(n, 0.002, 0.35)


def pad(ms, dur):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for m in ms:
        for d in (-0.08, 0.08):
            s += np.sin(2 * np.pi * hz(m + d) * t)
    return s * np.minimum(1, t / 0.3) * np.minimum(1, (dur - t) / 0.2) / len(ms)


def bass(m, dur, bright=0.35):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + bright * np.sin(4 * np.pi * f * t)
    return s * env(n, 0.003, 0.18) * np.minimum(1, np.maximum(0, (dur - t) / 0.01))


def saw(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 8))
    return s * env(n, 0.005, 0.25)


def kick(g=1.0):
    n = int(0.25 * SR); t = np.arange(n) / SR
    f = 55 + 110 * np.exp(-t / 0.025)
    return g * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.1)


b_hi, a_hi = butter(2, 8000 / (SR / 2), 'high')
b_bp, a_bp = butter(2, [1000 / (SR / 2), 4500 / (SR / 2)], 'band')


def shaker():
    n = int(0.04 * SR)
    return lfilter(b_hi, a_hi, rng.standard_normal(n)) * env(n, 0.003, 0.012)


def clap():
    n = int(0.18 * SR); s = np.zeros(n)
    for off in (0, 0.01, 0.02):
        k = int(off * SR)
        s[k:] += lfilter(b_bp, a_bp, rng.standard_normal(n - k)) * env(n - k, 0.001, 0.05)
    return s / 2


def pop():
    n = int(0.25 * SR); t = np.arange(n) / SR
    f = 300 + 900 * np.exp(-t / 0.02)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06)


def whoosh(dur=0.35):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = lfilter(b_bp, a_bp, rng.standard_normal(n))
    return noise * np.sin(np.pi * t / dur) ** 2


def alert():
    # 速報の「ピコン」：2音の短い電子音
    out = []
    for m in (88, 93):
        n = int(0.09 * SR); t = np.arange(n) / SR
        out.append(np.sign(np.sin(2 * np.pi * hz(m) * t)) * 0.5 * env(n, 0.001, 0.05))
    return np.concatenate(out)


STYLE = {
    'breaking': dict(bpm=160, chords=[(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])]),
    'howto': dict(bpm=118, chords=[(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [60, 64, 69]), (41, [60, 65, 69])]),
    'naruhodo': dict(bpm=140, chords=[(50, [62, 66, 69]), (47, [62, 66, 71]), (43, [62, 67, 71]), (45, [61, 64, 69])]),
    # 2026-10-02 追加
    'compare': dict(bpm=108, chords=[(45, [60, 64, 69]), (41, [60, 65, 69]), (48, [60, 64, 67]), (43, [59, 62, 67])], like='howto'),
    'kinetic': dict(bpm=150, chords=[(50, [62, 66, 69]), (45, [61, 64, 69]), (47, [62, 66, 71]), (43, [62, 67, 71])], like='naruhodo'),
    # 2026-10-02 8パターン化（brand.ts の THEMES の bpm と同じ値）
    'ngok': dict(bpm=132, chords=[(45, [60, 64, 69]), (43, [59, 62, 67]), (41, [60, 65, 69]), (40, [59, 64, 67])], like='howto'),
    'ranking': dict(bpm=120, chords=[(48, [60, 64, 67]), (45, [60, 64, 69]), (41, [60, 65, 69]), (43, [59, 62, 67])], like='breaking'),
    'quiz': dict(bpm=140, chords=[(50, [62, 66, 69]), (47, [62, 66, 71]), (43, [62, 67, 71]), (45, [61, 64, 69])], like='naruhodo'),
    'pov': dict(bpm=124, chords=[(41, [60, 65, 69]), (43, [59, 62, 67]), (45, [60, 64, 69]), (40, [59, 64, 67])], like='howto'),
    'insight': dict(bpm=84, chords=[(41, [64, 69, 72, 76]), (40, [62, 67, 71, 74]), (38, [60, 65, 69, 72]), (36, [59, 64, 67, 71])]),
}


def tick():
    n = int(0.05 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.01)


def ding(m=96):
    return bell(m, 0.9) + 0.5 * bell(m + 7, 0.9)


def thud():
    k = kick(1.4); c = clap()
    k[:len(c)] += 0.6 * c
    return k


def drumroll(t0, dur, add):
    steps = int(dur / 0.045)
    for i in range(steps):
        add(clap(), t0 + i * 0.045, gain=0.05 + 0.2 * i / steps)


def build(pattern, scenes):
    st = STYLE.get(pattern, STYLE['howto'])
    # 長さ：beats（拍の数）があれば、この型のテンポから秒数にする（Reel.tsx の sceneFrames と同じ計算）
    for sc in scenes:
        if sc.get('beats'):
            sc['seconds'] = sc['beats'] * 60 / st['bpm']
        sc.setdefault('seconds', 3)
    sfx = pattern
    pattern = st.get('like', pattern)   # 伴奏の作り方は近い型を流用し、テンポと和音だけ変える
    beat = 60 / st['bpm']; bar = beat * 4
    total = sum(s['seconds'] for s in scenes)
    N = int(SR * (total + 0.5))
    L = np.zeros(N); R = np.zeros(N)

    def add(sig, t, pan=0.0, gain=1.0):
        i = int(t * SR)
        if i >= N or i < 0:
            return
        sig = sig[: N - i] * gain
        L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2)
        R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2)

    bars = int(np.ceil(total / bar)) + 1
    for b in range(bars):
        t0 = b * bar
        root, tri = st['chords'][b % 4]
        if pattern == 'breaking':
            add(pad(tri, bar), t0, gain=0.05)
            for q in range(4):
                add(kick(), t0 + q * beat, gain=0.6)
            add(clap(), t0 + beat, gain=0.18); add(clap(), t0 + 3 * beat, gain=0.18)
            for e in range(8):
                add(bass(root, beat / 2 * 0.8, 0.6), t0 + e * beat / 2, gain=0.24)
                add(shaker(), t0 + e * beat / 2 + beat / 4, pan=0.4, gain=0.06)
            for e in (0, 3, 6):
                add(saw(tri[0] + 12, beat * 0.4), t0 + e * beat / 2, pan=-0.2, gain=0.035)
        elif pattern == 'howto':
            add(pad(tri, bar), t0, gain=0.05)
            for e in range(8):
                add(marimba(tri[e % 3] + (12 if e >= 4 else 0)), t0 + e * beat / 2, pan=-0.3 + 0.08 * e, gain=0.09)
            add(kick(), t0, gain=0.45); add(kick(), t0 + 2 * beat, gain=0.45)
            add(clap(), t0 + beat, gain=0.13); add(clap(), t0 + 3 * beat, gain=0.13)
            for s16 in range(16):
                add(shaker(), t0 + s16 * beat / 4, pan=0.4, gain=0.05 if s16 % 2 else 0.025)
            add(bass(root, beat * 1.8), t0, gain=0.22); add(bass(root + 7, beat * 1.8), t0 + 2 * beat, gain=0.18)
        elif pattern == 'naruhodo':
            add(pad(tri, bar), t0, gain=0.04)
            for e in range(8):
                add(bass(root + (12 if e % 2 else 0), beat / 2 * 0.85), t0 + e * beat / 2, gain=0.24 if e % 2 == 0 else 0.16)
                if e % 2:
                    for k, m in enumerate(tri):
                        add(marimba(m + 12), t0 + e * beat / 2 + k * 0.006, pan=0.3, gain=0.06)
            add(kick(), t0, gain=0.6); add(kick(), t0 + 2 * beat, gain=0.6); add(kick(), t0 + 3.5 * beat, gain=0.3)
            add(clap(), t0 + beat, gain=0.18); add(clap(), t0 + 3 * beat, gain=0.18)
            for s16 in range(16):
                add(shaker(), t0 + s16 * beat / 4, pan=0.4, gain=0.06 if s16 % 2 else 0.03)
        else:  # insight
            add(pad(tri, bar), t0, gain=0.11)
            add(bass(root, bar * 0.9, 0.1), t0, gain=0.2)
            add(kick(0.6), t0, gain=0.3); add(kick(0.6), t0 + 2.5 * beat, gain=0.2)
            for e, k in ((0, 0), (1.5, 1), (2, 2), (3, 3)):
                add(bell(tri[k % len(tri)] + 12, 1.2), t0 + e * beat, pan=-0.2 + 0.1 * k, gain=0.05)

    # 場面の頭の効果音
    t = 0.0
    for i, s in enumerate(scenes):
        kind = s.get('kind', 'point')
        if kind == 'ngok':
            add(thud(), t + 16 / 30, gain=0.5)                  # ×のハンコ
            add(whoosh(0.35), t + 40 / 30, gain=0.14)           # 裏返る
            add(ding(91), t + 56 / 30, gain=0.12)               # OK
        if kind == 'rank':
            if s.get('rank') == 1:
                drumroll(max(0, t - 1.2), 1.2, add)
                add(thud(), t, gain=0.45)
                for k, m in enumerate([84, 88, 91, 96, 100]):
                    add(bell(m, 0.6), t + 0.3 + k * 0.05, gain=0.08)
            else:
                add(whoosh(0.3), max(0, t - 0.15), gain=0.12); add(thud(), t + 0.2, gain=0.3)
        if kind == 'quiz':
            wait = 75 / 30
            for q in range(int(wait)):
                add(tick(), t + q + 0.05, gain=0.25)
            add(ding(), t + wait, gain=0.16)
            add(pop(), t + wait, gain=0.2)
        if kind == 'answer' and s.get('countdown'):
            for q in range(3):
                add(tick(), t + q * 0.5, gain=0.3); add(pop(), t + q * 0.5, gain=0.12)
            add(ding(98), t + 1.5, gain=0.18)
        if kind == 'cta' and s.get('cta'):
            # ctas.tsx の CTA_FIRST=10 / CTA_ROW_GAP=16 / CTA_TAP=9（フレーム）に合わせる
            for k, act in enumerate(s['cta']):
                row = t + (10 + k * 16) / 30
                tap = row + 9 / 30
                add(whoosh(0.2), max(0, row - 0.05), gain=0.07)
                if act == 'comment':
                    for q in range(len(s.get('keyword') or 'わかる！')):
                        add(tick(), tap - 10 / 30 + q * 0.1, gain=0.12)
                    add(pop(), tap - 10 / 30 + len(s.get('keyword') or 'わかる！') * 0.1, gain=0.15)
                    continue
                add(tick(), tap, gain=0.2)
                if act == 'save':
                    add(pop(), tap, gain=0.16)
                elif act == 'like':
                    add(pop(), tap, gain=0.18); add(bell(93, 0.4), tap + 0.03, gain=0.06)
                elif act == 'follow':
                    add(ding(91), tap, gain=0.12)
                elif act == 'line':
                    add(ding(96), tap, gain=0.12); add(ding(103), tap + 0.12, gain=0.08)
                elif act == 'share':
                    add(whoosh(0.45), tap, gain=0.14); add(pop(), tap + 0.5, gain=0.12)
        if kind in ('pov', 'chat') and s.get('reactions'):
            for q in range(4):
                add(pop(), t + 2.0 + q * 0.12, gain=0.1)
        if sfx == 'kinetic':
            add(whoosh(0.3), max(0, t - 0.12), gain=0.14)
            add(pop(), t + 0.12, gain=0.18)
        elif sfx == 'compare' and kind == 'compare':
            add(pop(), t + 0.15, gain=0.14)
            add(whoosh(0.3), t + 1.0, gain=0.12)
            for k, m in enumerate([86, 90, 93]):
                add(bell(m, 0.5), t + 1.2 + k * 0.05, gain=0.06)
        elif sfx == 'breaking':
            add(alert(), t, gain=0.12 if i else 0.2)
            add(whoosh(), max(0, t - 0.2), gain=0.08)
        elif pattern == 'insight':
            if i:
                add(bell(84, 1.5), t, gain=0.05)
        elif sfx == 'ranking':
            pass  # ランキングは rank の効果音（落ちる音・ドラムロール）に任せる
        else:
            add(whoosh(0.25), max(0, t - 0.1), gain=0.08)  # 場面の切り替えにシュッ（パターン崩し）
            add(pop(), t + 0.05, gain=0.16)
        if kind in ('answer', 'cta') and sfx != 'breaking':
            for k, m in enumerate([86, 90, 93, 98, 102]):
                add(bell(m, 0.5), t + 0.15 + k * 0.04, pan=-0.5 + 0.25 * k, gain=0.06)
        t += s['seconds']

    mix = np.stack([L, R], axis=1)
    tt = np.arange(N) / SR
    mix *= (np.minimum(1, tt / 0.15) * np.clip((total + 0.3 - tt) / 1.2, 0, 1))[:, None]
    mix = np.tanh(mix * 1.2)
    mix *= 0.8 / max(1e-9, np.max(np.abs(mix)))
    return mix


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--props', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    p = json.load(open(a.props, encoding='utf-8'))
    mix = build(p.get('pattern', 'howto'), p['reel']['scenes'])
    wavfile.write(a.out, SR, (mix * 32767).astype(np.int16))
    print(f"ok {a.out} {len(mix) / SR:.1f}s pattern={p.get('pattern')}")
