"""動画の段（sns-studio/tools）で共通に使うもの。"""
import datetime
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
STUDIO = os.path.join(ROOT, 'sns-studio')
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

JST = datetime.timezone(datetime.timedelta(hours=9))
CREDENTIAL_PATTERN = r'(?!x)x'  # 経歴・実績の検査（テンプレートでは使わない＝何にも当たらない）

PATTERNS = ['howto', 'naruhodo', 'compare']  # 最初は3つ。自分で型を足したら、ここにも足す（rules/型を自分で作る.md）
PATTERN_LABELS = {
    'breaking': '速報', 'howto': 'ノウハウ', 'naruhodo': 'なるほど', 'insight': '考察', 'compare': 'ビフォーアフター',
    'kinetic': 'テンポ', 'ngok': 'NG→OK', 'ranking': 'ランキング', 'quiz': 'クイズ', 'pov': 'POV',
}
# src/brand.ts の THEMES と同じ値（リールの長さの計算に使う）
PATTERN_BPM = {
    'breaking': 160, 'howto': 128, 'naruhodo': 140, 'compare': 108, 'kinetic': 150,
    'ngok': 132, 'ranking': 120, 'quiz': 140, 'pov': 124, 'insight': 84,
}


def today_jst():
    return datetime.datetime.now(JST).date()


def write_output(key, value):
    path = os.environ.get('GITHUB_OUTPUT')
    if path:
        with open(path, 'a', encoding='utf-8') as f:
            f.write(f"{key}={value}\n")
