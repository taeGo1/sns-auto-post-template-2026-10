"""Claude Code の実際の作業記録（stream-json）を、作業動画（TerminalReplay）の props に変える。

作業は本物。画面の見た目だけを Claude Code らしく再現して再生する（ロゴは描かない）。
2026-10-05：記録に出てくるものを全部描けるようにした（作者「毎回同じ流れの動画は意味がない。機能そのものを動かして、その動きを見せる」）
- 担当（サブエージェント・Agent ツール）：parent_tool_use_id で担当ごとに分け、lanes に入れる（担当ごとの小さな画面が同時に進む）
- 直し（Edit）：消した行（removed）と足した行（added）
- 画像を読んだ（Read の png/jpg）：「画像を読みました」
- スキル（Skill）・そのほかの道具：名前と中身を短く
台本（何コマ目にどの行が出るか）は replay_timeline.py が作り、同じファイルの timelines に入れる

使い方：python claude_log_to_replay.py <events.jsonl> <作業フォルダ> <out.json> [--title "見出し"] [--result 結果ファイル] [--prompt 頼みごと] [--feature 使った機能]
"""
import argparse
import json
import os
import re

from replay_timeline import build_timelines

MAX_RESULT_LINES = 5
MAX_WRITE_LINES = 9
MAX_EDIT_LINES = 4
IMAGE_EXT = ('.png', '.jpg', '.jpeg', '.gif', '.webp')


def rel(path, root):
    """作業フォルダからの相対パスに（別の場所で記録を読み直すときは、作業フォルダ名のあとだけを使う）"""
    if path and path.startswith(root):
        return os.path.relpath(path, root)
    marker = '/' + os.path.basename(root.rstrip('/')) + '/'
    return path.split(marker, 1)[1] if path and marker in path else path


def short(s, n=70):
    s = s.replace('\n', ' ').strip()
    return s if len(s) <= n else s[:n - 1] + '…'


def tool_label(name, inp, root):
    if name in ('Read', 'Write', 'Edit'):
        return f"{name}({rel(inp.get('file_path', ''), root)})"
    if name == 'Bash':
        cmd = inp.get('command', '')
        cmd = cmd.replace(root + '/', '').replace(root, '.')
        cmd = re.sub(r'\s*2>&1', '', cmd).split('&&')[0].strip()
        return f"Bash({short(cmd, 48)})"
    if name in ('Glob', 'Grep'):
        return f"{name}({short(inp.get('pattern', ''), 40)})"
    if name == 'Agent':
        return f"Agent({short(inp.get('description') or inp.get('subagent_type') or '担当', 24)})"
    if name == 'Skill':
        return f"Skill(/{inp.get('skill', '')})"
    if name in ('TodoWrite', 'TaskCreate', 'TaskUpdate'):
        return f"{name}()"
    key = next((k for k in ('description', 'query', 'pattern', 'url', 'prompt') if inp.get(k)), None)
    return f"{name}({short(str(inp.get(key, '')), 30)})" if key else f"{name}()"


def result_lines(text):
    lines = [l for l in text.replace('\r', '').split('\n') if l.strip()]
    lines = [re.sub(r'^\s*\d+\t', '', l) for l in lines]  # Read の行番号
    return lines


def lane_name(inp):
    """担当の名前：Agent ツールの description（「デザイン担当」など）から。無ければ subagent_type"""
    name = (inp.get('description') or inp.get('subagent_type') or '担当').strip()
    name = re.sub(r'[（(].*$', '', name)  # 「デザイン担当（LP の…）」→「デザイン担当」
    return short(name, 14)


