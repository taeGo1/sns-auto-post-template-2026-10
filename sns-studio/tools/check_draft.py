"""SNS下書き（sns-draft.json）を機械で検査する。

- errors：書き直しが必要なもの（形が壊れている・文字数を大きく超える・実績や Lovart の混入など）
- warnings：書き出しはできるが、社長に見てもらいたいもの（メールの「要確認・検査」に載る）
文字数は SNSの型.md の表に合わせる。半角は0.5字として数える。

使い方：python check_draft.py <sns-draft.json> <結果.json>
GITHUB_OUTPUT に ok=true / ok=false を書く。
"""
import json
import re
import sys

from sns_common import CREDENTIAL_PATTERN, PATTERNS, PATTERN_BPM, write_output

TOLERANCE = 1.5  # 1行の字数はこれだけ超えても警告まで（見本の props がこの範囲に収まる）

DIAGRAM_KINDS = {'chat', 'brief', 'flow', 'image', 'punch', 'number', 'compare', 'cards', 'ngok', 'rank', 'quiz', 'pov'}
SCENE_KINDS = {'hook', 'point', 'list', 'question', 'answer', 'cta', 'todo'} | DIAGRAM_KINDS  # todo＝やることはこれ（2026-10-05）
CTA_PARTS = {'save', 'like', 'follow', 'line', 'comment', 'share', 'profile'}
NG_WORDS = ['——']  # 使わない言葉（長いダッシュ）。足したいときはここに


def width(s):
    return sum(0.5 if ord(c) < 0x2E80 else 1 for c in s)


class Checker:
    def __init__(self):
        self.errors, self.warnings = [], []

    def lines(self, where, text, max_lines=None, max_chars=None):
        if not text:
            return
        ls = str(text).split('\n')
        if max_lines and len(ls) > max_lines:
            self.errors.append(f"{where}：{len(ls)}行（{max_lines}行まで）「{text}」")
        if max_chars:
            for l in ls:
                w = width(l)
                if w > max_chars + TOLERANCE:
                    self.errors.append(f"{where}：1行{w:g}字（{max_chars}字まで）「{l}」")
                elif w > max_chars:
                    self.warnings.append(f"{where}：1行{w:g}字（目安{max_chars}字）「{l}」")

    def items(self, where, items, min_n, max_n, max_chars):
        if not isinstance(items, list) or not (min_n <= len(items) <= max_n):
            self.errors.append(f"{where}：{len(items) if isinstance(items, list) else 0}個（{min_n}〜{max_n}個）")
            return
        for i, it in enumerate(items):
            self.lines(f"{where}[{i + 1}]", it, None, max_chars)

    def mark(self, where, text, mark):
        if mark and text and mark.replace('\n', '') not in str(text).replace('\n', ''):
            self.warnings.append(f"{where}：マーカーの言葉「{mark}」が本文に無い（線が引かれない）")


