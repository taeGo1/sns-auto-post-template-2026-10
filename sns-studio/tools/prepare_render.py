"""下書き（sns-draft.json）から、書き出し用の props を作る。

props/<日付>_<テーマ>.json に bgm の場所を足して保存し、名前を GITHUB_OUTPUT の name に書く。
使い方：python prepare_render.py <sns-draft.json>
"""
import json
import os
import re
import sys

from sns_common import STUDIO, today_jst, write_output


def main():
    draft = json.load(open(sys.argv[1], encoding='utf-8'))
    # 「.」も除く（2026-10-05：テーマ「Opus5.5モデル選び」の「.」を Remotion が拡張子と誤認し、カルーセルの書き出しで止まった）
    theme = re.sub(r'[\\/:*?"<>|.\s]+', '', str(draft.get('theme', 'SNS下書き')))[:20] or 'SNS下書き'
    name = f"{today_jst().strftime('%Y-%m-%d')}_{theme}"
    props = dict(draft['props'])
    props['pattern'] = draft['pattern']
    props['bgm'] = f"bgm/{name}.wav"
    import settings  # 動画に出す名前（settings.yml の account）
    acc = settings.load()['account']
    props['handle'] = acc.get('name_on_video') or ''
    props['handle_wide'] = acc.get('name_on_wide_video') or props['handle']
    os.makedirs(os.path.join(STUDIO, 'props'), exist_ok=True)
    path = os.path.join(STUDIO, 'props', f"{name}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(props, f, ensure_ascii=False, indent=1)
    print(f"✅ props：{path}")
    write_output('name', name)


if __name__ == '__main__':
    main()