def apply_result(b, c):
    """tool_result をブロックに反映する"""
    x = c.get('content')
    x = x if isinstance(x, str) else ' '.join(i.get('text', '') for i in (x or []) if isinstance(i, dict))
    lines = result_lines(x)
    b['ok'] = not c.get('is_error') and not (lines and lines[0].startswith('Exit code') and lines[0] != 'Exit code 0')
    name = b['name']
    if name == 'Read':
        b['summary'] = '画像を読みました' if b.get('image') else f"{len(lines)} 行を読みました"
    elif name == 'Write':
        pass
    elif name == 'Edit':
        b['summary'] = '直しました' if b['ok'] else '直せませんでした'
    elif name == 'Agent':
        # 担当の最後の報告：パスやコードの行は飛ばして、最初の文章の行を使う
        good = [l for l in lines if not l.lstrip().startswith(('`', '/', '#', '-', '*', '|')) and '/home/' not in l and '/Users/' not in l]
        b['summary'] = short((good or lines)[0], 60) if lines else '完了'
    elif name == 'Skill':
        b['summary'] = 'スキルを読み込みました'
    else:
        oks = [l for l in lines if l.rstrip().endswith('... ok')]
        if oks:  # unittest の結果はまとめて見せる
            b['pass'] = len(oks)  # 先に数える（下で lines に足すため）
            b['lines'] = ([short(l, 60) for l in oks[:3]] + [f"… ほか {len(oks) - 3} 件 ok"]) if len(oks) > 3 else list(oks)
            b['lines'] += [l for l in lines if l.startswith('Ran ') or l.strip() == 'OK']
        elif b['label'].startswith('Bash(ls'):  # ファイル名だけ（持ち主・日時は出さない）
            names = [l.split()[-1] for l in lines if l.split() and l.split()[-1] not in ('.', '..') and not l.startswith('total')]
            b['lines'] = [' '.join(n for n in names if not n.startswith('-'))][:1]
        else:
            b['lines'] = [short(l, 60) for l in lines[:MAX_RESULT_LINES]]


def make_block(c, root):
    inp = c.get('input') or {}
    b = {'type': 'tool', 'label': tool_label(c['name'], inp, root), 'name': c['name'], 'lines': [], 'ok': True}
    if c['name'] == 'Write':
        content = str(inp.get('content', '')).split('\n')
        b['added'] = content[:MAX_WRITE_LINES]
        b['summary'] = f"{len(content)} 行を書きました"
    elif c['name'] == 'Edit':
        b['removed'] = str(inp.get('old_string', '')).split('\n')[:MAX_EDIT_LINES]
        b['added'] = str(inp.get('new_string', '')).split('\n')[:MAX_EDIT_LINES]
    elif c['name'] == 'Read' and str(inp.get('file_path', '')).lower().endswith(IMAGE_EXT):
        b['image'] = os.path.basename(str(inp.get('file_path', '')))
    return b


def parse(events_path, root, prompt=''):
    blocks, pending, lanes, lane_of = [], {}, [], {}  # lane_of: 親の tool_use_id → lanes の番号
    duration_ms, out_tokens, turns = 0, 0, 0
    for line in open(events_path, encoding='utf-8'):
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        t = e.get('type')
        parent = e.get('parent_tool_use_id')
        if t == 'assistant':
            if parent and parent not in lane_of:  # 親の tool_use を見ていないのに担当の記録が来た
                lane_of[parent] = len(lanes); lanes.append({'name': '担当', 'blocks': [], 'summary': '', 'ok': True})
            target = lanes[lane_of[parent]]['blocks'] if parent else blocks
            for c in e['message']['content']:
                if c['type'] == 'text' and c['text'].strip():
                    first = c['text'].strip().split('\n\n')[0]
                    target.append({'type': 'text', 'text': short(first, 110)})
                elif c['type'] == 'tool_use':
                    b = make_block(c, root)
                    if c['name'] == 'Agent' and not parent:
                        lane_of[c['id']] = len(lanes)
                        lanes.append({'name': lane_name(c.get('input') or {}), 'blocks': [], 'summary': '', 'ok': True})
                        b['lane'] = lane_of[c['id']]
                    pending[c['id']] = b
                    target.append(b)
        elif t == 'user':
            content = e['message'].get('content')
            if isinstance(content, str):
                continue
            for c in content or []:
                if not (isinstance(c, dict) and c.get('type') == 'tool_result'):
                    continue
                b = pending.get(c.get('tool_use_id'))
                if not b:
                    continue
                apply_result(b, c)
                if b['name'] == 'Agent' and b.get('lane') is not None:
                    lanes[b['lane']]['summary'] = b.get('summary', '')
                    lanes[b['lane']]['ok'] = b['ok']
        elif t == 'user_prompt':
            prompt = e.get('text', '') or prompt
        elif t == 'result':
            duration_ms = e.get('duration_ms', 0)
            out_tokens = (e.get('usage') or {}).get('output_tokens', 0)
            turns = e.get('num_turns', 0)
    return {'prompt': prompt, 'blocks': blocks, 'lanes': lanes, 'realSeconds': round(duration_ms / 1000),
            'outputTokens': out_tokens, 'turns': turns}


