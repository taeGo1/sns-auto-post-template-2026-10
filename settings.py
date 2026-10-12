"""settings.yml を読む（無いところは既定の値）。"""
import os

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULTS = {
    "claude": {"model": "sonnet", "model_choose": "sonnet"},
    "account": {"name_on_video": "@your_account", "name_on_wide_video": "@your_account"},
    "collect": {"news_keywords_ja": [], "news_keywords_en": [], "rss": [], "window_days": 7},
    "post": {"length_max": 1000, "length_min": 280},
}


def load():
    try:
        user = yaml.safe_load(open(os.path.join(HERE, "settings.yml"), encoding="utf-8")) or {}
    except FileNotFoundError:
        user = {}
    out = {}
    for k, v in DEFAULTS.items():
        out[k] = {**v, **(user.get(k) or {})}
    return out
