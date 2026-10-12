"""作業動画（TerminalWide / TerminalTall）の音を、手元で合成する（費用ゼロ・著作権の心配なし）。

作者の希望（2026-10-03）：「小さめに。楽しそうで、未来を感じる。POP すぎず、静かすぎない」
  曲   … 120BPM・長調の明るい和音だけ（D → A → G → A。短調や7度の和音は使わない）・きらっとした電子の分散和音・
          明るめの音の層・2小節ごとのベルの短いメロディ・軽いキックと手拍子・裏拍のハイハット。全体を小さめ（ピーク約 -10dB）
          2026-10-03 作者の希望で日替わりに。最初の5曲は「ほぼ同じに聞こえる」と言われ、きらきら・かろやか・まえむき を残し、
          リズムのノリと楽器を変えた新しい3曲（はずむ・ひろがる・わくわく）に入れ替えて6曲にした
          ※ 1回目（112BPM・F△7→G6→Em7→Am9・こもった音）は、作者に「ミステリアス」と言われて変えた（2026-10-03）
  効果音… 頼む文字を打つところ・行が出るところに控えめな打鍵音、エラーで低い音、テスト合格と完成で小さなチャイム、
          結果の画面が出るところでふわっとした音

音の位置は TerminalReplay.tsx の buildTimeline と同じ計算で決める（横長と縦長で1行の幅が違うので、別々に作る）。
使い方：python3 make_work_bgm.py --props <replay.json> --layout wide|tall --out <wav>
"""
import argparse
import json

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

from make_bgm import SR, bell, clap, env, hz, kick, marimba, rng

FPS = 30
COLS = {'wide': 104, 'tall': 52}  # TerminalReplay.tsx の LAYOUTS.cols と同じ値にする


def width(s):
    return sum(2 if ord(c) > 0x2E80 else 1 for c in s)


def wrap(s, cols):
    out, cur = [], ''
    for ch in s:
        if width(cur + ch) > cols:
            out.append(cur); cur = ''
        cur += ch
    out.append(cur)
    return out


def timeline(p, layout):
    """TerminalReplay.tsx の buildTimeline と同じ計算（フレーム）。音を鳴らす場所を返す。"""
    cols = COLS[layout]
    ev = []  # (frame, 種類)
    f = 18
    for _ in wrap('> ' + p['prompt'], cols - 2):
        for k in range(0, 14, 2):
            ev.append((f + k, 'type'))
        f += 14
    f += 12
    for b in p['blocks']:
        if b['type'] == 'text' and b.get('text'):
            for _ in wrap('● ' + b['text'].replace('`', ''), cols):
                ev.append((f, 'line')); f += 6
            f += 6
            continue
        ev.append((f, 'tool')); f += 9
        for _ in b.get('added') or []:
            ev.append((f, 'code')); f += 3
        if b.get('summary'):
            f += 5
        for _ in b.get('lines') or []:
            f += 4
        if b.get('ok') is False:
            ev.append((f, 'error')); f += 34
        if b.get('pass'):
            ev.append((f, 'pass')); f += 34
        f += 8
    work_end = f
    ev.append((f, 'done'))
    result_start = f + 18
    ev.append((result_start, 'result'))
    total = result_start + (120 if p.get('resultPreview') else 30)
    return ev, total


b_lp, a_lp = butter(2, 2400 / (SR / 2), 'low')
b_pad, a_pad = butter(2, 5000 / (SR / 2), 'low')  # 音の層は明るめに
b_hp, a_hp = butter(2, 2500 / (SR / 2), 'high')
b_click, a_click = butter(2, [1800 / (SR / 2), 6000 / (SR / 2)], 'band')


def pluck(m, dur=0.32):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * 2 * f * t) + 0.2 * np.sin(2 * np.pi * 3 * f * t)
    return s * env(n, 0.002, 0.09)


def warm_pad(ms, dur):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for m in ms:
        for d in (-0.07, 0.0, 0.07):
            f = hz(m + d)
            s += sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 5))
    s = lfilter(b_pad, a_pad, s)
    return s * np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.3) / (len(ms) * 3)


def epiano(ms, dur=0.35):
    """エレピ（やわらかい鍵盤）の和音。裏拍の「ポン」に使う"""
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for m in ms:
        f = hz(m)
        s += np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.08))
    return s * env(n, 0.003, 0.18) / len(ms)