def preview(path):
    if path and os.path.exists(path):
        return open(path, encoding='utf-8').read().split('\n')[:22]
    return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('events'); ap.add_argument('root'); ap.add_argument('out')
    ap.add_argument('--title', default=''); ap.add_argument('--result', default='')
    ap.add_argument('--hook', default='')
    ap.add_argument('--prompt', default='')
    ap.add_argument('--feature', default='')
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    rec = parse(a.events, root, a.prompt)
    props = {
        'title': a.title,
        'hook': a.hook.replace('\\n', '\n'),
        'prompt': rec['prompt'],
        'blocks': rec['blocks'],
        'lanes': rec['lanes'],
        'realSeconds': rec['realSeconds'],
        'outputTokens': rec['outputTokens'],
        'turns': rec['turns'],
        'resultFile': os.path.basename(a.result) if a.result else '',
        'resultPreview': preview(a.result),
        'feature': a.feature,
        'notes': [],
    }
    props['timelines'] = build_timelines(props)
    json.dump(props, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    write_brief(props, a.out)
    print(f"blocks {len(props['blocks'])} / 担当 {len(props['lanes'])} / 実時間 {props['realSeconds']} 秒 → {a.out}")


def write_brief(props, out_path):
    """説明文字を書く Claude 用の短い要約（replay.json は台本入りで大きく、読むだけで往復が尽きた・10/5）。<out>-brief.json に書く"""
    def blk(i, b):
        d = {'block': i, 'type': b['type'], 'what': b.get('label') or b.get('text', '')}
        for k in ('summary', 'pass', 'image'):
            if b.get(k):
                d[k] = b[k]
        if b.get('lines'):
            d['lines'] = b['lines'][:3]
        if b.get('ok') is False:
            d['error'] = True
        if b.get('lane') is not None:
            d['lane'] = b['lane']
        return d
    brief = {
        'prompt': props.get('prompt'), 'feature': props.get('feature'), 'realSeconds': props.get('realSeconds'),
        'blocks': [blk(i, b) for i, b in enumerate(props.get('blocks') or [])],
        'lanes': [{'lane': i, 'name': l.get('name'), 'steps': [(x.get('label') or x.get('text', ''))[:60] for x in l.get('blocks') or []], 'summary': l.get('summary', '')}
                  for i, l in enumerate(props.get('lanes') or [])],
        'resultFile': props.get('resultFile'), 'resultPreview': (props.get('resultPreview') or [])[:10],
    }
    comp = props.get('compare') or {}
    if comp.get('b'):
        b = comp['b']
        brief['compare'] = {'what': comp.get('what'), 'label_a': comp.get('label_a'), 'label_b': comp.get('label_b'),
                            'a_seconds': props.get('realSeconds'), 'b_seconds': b.get('realSeconds'),
                            'b_lanes': [l.get('name') for l in b.get('lanes') or []], 'b_steps': [(x.get('label') or x.get('text', ''))[:50] for x in b.get('blocks') or []][:12]}
    json.dump(brief, open(out_path.replace('.json', '-brief.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