def check(draft):
    c = Checker()
    for key in ['theme', 'pattern', 'props', 'captions']:
        if key not in draft:
            c.errors.append(f"「{key}」がありません")
    if c.errors:
        return c
    props = draft['props']
    pattern = props.get('pattern')
    if pattern not in PATTERNS:
        c.errors.append(f"型「{pattern}」は使えません（{', '.join(PATTERNS)}）")
    if pattern != draft['pattern']:
        c.errors.append(f"外側の pattern「{draft['pattern']}」と props.pattern「{pattern}」が違います")
    if not re.fullmatch(r"[^\\/:*?\"<>|\n]{1,20}", str(draft['theme'])):
        c.errors.append(f"theme「{draft['theme']}」は20字以内・記号なしにしてください")

    # カルーセル
    slides = props.get('carousel', {}).get('slides', [])
    if not (4 <= len(slides) <= 8):
        c.errors.append(f"カルーセル：{len(slides)}枚（4〜8枚）")
    for i, s in enumerate(slides):
        w = f"カルーセル{i + 1}枚目（{s.get('type')}）"
        t = s.get('type')
        if t == 'cover':
            c.lines(w + 'title', s.get('title'), 3, 9); c.lines(w + 'sub', s.get('sub'), None, 18)
            c.mark(w, s.get('title', '') + s.get('sub', ''), s.get('mark'))
        elif t in ('question', 'answer'):
            c.lines(w + 'title', s.get('title'), 3, 11)
            if t == 'answer':
                c.mark(w, s.get('title', '') + s.get('body', ''), s.get('mark'))
        elif t == 'point':
            c.lines(w + 'title', s.get('title'), 2, 10); c.lines(w + 'body', s.get('body'), 3, 18)
            c.mark(w, s.get('title', '') + s.get('body', ''), s.get('mark'))
        elif t == 'list':
            c.lines(w + 'title', s.get('title'), 2, None); c.items(w + 'items', s.get('items'), 3, 5, 14)
        elif t == 'cta':
            c.lines(w + 'title', s.get('title'), None, 10)
        elif t == 'todo':
            c.lines(w + 'title', s.get('title'), 2, 11); c.items(w + 'items', s.get('items'), 1, 3, 13); c.lines(w + 'say', s.get('say'), 2, 15)
        else:
            c.errors.append(f"{w}：type「{t}」は使えません")
    if slides and slides[-1].get('type') != 'cta':
        c.warnings.append("カルーセル：最後の1枚が cta ではありません")
    # 2026-10-05 作者「具体的に何をしたらいいか、最後にもう一度案内する」：cta の直前に「やることはこれ」の1枚
    if len(slides) >= 2 and slides[-2].get('type') != 'todo':
        c.errors.append("カルーセル：最後の cta の直前に type: todo（やることはこれ：手順1〜3つ＋こう頼む）の1枚を入れてください")

    # リール
    scenes = props.get('reel', {}).get('scenes', [])
    # 2026-10-07 作者「中身が薄い。時間を伸ばして、なるほど！と思える内容に」→ 7〜10場面・35〜45秒（前は 4〜7場面・15〜30秒）
    if not (7 <= len(scenes) <= 10):
        (c.errors if not (6 <= len(scenes) <= 11) else c.warnings).append(f"リール：{len(scenes)}場面（7〜10場面）")
    bpm = PATTERN_BPM.get(pattern, 120)
    total = 0.0
    diagrams = 0
    for i, s in enumerate(scenes):
        k = s.get('kind', 'point')
        w = f"リール{i + 1}場面目（{k}）"
        if k not in SCENE_KINDS:
            c.errors.append(f"{w}：kind「{k}」は使えません"); continue
        if k == 'image':
            c.errors.append(f"{w}：クラウドでは画像の素材が無いので image は使えません")
        if k in DIAGRAM_KINDS or k in ('question', 'answer'):  # なるほど の「？」「！」も絵として数える
            diagrams += 1
        total += (s['beats'] * 60 / bpm) if s.get('beats') else s.get('seconds', 3)
        text = s.get('text', '')
        if k == 'hook':
            c.lines(w, text, 3, 8)
        elif k == 'point':
            c.lines(w, text, 2, 9); c.lines(w + 'sub', s.get('sub'), None, 16)
        elif k == 'list':
            c.lines(w, text, None, 9); c.items(w + 'items', s.get('items'), 1, 4, 10)
        elif k in ('question', 'answer'):
            c.lines(w, text, 2, 9)
        elif k == 'cta':
            c.lines(w, text, 2, 10)
            parts = s.get('cta') or []
            if not (1 <= len(parts) <= 3) or any(p not in CTA_PARTS for p in parts):
                c.errors.append(f"{w}：cta は {sorted(CTA_PARTS)} から1〜3個（いま {parts}）")
        elif k == 'rank':
            c.lines(w, text, 1, 8); c.lines(w + 'sub', s.get('sub'), None, 14)
            if s.get('rank') not in (1, 2, 3):
                c.errors.append(f"{w}：rank は 3・2・1")
        elif k == 'todo':
            c.lines(w, text, 2, 10); c.items(w + 'items', s.get('items'), 1, 3, 12); c.lines(w + 'say', s.get('say'), 2, 14)
        else:
            c.lines(w, text, 2, 10)
        if k == 'chat' or k == 'pov':
            ch = s.get('chat') or {}
            if not ch.get('me') or not ch.get('ai'):
                c.errors.append(f"{w}：chat の me と ai が必要です")
        if k == 'brief':
            c.items(w + 'brief.items', (s.get('brief') or {}).get('items'), 1, 4, 10)
        if k == 'flow':
            c.items(w + 'steps', s.get('steps'), 2, 4, 8)
        if k == 'punch':
            c.items(w + 'words', s.get('words'), 1, 4, 7)
        if k == 'cards':
            c.items(w + 'cards', s.get('cards'), 1, 4, 8)
        if k == 'compare':
            c.lines(w + 'before', s.get('before'), 2, 12); c.lines(w + 'after', s.get('after'), 2, 12)
        if k == 'ngok':
            c.lines(w + 'ng', s.get('ng'), 2, 10); c.lines(w + 'ok', s.get('ok'), 2, 10)
        if k == 'quiz':
            c.lines(w + 'a', s.get('a'), 2, 7); c.lines(w + 'b', s.get('b'), 2, 7)
            if s.get('answer') not in ('a', 'b'):
                c.errors.append(f"{w}：quiz の answer は a か b")
        if k == 'number' and not s.get('value'):
            c.errors.append(f"{w}：number の value が必要です")
        c.mark(w, text + str(s.get('ng', '')) + str(s.get('ok', '')) + str(s.get('sub', '')), s.get('mark'))
    if scenes and scenes[-1].get('kind') != 'cta':
        c.errors.append("リール：最後の場面は kind: cta にしてください")
    # 2026-10-05 作者「なるほど！の部分が欠けている」「具体的に何をしたらいいか、最後にもう一度案内」
    if len(scenes) >= 2 and scenes[-2].get('kind') != 'todo':
        c.errors.append("リール：最後の cta の直前に kind: todo（やることはこれ：手順1〜3つ＋こう頼む）の場面を入れてください")
    need = 4 if len(scenes) >= 8 else 3  # 画像化が少ないと浅く見える（2026-10-05）。長くした分、絵も増やす（2026-10-07）
    if diagrams < need:
        c.errors.append(f"リール：イメージ図の場面が{diagrams}つ（{need}つ以上。chat / brief / flow / compare / ngok / cards などで「何ができるようになるか」を絵で見せる）")
    if not (30 <= total <= 50):
        c.errors.append(f"リール：合計{total:.1f}秒（35〜45秒）")
    elif not (35 <= total <= 45):
        c.warnings.append(f"リール：合計{total:.1f}秒（目安35〜45秒）")
    kinds = [s.get('kind', 'point') for s in scenes]
    for i in range(len(kinds) - 2):
        if kinds[i] == kinds[i + 1] == kinds[i + 2] and kinds[i] not in ('quiz', 'rank'):
            c.warnings.append(f"リール：{kinds[i]} が3回続いています")
    # 2026-10-07：同じ絵の場面を続けると、同じことを2回言っているように見える（10/07 は ngok が2回続いた）。ランキング・クイズは続いてよい
    for i in range(len(kinds) - 1):
        if kinds[i] == kinds[i + 1] and kinds[i] in DIAGRAM_KINDS and kinds[i] not in ('quiz', 'rank'):
            c.errors.append(f"リール：{i + 1}・{i + 2}場面目が同じ {kinds[i]} です。別の見せ方（flow・cards・chat・compare など）に変えてください")

    # キャプション
    caps = draft['captions']
    for key in ['instagram_reel', 'instagram_carousel', 'threads', 'tiktok']:
        if not caps.get(key):
            c.errors.append(f"キャプション「{key}」がありません")
    th = caps.get('threads', '')
    if len(th) > 500:
        c.errors.append(f"Threads：{len(th)}字（500字まで）")
    for key, lo, hi in [('instagram_reel', 100, 300), ('instagram_carousel', 300, 800)]:
        body = re.sub(r'#\S+', '', caps.get(key, '')).strip()
        tags = re.findall(r'#\S+', caps.get(key, ''))
        if body and not (lo * 0.8 <= len(body) <= hi * 1.2):
            c.warnings.append(f"{key}：本文{len(body)}字（目安{lo}〜{hi}字）")
        if tags and not (3 <= len(tags) <= 5):
            c.warnings.append(f"{key}：ハッシュタグ{len(tags)}個（3〜5個）")

    # 中身の禁止事項（実績・Lovart・ダッシュ）
    everything = json.dumps(props, ensure_ascii=False) + '\n' + '\n'.join(str(v) for v in caps.values())
    for ng in NG_WORDS:
        if ng in everything:
            c.errors.append(f"使わない言葉「{ng}」が入っています")
    m = re.search(CREDENTIAL_PATTERN, everything)
    if m:
        c.errors.append(f"実績・経歴が入っています（「{m.group(0)}」）。Instagram・Threads では出しません")
    c.total_seconds = total
    return c


def main():
    draft_path, result_path = sys.argv[1], sys.argv[2]
    try:
        draft = json.load(open(draft_path, encoding='utf-8'))
        c = check(draft)
    except Exception as e:  # JSON が壊れているなど
        c = Checker(); c.errors.append(f"下書きファイルを読めません：{e}"); c.total_seconds = 0
    result = {'ok': not c.errors, 'errors': c.errors, 'warnings': c.warnings,
              'total_seconds': round(getattr(c, 'total_seconds', 0), 1)}
    json.dump(result, open(result_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f"検査：エラー{len(c.errors)}件・注意{len(c.warnings)}件")
    for e in c.errors:
        print('  ❌', e)
    for w in c.warnings:
        print('  ⚠️', w)
    write_output('ok', 'true' if not c.errors else 'false')


if __name__ == '__main__':
    main()
