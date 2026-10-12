"""作業動画の「作業」を本当に行う（クラウド・作業動画の日だけ）。

計画（work-plan.json または sns-draft.json）の demo に書かれた架空のサンプルファイルを作業フォルダに置き、
Claude Code（CLI）に demo.task を頼んで、その記録（stream-json）を残す。
うまくいったら記録を作業動画の props（replay.json）に変える。

2026-10-05 作者「毎回同じ流れの動画は意味がない。その日の話題の機能そのものを本当に試して、その動きを見せる」
- 使う道具は計画で選ぶ（demo.tools）：Agent（担当分け＝サブエージェントが同時に動く）・Skill（公式スキル）など。
  記録には担当ごとの動きが parent_tool_use_id 付きで流れる（--forward-subagent-text）
- モデルも計画で選べる（demo.model：sonnet / opus / haiku）
- 2通りを比べる計画（demo.compare）なら、同じ頼みごとをもう1回（別の条件で）動かして、両方の記録を残す
- 変わらないこと：Claude Code に渡す環境変数は最小限（PATH・HOME・言語・Claude の鍵だけ）。Google やメールの鍵は渡さない。
  ネット検索・pip・find などは最初から無い／自動で断られる（dontAsk）
- うまくいかなかったとき（やって見せられない・エラーで終わった・結果のファイルが無い）は
  GITHUB_OUTPUT に demo_ok=false を書き、理由を demo_reason に入れる（パターン動画に切り替わる）

使い方：python run_demo.py <計画.json> <作業用の親フォルダ> <replay.json の出力先>
"""
import json
import os
import re
import shutil
import subprocess
import sys

from sns_common import write_output

HERE = os.path.dirname(os.path.abspath(__file__))
TIMEOUT = 300                                   # 1回の作業は5分まで（計画の max_minutes で 2〜6 分に変えられる）
BASE_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash']
BASE_ALLOWED = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(python3 *)', 'Bash(ls *)', 'Bash(cat *)', 'Bash(wc *)']
EXTRA_TOOLS = {'Agent': ['Agent'], 'Skill': ['Skill'], 'TodoWrite': ['TodoWrite']}  # 計画で選べる道具
MODELS = {'sonnet', 'opus', 'haiku'}


def fail(reason):
    print(f"⚠️ 作業動画は作りません：{reason}")
    write_output('demo_ok', 'false')
    write_output('demo_reason', reason.replace('\n', ' '))
    sys.exit(0)


