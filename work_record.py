"""「本当に試す」の記録を、X の材料（sns-context.json）に足す（2026-10-04）。

replay.json（sns-studio/tools/claude_log_to_replay.py が作る作業記録）を読み、
人が読める形の要約 `work_record` を context に書き込む。X の投稿1はこれを「本当にやったらこうなった」の根拠に使う。
失敗したとき（replay.json が無い）は `work_record = {"ok": false, "reason": …}` を書く（投稿は公式の原文だけで書く）。
2026-10-05：使った機能（feature）・担当ごとの動き（lanes）・比べた結果（compare）・説明文字（notes）も足す

使い方：python work_record.py <sns-context.json> <replay.json> [<work-plan.json>] [--reason "失敗の理由"]
"""
import json
import os
import re
import sys


def summarize(rp):
    steps, written, tests_passed, errors, edits = [], [], 0, 0, 0
    for b in rp.get('blocks', []):
        if b.get('type') != 'tool':
            continue
        label = b.get('label', '')
        summ = b.get('summary', '')
        if b.get('name') == 'Write':
            m = re.search(r'(\d+) 行', summ or '')
            fname = re.sub(r'^Write\((.*)\)$', r'\1', label)
            written.append({'file': fname, 'lines': int(m.group(1)) if m else None})
        if b.get('name') == 'Edit':
            edits += 1
        if b.get('pass'):
            tests_passed += int(b['pass'])
        if b.get('ok') is False:
            errors += 1
        steps.append((label + ('：' + summ if summ else '')).strip())
    lanes = [{'name': ln.get('name', ''), 'steps': len([x for x in ln.get('blocks') or [] if x.get('type') == 'tool']),
              'summary': ln.get('summary', '')} for ln in rp.get('lanes') or []]
    return {
        'task': rp.get('prompt', ''),
        'steps': steps[:20],
        'files_written': written,
        'edits': edits,
        'tests_passed': tests_passed,
        'errors_then_fixed': errors,
        'real_seconds': rp.get('realSeconds'),
        'result_file': rp.get('resultFile', ''),
        'result_preview': (rp.get('resultPreview') or [])[:12],
        'lanes': lanes,
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    reason = ''
    if '--reason' in sys.argv:
        reason = sys.argv[sys.argv.index('--reason') + 1]
    ctx_path, replay_path = args[0], args[1]
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sns-studio', 'tools'))
    global _honest
    try:
        from replay_timeline import honest_feature as _honest
    except Exception:
        _honest = lambda f: f
    plan_path = args[2] if len(args) > 2 else ''
    ctx = json.load(open(ctx_path, encoding='utf-8'))
    plan = {}
    if plan_path and os.path.exists(plan_path):
        try:
            plan = json.load(open(plan_path, encoding='utf-8'))
        except Exception:
            plan = {}
    demo = plan.get('demo') or {}

    if not os.path.exists(replay_path):
        if not plan and not reason:  # 計画が無い＝今日は試さない日（パターン動画）。失敗ではない（2026-10-05）
            reason = '今日は試さない日（パターン動画の日）'
        ctx['work_record'] = {'ok': False, 'reason': reason or demo.get('reason') or '作業が最後まで終わりませんでした',
                              'planned_task': demo.get('task', ''),
                              'topic': plan.get('topic', '')}  # 2026-10-08：試せなかった日も、投稿1はこの話題（計画が決めた話題）
        json.dump(ctx, open(ctx_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f"⚠️ 本当に試した記録なし：{ctx['work_record']['reason']}")
        return

    rp = json.load(open(replay_path, encoding='utf-8'))
    rec = {'ok': True, 'topic': plan.get('topic', ''), 'why': demo.get('reason', ''), 'scene': demo.get('scene', ''),
           'can_do': plan.get('can_do', ''), 'ideas': (plan.get('ideas') or [])[:3], 'watch': demo.get('watch', ''),
           'feature': _honest(rp.get('feature') or demo.get('feature', '')), **summarize(rp),
           'notes': [n.get('text', '') for n in rp.get('notes') or []],
           'note': 'データは架空のサンプル。数字（本数・件数・秒数）は実際の作業記録どおり。現実の効果の数字ではない。'
                   '使った機能は feature のとおりに書く（使っていない機能を使ったことにしない）'}
    rec['task'] = rec['task'] or demo.get('task', '')
    comp = rp.get('compare') or {}
    if comp.get('b'):
        rec['compare'] = {'what': comp.get('what', ''), 'label_a': comp.get('label_a', 'A'), 'label_b': comp.get('label_b', 'B'),
                          'a': {'real_seconds': rp.get('realSeconds'), 'result_preview': (rp.get('resultPreview') or [])[:8]},
                          'b': {**summarize(comp['b']), 'result_preview': (comp['b'].get('resultPreview') or [])[:8]},
                          'verdict': comp.get('verdict', '')}
    ctx['work_record'] = rec
    json.dump(ctx, open(ctx_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f"✅ 本当に試した記録：{rec['real_seconds']}秒・書いたファイル {len(rec['files_written'])}・担当 {len(rec['lanes'])}・"
          f"直し {rec['edits']}・テスト合格 {rec['tests_passed']}・結果 {rec['result_file']}・機能 {rec['feature'] or '（未記入）'}")


if __name__ == '__main__':
    main()
