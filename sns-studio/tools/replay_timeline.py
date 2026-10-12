"""作業動画の台本（何フレーム目に、どの行が出るか）を1か所で計算する（2026-10-05）。

- replay.json（claude_log_to_replay.py が作る記録）から、横長・縦長それぞれの台本 `timelines` を作って同じファイルに書く
- TerminalReplay.tsx は timelines[layout] をそのまま描く。make_work_bgm.py は timelines[layout].events から音を置く
  （以前は TSX と Python で同じ計算を2回書いていて「片方を変えたらもう片方も」が必要だった。いまはここだけ）
- 記録に出てくるものをそのまま形にする：担当（サブエージェント）が複数動けば担当ごとの小さな画面が同時に進む、
  直し（Edit）は赤（消した行）と緑（足した行）、2通りを比べた記録（compare）は2つの画面が並ぶ、
  説明文字（notes・explain_work.md が記録から書く）は、その場面の頭に出る

使い方：python replay_timeline.py <replay.json>   … timelines を作り直して上書き
"""
import json
import sys

FPS = 30

# 画面の寸法ごとの「1行の字数」と「見える行数」。TerminalReplay.tsx の LAYOUTS と同じ値にする
LAYOUTS = {
    'wide': {'cols': 104, 'rows': 18, 'lane_cols': 32, 'lane_rows': 10, 'pane_cols': 50, 'pane_rows': 18},
    'tall': {'cols': 52, 'rows': 25, 'lane_cols': 48, 'lane_rows': 5, 'pane_cols': 52, 'pane_rows': 10},
}

# 色は名前で持ち、TSX 側で実際の色に置き換える
USER, TEXT, DIM, GREEN, RED, YELLOW = 'user', 'text', 'dim', 'green', 'red', 'yellow'



def honest_feature(feature):
    """「使った機能」の名前を、実際に動いた道具に合わせて正す（2026-10-08）。
    クラウドの作業で担当分けに使うのは Agent ツール＝サブエージェント。Agent teams（実験的・既定で無効）は動かしていないので、
    計画や説明文字が「Agent teams」と書いても「サブエージェント（担当分け）」に直す（10/08 朝、キャプションに「Agent teams」と出た）。"""
    import re as _re
    f = str(feature or '').strip()
    if _re.search(r'agent\s*teams?|エージェント\s*チーム|担当チーム', f, _re.I):
        return 'サブエージェント（担当分け）'
    return f

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


def cut(s, cols):
    return s if width(s) <= cols else wrap(s, cols - 1)[0] + '…'


class Pane:
    """1つの画面（ターミナル）の台本"""

    def __init__(self, cols):
        self.cols = cols
        self.rows = []        # {t, c, bg?, b?, s, n}
        self.events = []      # (frame, kind)  音の位置
        self.callouts = []    # {at, text, color, kind}
        self.lane_panels = [] # {start, end, lanes:[{name, rows, done, summary}]}
        self.block_start = [] # 本流のブロック i が出始めるフレーム（説明文字の位置に使う）
        self.f = 18

    def add(self, text, color, frames, bg=None, bold=False, rows=None):
        (rows if rows is not None else self.rows).append(
            {'t': text, 'c': color, **({'bg': bg} if bg else {}), **({'b': True} if bold else {}), 's': self.f, 'n': frames})

    def block(self, b, cols, rows=None, events=None):
        """ブロック1つ分の行を足す（本流でも担当の小さな画面でも同じ）"""
        ev = events if events is not None else self.events
        if b.get('type') == 'text':
            if b.get('text'):
                for l in wrap('● ' + b['text'].replace('`', ''), cols):
                    self.add(l, TEXT, 8, rows=rows); ev.append((self.f, 'line')); self.f += 6
                self.f += 6
            return
        bad = b.get('ok') is False
        self.add(cut('● ' + (b.get('label') or ''), cols), RED if bad else GREEN, 6, bold=True, rows=rows)
        ev.append((self.f, 'tool')); self.f += 9
        for l in b.get('removed') or []:  # 直し：消した行（赤）
            self.add(cut('   - ' + l, cols), RED, 2, bg='delBg', rows=rows); ev.append((self.f, 'code')); self.f += 3
        for i, l in enumerate(b.get('added') or []):  # 書いた・足した行（緑）
            self.add(cut(f"  {str(i + 1).rjust(2)} + {l}", cols), GREEN, 2, bg='addBg', rows=rows); ev.append((self.f, 'code')); self.f += 3
        if b.get('summary'):
            self.add(cut('  ⎿ ' + b['summary'], cols), DIM, 4, rows=rows); self.f += 5
        for l in b.get('lines') or []:
            c = RED if bad else GREEN if (l.endswith(' ok') or l.strip() == 'OK') else DIM
            self.add(cut('  ⎿ ' + l, cols), c, 3, rows=rows); self.f += 4
        if bad:
            self.callouts.append({'at': self.f, 'text': 'エラー → 自分で別の方法に切り替え', 'color': RED, 'kind': 'auto'}); ev.append((self.f, 'error')); self.f += 34
        if b.get('pass'):
            self.callouts.append({'at': self.f, 'text': f"テスト {b['pass']}件 すべて合格", 'color': GREEN, 'kind': 'auto'}); ev.append((self.f, 'pass')); self.f += 34
        self.f += 8