def place_files(work, files):
    os.makedirs(work, exist_ok=True)
    for rel, content in files.items():
        rel = os.path.normpath(rel)
        if rel.startswith('..') or os.path.isabs(rel):
            continue
        p = os.path.join(work, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(str(content))


def find_result(work, result_file, placed):
    """結果のファイルを探す。計画の名前（「a.md, b.md」のように複数でもよい）→ 無ければ、作業中に新しくできた .md/.txt で一番新しいもの"""
    names = [x.strip() for x in re.split(r'[,、／/]\s*', str(result_file or '')) if x.strip()]
    for n in names:
        p = os.path.join(work, n)
        if os.path.exists(p):
            return p
    cands = []
    for root, _, fs in os.walk(work):
        for f in fs:
            p = os.path.join(root, f)
            rel = os.path.relpath(p, work)
            if rel in placed or rel == 'CLAUDE.md' or not f.lower().endswith(('.md', '.txt', '.csv')):
                continue
            cands.append(p)
    return max(cands, key=os.path.getmtime) if cands else ''


def run_once(name, work_root, task, files, hidden, tools, model, timeout, result_name=''):
    """Claude Code に1回頼む。(events.jsonl の場所, 作業フォルダ, result イベント, 理由) を返す"""
    work = os.path.join(work_root, name)
    place_files(work, files)
    # 技術の条件は CLAUDE.md で渡す（動画に映る頼み方は普通の言葉のまま）。結果のファイル名は必ずここで伝える
    # （10/5 試し：頼み方に名前が無く、Claude が別の名前で書いて「結果のファイルができませんでした」になった）
    with open(os.path.join(work, 'CLAUDE.md'), 'w', encoding='utf-8') as f:
        f.write("# この作業の決まり\n" + (hidden + "\n" if hidden else '')
                + (f"- 最後の結果は必ず `{result_name}` というファイルに書く（これが無いと作業は失敗扱い）\n" if result_name else '')
                + "- 頼まれたこと以外はしない。結果のファイルは人が読んで分かる形（表・一覧・文章）にする\n")
    env = {k: os.environ[k] for k in ('PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'CLAUDE_CODE_OAUTH_TOKEN') if os.environ.get(k)}
    use_tools = BASE_TOOLS + [t for x in tools for t in EXTRA_TOOLS.get(x, [])]
    allowed = BASE_ALLOWED + [t for x in tools for t in EXTRA_TOOLS.get(x, [])]
    events = os.path.join(work_root, f"{name}-events.jsonl")
    # --setting-sources project：使う人の個人設定（広い許可）を読み込まない。作業フォルダには設定が無いので、許可は allowed だけ
    cmd = ['claude', '-p', task, '--model', model, '--output-format', 'stream-json', '--verbose',
           '--setting-sources', 'project', '--tools', ','.join(use_tools), '--permission-mode', 'dontAsk',
           '--allowedTools', ' '.join(allowed), '--max-turns', '40' if 'Agent' in tools else '25']
    if 'Agent' in tools:
        # 担当（サブエージェント）の文章も記録に流す（公式：v2.1.211 以降）。npm で入る版に `--forward-subagent-text` が無く止まったので（10/5 試し）、
        # 環境変数で頼む（無い版では無視されるだけ。担当の道具の動きは既定で流れる）
        env['CLAUDE_CODE_FORWARD_SUBAGENT_TEXT'] = '1'
    print(f"▶ Claude Code に作業を頼みます（{name}・{model}・道具 {'+'.join(tools) or '基本'}）：{task[:80]}…")
    try:
        with open(events, 'w', encoding='utf-8') as out:
            proc = subprocess.run(cmd, cwd=work, env=env, stdin=subprocess.DEVNULL, stdout=out, stderr=subprocess.PIPE, timeout=timeout, text=True)
    except subprocess.TimeoutExpired:
        return events, work, None, f'作業が{timeout // 60}分で終わりませんでした'
    if proc.returncode != 0:
        return events, work, None, f'Claude Code がエラーで止まりました（{proc.stderr.strip()[:200]}）'
    result = None
    for line in open(events, encoding='utf-8'):
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get('type') == 'result':
            result = e
    if not result or result.get('is_error'):
        return events, work, None, '作業が最後まで終わりませんでした'
    return events, work, result, ''


def to_replay(events, work, out_path, title, result_file, task, feature):
    subprocess.run([sys.executable, os.path.join(HERE, 'claude_log_to_replay.py'), events, work, out_path,
                    '--title', title, '--result', result_file, '--prompt', task, '--feature', feature], check=True)
    return json.load(open(out_path, encoding='utf-8'))


def main():
    plan_path, work_root, out_path = sys.argv[1:4]
    draft = json.load(open(plan_path, encoding='utf-8'))
    demo = draft.get('demo') or {}
    if not demo.get('doable'):
        fail(demo.get('reason') or 'その日の話が、やって見せられる作業になりませんでした')
    task = str(demo.get('task', '')).strip()
    files = demo.get('files') or {}
    if not task or not files:
        fail('作業の頼みごと、またはサンプルファイルがありません')
    tools = [t for t in (demo.get('tools') or []) if t in EXTRA_TOOLS]
    model = demo.get('model') if demo.get('model') in MODELS else 'sonnet'
    timeout = max(120, min(360, int(float(demo.get('max_minutes') or 5) * 60)))
    from replay_timeline import honest_feature
    feature = honest_feature(str(demo.get('feature', '')).strip())[:30]  # 2026-10-08：Agent teams と書かれても実際はサブエージェント
    hidden = str(demo.get('hidden_rules', '')).strip()

    name = re.sub(r'[^a-z0-9-]', '', str(demo.get('title', 'demo')).replace('~/', '').lower()) or 'demo'
    result_name = [x.strip() for x in re.split(r'[,、／/]\s*', str(demo.get('result_file') or '')) if x.strip()]
    result_name = result_name[0] if result_name else ''
    events, work, result, why = run_once(name, work_root, task, files, hidden, tools, model, timeout, result_name)
    if why:
        fail(why)
    placed = {os.path.normpath(k) for k in files}
    result_file = find_result(work, demo.get('result_file'), placed)
    if not result_file:
        fail(f"結果のファイル（{demo.get('result_file')}）ができませんでした")
    rp = to_replay(events, work, out_path, f"~/{name}", result_file, task, feature)
    print(f"✅ 作業：{result.get('duration_ms', 0) // 1000} 秒・{result.get('num_turns')} 往復・担当 {len(rp.get('lanes') or [])}")

    # 2通りを比べる（計画にあるときだけ）。失敗したら比べずに1つだけで続ける
    comp = demo.get('compare') or {}
    if comp.get('run_b'):
        rb = comp['run_b']
        name_b = name + '-b'
        task_b = str(rb.get('task') or task).strip()
        tools_b = [t for t in (rb.get('tools') if rb.get('tools') is not None else tools) if t in EXTRA_TOOLS]
        model_b = rb.get('model') if rb.get('model') in MODELS else model
        files_b = rb.get('files') or files
        events_b, work_b, result_b, why_b = run_once(name_b, work_root, task_b, files_b,
                                                     str(rb.get('hidden_rules') or hidden).strip(), tools_b, model_b, timeout, result_name)
        result_file_b = find_result(work_b, rb.get('result_file') or demo.get('result_file'), {os.path.normpath(k) for k in files_b}) if not why_b else ''
        if why_b or not result_file_b:
            print(f"⚠️ 比べる2回目は使いません：{why_b or '結果のファイルができませんでした'}")
        else:
            out_b = out_path.replace('.json', '-b.json')
            rp_b = to_replay(events_b, work_b, out_b, f"~/{name_b}", result_file_b, task_b, feature)
            rp_b.pop('timelines', None)
            rp['compare'] = {'label_a': str(comp.get('label_a') or 'A')[:16], 'label_b': str(comp.get('label_b') or 'B')[:16],
                             'what': str(comp.get('what') or '')[:40], 'b': rp_b}
            print(f"✅ 比べる2回目：{result_b.get('duration_ms', 0) // 1000} 秒・{result_b.get('num_turns')} 往復")
            from replay_timeline import build_timelines
            from claude_log_to_replay import write_brief
            rp['timelines'] = build_timelines(rp)
            json.dump(rp, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            write_brief(rp, out_path)  # 説明文字用の要約にも比較を入れる
    shutil.copy(plan_path, os.path.join(work_root, 'work-plan-used.json'))
    write_output('demo_ok', 'true')


if __name__ == '__main__':
    main()