def guitar(m, dur=0.4):
    """ギター風の音（弦をはじいた音を簡単に作る）"""
    n = int(dur * SR); period = max(2, int(SR / hz(m)))
    buf = rng.uniform(-1, 1, period); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.5 * (buf[i % period] + buf[(i + 1) % period]) * 0.996
    return out * env(n, 0.001, 0.25)


def strum(ms, dur=0.35, down=True):
    order = ms if down else ms[::-1]
    n = int((dur + 0.05) * SR); s = np.zeros(n)
    for k, m in enumerate(order):
        g = guitar(m, dur); i = int(k * 0.012 * SR)
        s[i:i + len(g)] += g[: n - i]
    return s / len(ms)


def whistle(m, dur):
    """口笛のようなやわらかいメロディの音（少しビブラート）"""
    n = int(dur * SR); t = np.arange(n) / SR
    f = hz(m) * (1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.15))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.08 * rng.standard_normal(n) * 0.1
    return s * np.minimum(1, t / 0.04) * np.minimum(1, (dur - t) / 0.06)


def hat():
    n = int(0.05 * SR)
    return lfilter(b_hp, a_hp, rng.standard_normal(n)) * env(n, 0.001, 0.015)


def key_click():
    n = int(0.03 * SR)
    return lfilter(b_click, a_click, rng.standard_normal(n)) * env(n, 0.0005, 0.006)


def low_bonk():
    n = int(0.3 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (180 - 60 * t) * t) * env(n, 0.003, 0.09)


def shimmer(t0, add, notes, gain):
    for k, m in enumerate(notes):
        add(bell(m, 0.7), t0 + k * 0.05, pan=-0.4 + 0.2 * k, gain=gain)


# 5曲（作者が OK を出した1曲目を基準に、同じ雰囲気で和音・メロディ・調・楽器を変えたもの）。すべて長調の三和音だけ
# arp：(和音の何番目の音, 何オクターブ上げるか) を8つ。motif：(拍, 音) の短いベルのメロディ（2小節ごと）
VARIANTS = [
    # --- 残した3曲（作者 2026-10-03「きらきら・まえむき・かろやか を残す」）---
    # 1曲目（基準・作者 OK）：D → A → G → A
    dict(name='1_きらきら', bpm=120, inst='pluck', chords=[(38, [62, 66, 69]), (45, [61, 64, 69]), (43, [62, 67, 71]), (45, [61, 64, 69])],
         arp=[(0, 12), (1, 12), (2, 12), (0, 24), (2, 12), (1, 12), (2, 12), (1, 24)], motif=[(0, 74), (0.5, 76), (1, 78), (2, 81), (3, 78)]),
    # かろやか：C → G → F → G
    dict(name='2_かろやか', bpm=122, inst='pluck', chords=[(36, [60, 64, 67]), (43, [59, 62, 67]), (41, [60, 65, 69]), (43, [59, 62, 67])],
         arp=[(0, 12), (1, 12), (2, 12), (1, 12), (0, 24), (2, 12), (1, 12), (2, 12)], motif=[(0, 79), (1, 76), (1.5, 77), (2, 79), (3, 84)]),
    # まえむき：G → D → C → D
    dict(name='3_まえむき', bpm=124, inst='pluck', chords=[(43, [62, 67, 71]), (38, [62, 66, 69]), (36, [60, 64, 67]), (38, [62, 66, 69])],
         arp=[(0, 12), (0, 24), (1, 12), (2, 12), (0, 12), (2, 24), (1, 12), (2, 12)], motif=[(0, 79), (0.5, 81), (1, 83), (1.5, 86), (3, 83)]),
    # --- 新しい3曲（同じ明るさで、リズムのノリと楽器を変えて違いがわかるように）---
    # はずむ（作り直し 2026-10-03：1回目は「きらきらと同じに聞こえる」と言われた）：
    #   電子音の分散和音をやめ、ギター風のカッティング（跳ねるリズム）＋口笛のようなメロディ＋はずむベース。G → C → D → C
    dict(name='4_はずむ', bpm=112, inst='none', swing=0.64, guitar=True, whistle=True,
         chords=[(43, [55, 59, 62, 67]), (36, [55, 60, 64, 67]), (38, [57, 62, 66, 69]), (36, [55, 60, 64, 67])],
         arp=[(0, 0)], motif=[],
         lead=[(0, 79), (0.64, 81), (1, 83), (2, 86), (2.64, 83), (3, 81), (4, 79), (5, 76), (5.64, 79), (6, 81), (7, 79)]),
    # ひろがる：ゆったり大きなノリ（キックは1拍目と3拍目の前だけ・3拍目に手拍子）＋細かくきらめく16分の分散和音。E♭ → B♭ → A♭ → B♭
    dict(name='5_ひろがる', bpm=124, inst='pluck', drums='half', arp16=True, arp_gain=0.6,
         chords=[(39, [63, 67, 70]), (46, [62, 65, 70]), (44, [63, 68, 72]), (46, [62, 65, 70])],
         arp=[(0, 12), (1, 12), (2, 12), (0, 24), (1, 24), (2, 12), (1, 12), (0, 12)], motif=[(0, 75), (1, 79), (2, 82), (2.5, 84), (3, 82)]),
    # わくわく：3・3・2 の弾むリズムの分散和音＋エレピの和音を2拍目と4拍目に。B♭ → F → E♭ → F
    dict(name='6_わくわく', bpm=120, inst='pluck', stabs=[1, 3], syncopate=True,
         chords=[(46, [62, 65, 70]), (41, [60, 65, 69]), (39, [63, 67, 70]), (41, [60, 65, 69])],
         arp=[(0, 12), (1, 12), (2, 12), (0, 24), (2, 12), (1, 12), (2, 24), (1, 12)], motif=[(0, 77), (0.75, 79), (1.5, 81), (2, 84), (3, 82)]),
]