def schedule_pane(rec, layout, cols, lane_cols, notes):
    """記録1つ（本流＋担当）の台本"""
    p = Pane(cols)
    for l in wrap('> ' + (rec.get('prompt') or ''), cols - 2):
        p.add(l, USER, 14, bg='userBg', bold=True)
        for k in range(0, 14, 2):
            p.events.append((p.f + k, 'type'))
        p.f += 14
    p.f += 12
    blocks = rec.get('blocks') or []
    lanes = rec.get('lanes') or []
    i = 0
    while i < len(blocks):
        b = blocks[i]
        if b.get('type') == 'tool' and b.get('name') == 'Agent' and b.get('lane') is not None:
            # 担当（サブエージェント）がまとまって動く：本流に「● Agent(…)」を並べ、担当ごとの小さな画面を同時に進める
            group = []
            while i < len(blocks) and blocks[i].get('type') == 'tool' and blocks[i].get('name') == 'Agent' and blocks[i].get('lane') is not None:
                p.block_start.append(p.f)
                p.add(cut('● ' + (blocks[i].get('label') or ''), cols), GREEN, 6, bold=True); p.events.append((p.f, 'tool')); p.f += 9
                group.append(blocks[i]); i += 1
            start = p.f + 6
            panel = {'start': start, 'end': start, 'lanes': []}
            for gb in group:
                lane = lanes[gb['lane']] if gb['lane'] < len(lanes) else {'name': '担当', 'blocks': []}
                p.f = start
                lane_rows = []
                for lb in lane.get('blocks') or []:
                    p.block(lb, lane_cols, rows=lane_rows)
                summary = lane.get('summary') or ''
                p.add('✓ 完了' + (('：' + cut(summary, lane_cols - 6)) if summary else ''), GREEN, 4, bold=True, rows=lane_rows); p.f += 6
                panel['lanes'].append({'name': lane.get('name') or '担当', 'rows': lane_rows, 'done': p.f, 'summary': summary})
                panel['end'] = max(panel['end'], p.f)
            n = len(panel['lanes'])
            p.callouts.append({'at': start + 8, 'text': f"{n}つの担当が同時に作業中" if n > 1 else f"担当「{panel['lanes'][0]['name']}」が作業中", 'color': GREEN, 'kind': 'auto'})
            p.events.append((start, 'lanes'))
            p.lane_panels.append(panel)
            p.f = panel['end'] + 10
            for ln in panel['lanes']:
                p.add(cut(f"  ⎿ {ln['name']}：完了" + (f"（{ln['summary']}）" if ln['summary'] else ''), cols), DIM, 4); p.f += 5
            p.events.append((p.f, 'pass')); p.f += 20
            continue
        p.block_start.append(p.f)
        p.block(b, cols)
        i += 1
    work_end = p.f
    p.callouts.append({'at': p.f, 'text': f"{rec['resultFile']} が完成" if rec.get('resultFile') else '完成', 'color': YELLOW, 'kind': 'auto'})
    p.events.append((p.f, 'done'))
    result_start = p.f + 18
    p.events.append((result_start, 'result'))
    total = result_start + (120 if rec.get('resultPreview') else 30)
    # 説明文字（explain_work.md が記録から書いたもの）：そのブロックが出始めるところに。
    # 同時に動く担当の分は同じ頃に出るので、前の札から 42 コマ以上あけてずらす（10/5 4回目：4枚が一度に積み上がった）
    last = -999
    for nt in sorted((n for n in notes or [] if isinstance(n.get('block'), int)), key=lambda n: n['block']):
        bi = nt['block']
        if 0 <= bi < len(p.block_start) and nt.get('text'):
            at = max(p.block_start[bi] + 6, last + 42)
            p.callouts.append({'at': at, 'text': nt['text'], 'color': YELLOW, 'kind': 'note'})
            last = at
    return {'rows': p.rows, 'lanePanels': p.lane_panels, 'callouts': p.callouts, 'events': p.events,
            'workEnd': work_end, 'resultStart': result_start, 'total': total, 'blockStart': p.block_start}


def build_timelines(replay):
    out = {}
    for layout, L in LAYOUTS.items():
        comp = replay.get('compare')
        if comp and comp.get('b'):
            a = schedule_pane(replay, layout, L['pane_cols'], L['lane_cols'], replay.get('notes'))
            b = schedule_pane(comp['b'], layout, L['pane_cols'], L['lane_cols'], comp.get('notes'))
            panes = [a, b]
            total = max(a['total'], b['total'])
            # 両方終わったあとに「どちらが…」の説明文字（compare.verdict・記録の数字から機械で作る）
            callouts = [{**c, 'pane': 0} for c in a['callouts']] + [{**c, 'pane': 1} for c in b['callouts']]
            if comp.get('verdict'):
                callouts.append({'at': max(a['workEnd'], b['workEnd']) + 6, 'text': comp['verdict'], 'color': YELLOW, 'kind': 'note', 'pane': -1})
            events = sorted(a['events'] + b['events'])
        else:
            a = schedule_pane(replay, layout, L['cols'], L['lane_cols'], replay.get('notes'))
            panes = [a]; total = a['total']; callouts = [{**c, 'pane': 0} for c in a['callouts']]; events = a['events']
        out[layout] = {'panes': panes, 'callouts': callouts, 'events': events, 'total': total}
    return out


def rebuild(path):
    rp = json.load(open(path, encoding='utf-8'))
    rp['timelines'] = build_timelines(rp)
    json.dump(rp, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return rp


if __name__ == '__main__':
    rp = rebuild(sys.argv[1])
    print('timelines:', {k: f"{v['total']} コマ（{v['total'] / FPS:.1f}秒）" for k, v in rp['timelines'].items()})
