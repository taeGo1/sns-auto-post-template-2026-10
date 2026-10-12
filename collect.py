"""① 集める：話題の材料を集めて sns-context.json に書く。

集める先は、⓪の段で AI が「読む人」に合わせて決めたもの（sources.json）と、settings.yml に自分で書いたもの。
投稿済みの記録は posted.json（同じ話題を続けて選ばないため）。
使い方：python collect.py <出力する sns-context.json> [sources.json]
"""
import datetime
import json
import os
import re
import sys

import settings
from scrapers import fetch_google_news, fetch_rss

JST = datetime.timezone(datetime.timedelta(hours=9))
HERE = os.path.dirname(os.path.abspath(__file__))


def merged_sources(cfg_collect, sources_path):
    """settings.yml に書いた集める先（必ず入れる）＋ ⓪の段が決めた集める先"""
    src = {}
    if sources_path and os.path.exists(sources_path):
        try:
            src = json.load(open(sources_path, encoding="utf-8"))
        except Exception as e:
            print(f"   ⚠️ 集める先（sources.json）を読めませんでした：{e}")
    def uniq(xs):
        return list(dict.fromkeys(x for x in xs if x))
    rss, seen = [], set()
    for f in (cfg_collect.get("rss") or []) + (src.get("rss") or []):
        if f.get("url") and f["url"] not in seen:
            seen.add(f["url"])
            rss.append(f)
    return {
        "field": src.get("field", ""),
        "ja": uniq((cfg_collect.get("news_keywords_ja") or []) + (src.get("news_keywords_ja") or [])),
        "en": uniq((cfg_collect.get("news_keywords_en") or []) + (src.get("news_keywords_en") or [])),
        "rss": rss,
        "evidence_domains": uniq(src.get("evidence_domains") or []),
    }


def main(out_path, sources_path=""):
    cfg = settings.load()
    c = cfg["collect"]
    window = int(c.get("window_days") or 7)
    today = datetime.datetime.now(JST).date()
    s = merged_sources(c, sources_path)
    print(f"=== ① 集める（{today}）分野：{s['field'] or '（未設定）'} ===")
    print(f"   検索語：{'・'.join(s['ja'] + s['en']) or 'なし'}")
    print(f"   RSS：{'・'.join(f.get('name', '') for f in s['rss']) or 'なし'}")

    news = [a for a in fetch_google_news(s["ja"], s["en"]) if a.get("days_ago") is not None and a["days_ago"] <= 2]  # 見出しは2日前まで（分野によって新しい記事が少ないため）
    official_names = {f.get("name", f.get("url")) for f in s["rss"] if f.get("official")}
    feeds_all = [a for a in fetch_rss(s["rss"]) if a.get("days_ago") is not None and a["days_ago"] <= window]
    feeds = [a for a in feeds_all if a["days_ago"] <= 1]

    try:
        posted = json.load(open(os.path.join(HERE, "posted.json"), encoding="utf-8")).get("posts", [])
    except FileNotFoundError:
        posted = []
    past = []
    for p in posted:
        try:
            d = datetime.datetime.strptime(str(p.get("date", "")), "%Y/%m/%d").date()
        except ValueError:
            continue
        if 0 <= (today - d).days <= window:
            past.append({"date": p.get("date"), "theme": p.get("theme", "")})

    # 本文（要約）がある今日・昨日の話題
    hot = [{"title": a["title"], "source": a.get("source", ""), "press": a.get("source", ""), "days_ago": a["days_ago"],
            "score": 1, "summary": (a.get("summary") or "")[:300], "official_evidence": a.get("source") in official_names,
            "url": a.get("url", "")} for a in feeds]
    hot_titles = {h["title"] for h in hot}
    # 見出しだけの話題（ニュースの検索）
    heads = [{"title": a["title"], "source": a["source"], "days_ago": a["days_ago"], "score": 1, "summary": "", "url": "",
              "press_trusted": False} for a in news if a["title"] not in hot_titles]
    # 数日前（2日前〜）の公式のお知らせ：静かな日に「使い方の案内」として選べるように
    themes = " ".join(p["theme"] for p in past)
    official_recent = [{"title": a["title"], "source": a["source"], "days_ago": a["days_ago"], "url": a.get("url", ""),
                        "summary": (a.get("summary") or "")[:300], "body": a.get("summary") or "",
                        "posted_recently": a["title"] if a["title"] and a["title"][:12] in themes else ""}
                       for a in feeds_all if a["days_ago"] >= 2 and a.get("source") in official_names]

    # tonmana.md の「使ってよい数字」（プロフィール・実績）も材料に入れる（事実の照合で消されないように）
    profile = ""
    try:
        t = open(os.path.join(HERE, "tonmana.md"), encoding="utf-8").read()
        sec = t.split("## 使ってよい数字", 1)[1] if "## 使ってよい数字" in t else ""
        sec = re.split(r"\n## ", sec, 1)[0]
        profile = re.sub(r"<!--.*?-->", "", sec, flags=re.S).split("\n", 1)[-1].strip()
    except FileNotFoundError:
        pass

    ctx = {
        "today": today.strftime("%Y年%m月%d日"), "today_iso": today.isoformat(), "post_time": "morning", "field": s["field"],
        "post_length_max": cfg["post"]["length_max"], "post_length_min": cfg["post"]["length_min"],
        "hot_topics": hot, "topic_candidates": heads, "official_recent": official_recent,
        "media_articles": feeds, "rss_articles": news,
        "ai_sources": [{"name": "プロフィール（tonmana.md の使ってよい数字）", "text": profile}] if profile else [],
        "primary_evidence": [], "evidence_domains": s["evidence_domains"] + [re.sub(r"^(www|rss|feeds?)\.", "", re.sub(r"^https?://([^/]+).*$", r"\1", f["url"])) for f in s["rss"]],
        "past_posts": past, "past_themes_7days": past,
    }
    json.dump(ctx, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✅ 材料：本文あり {len(hot)}件・見出しだけ {len(heads)}件・数日前の公式 {len(official_recent)}件・投稿済み {len(past)}件 → {out_path}")
    if not (hot or heads or official_recent):
        print("⚠️ 話題が1件も集まりませんでした。prompts/reader.md（読む人）か settings.yml（集める先）を書くと集まるようになります")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
