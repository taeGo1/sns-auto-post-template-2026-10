"""説明文字（explain_work.md が記録から書いたもの）を、作業動画の記録（replay.json）に付ける（2026-10-05）。

作者「その動きを見せて、それを説明する文字を入れる」。説明は記録にある出来事だけ。
- 1つ 22字まで・8つまで。番号（block）が記録の範囲内のものだけ
- 説明に出てくる数字と英字の言葉は、記録（頼みごと・行・ファイル名・担当名・結果）の中に実際にあるものだけ。無ければその説明は落とす
- 付けたあと、台本（timelines）を作り直す

使い方：python attach_notes.py <replay.json> <notes.json>
notes.json の形：{"feature": "使った機能（30字まで）", "notes": [{"block": 2, "text": "3人の担当が同時に動き始めた"}, …], "verdict": "比べた結果の1行（compare のときだけ）"}
"""
import json
import re
import sys

from replay_timeline import build_timelines

MAX_NOTES, MAX_LEN = 8, 22


def corpus(rp):
    parts = [rp.get('prompt', ''), rp.get('resultFile', ''), rp.get('feature', ''), ' '.join(rp.get('resultPreview') or [])]
    for b in (rp.get('blocks') or []) + [lb for ln in rp.get('lanes') or [] for lb in ln.get('blocks') or []]:
        parts += [str(b.get(k, '')) for k in ('text', 'label', 'summary')]
        parts += b.get('lines') or []; parts += b.get('added') or []; parts += b.get('removed') or []
    parts += [ln.get('name', '') + ' ' + ln.get('summary', '') for ln in rp.get('lanes') or []]
    comp = (rp.get('compare') or {}).get('b')
    if comp:
        parts.append(json.dumps(comp, ensure_ascii=False))
    parts.append(str(rp.get('realSeconds', '')))
    parts.append(str(len(rp.get('lanes') or [])))  # 「3つの担当」の 3
    return ' '.join(parts).lower()


def ok_note(text, corp):
    if not text or len(text) > MAX_LEN:
        return False, f"長さ（{len(text)}字）"
    for num in re.findall(r'\d+', text):
        if num not in corp:
            return False, f"記録に無い数字 {num}"
    for word in re.findall(r'[A-Za-z][A-Za-z0-9_.\-]{2,}', text):
        if word.lower() not in corp:
            return False, f"記録に無い言葉 {word}"
    return True, ''


def main():
    rp_path, notes_path = sys.argv[1:3]
    rp = json.load(open(rp_path, encoding='utf-8'))
    try:
        nt = json.load(open(notes_path, encoding='utf-8'))
    except Exception as e:
        print(f"⚠️ 説明文字を読めませんでした（{e}）。説明なしで続けます")
        nt = {}
    corp = corpus(rp)
    kept, dropped = [], []
    n_blocks = len(rp.get('blocks') or [])
    for x in (nt.get('notes') or [])[:MAX_NOTES * 2]:
        text = str(x.get('text', '')).strip()
        bi = x.get('block')
        if not isinstance(bi, int) or not (0 <= bi < n_blocks):
            dropped.append((text, f"番号 {bi} が範囲外")); continue
        good, why = ok_note(text, corp)
        (kept if good else dropped).append((bi, text) if good else (text, why))
        if len(kept) >= MAX_NOTES:
            break
    rp['notes'] = [{'block': bi, 'text': text} for bi, text in kept]
    feat = str(nt.get('feature', '')).strip()
    if feat and len(feat) <= 30:
        rp['feature'] = feat
    from replay_timeline import honest_feature
    rp['feature'] = honest_feature(rp.get('feature', ''))  # 2026-10-08：Agent teams とは書かない（動いたのはサブエージェント）
    if rp.get('compare') and nt.get('verdict'):
        v = str(nt['verdict']).strip()
        good, why = ok_note(v, corp)
        if good:
            rp['compare']['verdict'] = v
        else:
            dropped.append((v, why))
    rp['timelines'] = build_timelines(rp)
    json.dump(rp, open(rp_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"✅ 説明文字 {len(kept)} 件を付けました" + (f"／落とした {len(dropped)} 件：" + '；'.join(f"「{t}」{w}" for t, w in dropped) if dropped else ''))


if __name__ == '__main__':
    main()