def variant_for(day):
    """日替わり：日付で曲を順番に使う（横長と縦長は同じ日なら同じ曲）"""
    return day.toordinal() % len(VARIANTS)


def build(p, layout, variant=0):
    # 2026-10-05：台本は replay_timeline.py が作って replay.json の timelines に入れている。それをそのまま使う
    # （担当の小さな画面・直しの赤緑・2つの画面の比較も、そこで計算済み）。古い記録（timelines 無し）だけ上の timeline() で計算
    tl = (p.get('timelines') or {}).get(layout)
    if tl:
        events = [(int(fr), kind) for fr, kind in tl['events']]
        total_frames = tl['total']
    else:
        events, total_frames = timeline(p, layout)
    total = total_frames / FPS
    N = int(SR * (total + 0.3))
    L = np.zeros(N); R = np.zeros(N)

    def add(sig, t, pan=0.0, gain=1.0):
        i = int(t * SR)
        if i >= N or i < 0:
            return
        sig = sig[: N - i] * gain
        L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2)
        R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2)

    # ---- 曲（VARIANTS から1曲。日替わり）----
    v = VARIANTS[variant % len(VARIANTS)]
    bpm = v['bpm']
    beat = 60 / bpm; bar = beat * 4
    inst = marimba if v['inst'] == 'marimba' else pluck
    for b in range(int(np.ceil(total / bar)) + 1):
        t0 = b * bar
        root, tones = v['chords'][b % len(v['chords'])]
        add(warm_pad(tones, bar), t0, gain=0.22)
        add(np.sin(2 * np.pi * hz(root) * np.arange(int(bar * SR)) / SR) * np.minimum(1, np.arange(int(bar * SR)) / SR / 0.05) * np.exp(-np.arange(int(bar * SR)) / SR / 1.2), t0, gain=0.16)
        if v.get('arp16'):  # 16分で細かくきらめく
            times = [k * beat / 4 for k in range(16)]
        elif v.get('syncopate'):  # 3・3・2 のノリ（16分で 0,3,6,8,11,14 ...）
            times = [k * beat / 4 for k in (0, 3, 6, 8, 11, 14, 16 + 0, 16 + 3)][:8]
            times = [x for x in times if x < bar]
        else:  # 8分（swing があれば跳ねる）
            sw = v.get('swing', 0.5)
            times = [(e // 2) * beat + (sw * beat if e % 2 else 0) for e in range(8)]
        if v.get('inst') == 'none':
            times = []
        for e, t_off in enumerate(times):
            idx, octave = v['arp'][e % len(v['arp'])]
            m = tones[idx] + octave
            t = t0 + t_off
            add(inst(m, 0.25), t, pan=-0.25 + 0.06 * (e % 8), gain=(0.07 if e % 2 == 0 else 0.05) * v.get('arp_gain', 1))
            add(inst(m, 0.25), t + beat * 0.5, pan=0.35, gain=0.015)  # ほんの少しだけ響き
        if v.get('guitar'):  # 跳ねるカッティング（下・上・下・上…）
            sw = v.get('swing', 0.5)
            for q in range(4):
                add(strum(tones, 0.3, True), t0 + q * beat, pan=-0.3, gain=0.16)
                add(strum(tones, 0.2, False), t0 + q * beat + sw * beat, pan=-0.3, gain=0.09)
            add(np.sin(2 * np.pi * hz(root + 12) * np.arange(int(beat * SR)) / SR) * env(int(beat * SR), 0.003, 0.15), t0 + 1.64 * beat, gain=0.12)
        if v.get('whistle') and b % 2 == 0:  # 2小節で1つのメロディ
            lead = v['lead']
            for k, (off, m) in enumerate(lead):
                nxt = lead[k + 1][0] if k + 1 < len(lead) else 8
                add(whistle(m, min(0.9, (nxt - off) * beat * 0.9)), t0 + off * beat, pan=0.15, gain=0.06)
        for st in v.get('stabs', []):  # エレピの和音
            add(epiano([x + 12 for x in tones]), t0 + st * beat, pan=-0.15, gain=0.09)
        if b % 2 == 1:
            for off, m in v['motif']:
                add(bell(m, 0.6), t0 + off * beat, pan=0.1, gain=0.045)
        if v.get('drums') == 'half':  # ゆったり大きなノリ
            add(kick(0.8), t0, gain=0.3); add(kick(0.8), t0 + 2.5 * beat, gain=0.2)
            add(clap(), t0 + 2 * beat, gain=0.09)
            for q in range(8):
                add(hat(), t0 + q * beat / 2, pan=0.3, gain=0.05 if q % 2 else 0.03)
        else:
            sw = v.get('swing', 0.5)
            for q in range(4):
                add(kick(0.8), t0 + q * beat, gain=0.28 if q % 2 == 0 else 0.18)
                add(hat(), t0 + q * beat + sw * beat, pan=0.3, gain=0.06)
            add(clap(), t0 + beat, gain=0.07); add(clap(), t0 + 3 * beat, gain=0.07)

    # ---- 効果音 ----
    for fr, kind in events:
        t = fr / FPS
        if kind == 'type':
            add(key_click(), t + rng.uniform(0, 0.02), pan=rng.uniform(-0.2, 0.2), gain=0.18)
        elif kind == 'line':
            add(key_click(), t, gain=0.09)
        elif kind == 'tool':
            add(key_click(), t, gain=0.12); add(key_click(), t + 0.05, gain=0.08)
        elif kind == 'code':
            add(key_click(), t, gain=0.06)
        elif kind == 'error':
            add(low_bonk(), t, gain=0.22)
        elif kind == 'lanes':  # 担当（サブエージェント）が同時に動き始める：短い上がる3音
            shimmer(t, add, [79, 84, 88], 0.06)
        elif kind == 'pass':
            shimmer(t, add, [84, 88, 91], 0.07)
        elif kind == 'done':
            shimmer(t, add, [84, 88, 91, 96], 0.08)
        elif kind == 'result':
            n = int(0.6 * SR); tt = np.arange(n) / SR
            add(lfilter(b_lp, a_lp, rng.standard_normal(n)) * np.sin(np.pi * tt / 0.6) ** 2, t - 0.2, gain=0.12)
            shimmer(t + 0.2, add, [91, 96, 100], 0.05)

    mix = np.stack([L, R], axis=1)
    tt = np.arange(N) / SR
    mix *= (np.minimum(1, tt / 0.6) * np.clip((total - tt) / 1.5, 0, 1))[:, None]
    mix = np.tanh(mix * 1.1)
    mix *= 0.32 / max(1e-9, np.max(np.abs(mix)))  # 小さめ（ピーク約 -10dB）
    return mix


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--props', required=True)
    ap.add_argument('--layout', choices=['wide', 'tall'], required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--variant', type=int, default=None, help='曲の番号（0〜4）。省略すると今日の日付で日替わり')
    a = ap.parse_args()
    p = json.load(open(a.props, encoding='utf-8'))
    if a.variant is None:
        import datetime, zoneinfo
        a.variant = variant_for(datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Tokyo')).date())
    mix = build(p, a.layout, a.variant)
    wavfile.write(a.out, SR, (mix * 32767).astype(np.int16))
    print(f"ok {a.out} {len(mix) / SR:.1f}s layout={a.layout} 曲={VARIANTS[a.variant % len(VARIANTS)]['name']}")
