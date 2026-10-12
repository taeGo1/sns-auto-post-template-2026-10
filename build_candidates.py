"""話題を選ぶ段（prompts/choose_topic.md）に渡す、短い候補の一覧を作る（2026-10-10・2026-10-12 作り直し）。

作者「何度直してもうまくいかない」→ 選ぶ段を短く作り直す。点数は「候補を集めて並べる」ためだけに使い、
選ぶのは AI が1つの質問で決める。材料（sns-context.json）は大きいので、選ぶ段にはこの一覧だけを渡す。

2026-10-12：入口を直す（作者「なぜ、うまく気になる内容をピックアップできないの？」）
- 見出しだけの話題（Google ニュース）も外さずに見せる（kind: headline）。選ぶ段が公式のページを探してリンクを返す
- 直近7日の公式の発表のうち、点数の候補に入らなかったもの全部を見せる（kind: recent_official）。静かな日は、まだ投稿していない数日前のものを「使い方の案内」に（決まり A）
- 選んだ話題を材料に入れるとき、記号の違い（’ と '）で弾かない
使い方：python build_candidates.py <sns-context.json> <topic-candidates.json>
        python build_candidates.py --attach <sns-context.json> <topic-choice.json>
"""
import datetime
import difflib
import json
import re
import sys
from urllib.parse import urlparse

from scrapers import fetch_article_text  # 本文だけを読む（collect_info.py と共通・2026-10-12）

HEADLINE_LIMIT = 10        # 見出しだけの話題（点数の上位）
RECENT_OFFICIAL_LIMIT = 15  # 公式の発表（新しい順）
EVIDENCE_CHARS = 3000

# 選んだ話題の本文を読んでよい場所（大手の報道機関）。ほかに、⓪の段が決めた公式・信頼できるメディア（context.evidence_domains）も使う
EVIDENCE_DOMAINS = (
    "nikkei.com", "nhk.or.jp", "asahi.com", "yomiuri.co.jp", "mainichi.jp", "itmedia.co.jp", "impress.co.jp", "cnet.com",
    "ascii.jp", "mynavi.jp", "reuters.com", "bloomberg.com", "apnews.com", "bbc.co.uk", "theverge.com", "techcrunch.com", "wired.com", "wired.jp",
)


def _norm(t):
    """見出しの照合用：くるっとした記号・全角の空白・連続する空白をそろえる（10/11・10/12：’ と ' の違いで選んだ話題が伝わらなかった）"""
    t = str(t or "")
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("　", " "), ("–", "-"), ("—", "-")):
        t = t.replace(a, b)
    return re.sub(r"\s+", " ", t).strip().lower()


def build(ctx, limit=None):
    rows, seen = [], set()
    for h in ctx.get('hot_topics', []):  # 本文（要約）があり、書ける話題（点数の順）
        t = h.get('title', '')
        if not t or _norm(t) in seen:
            continue
        seen.add(_norm(t))
        rows.append({'kind': 'new', 'title': t, 'source': h.get('press') or h.get('source', ''), 'days_ago': h.get('days_ago'),
                     'score': h.get('score'), 'official': bool(h.get('official_evidence')),
                     'summary': (h.get('summary') or '')[:300]})
    if ctx.get('post_time') != 'night':  # 夜は14時以降の話題（hot_topics）だけ
        n = 0
        for c in ctx.get('topic_candidates', []):  # 見出しだけの話題（本文が取れていない）。選ばれたら公式のページを探す
            t = c.get('title', '')
            if not t or _norm(t) in seen or (c.get('score') or 0) <= 0:
                continue
            seen.add(_norm(t))
            summ = (c.get('summary') or '')[:300]  # 要約がある記事は要約つきで（見出しだけのものは、選ばれたら公式のページを探す）
            rows.append({'kind': 'new' if summ else 'headline', 'title': t, 'source': c.get('source', ''), 'days_ago': c.get('days_ago'),
                         'score': c.get('score'), 'official': False, 'summary': summ})
            n += 1
            if n >= HEADLINE_LIMIT:
                break
        n = 0
        for r in ctx.get('official_recent', []):  # 直近7日の公式の発表で、上に入らなかったもの（静かな日の決まり A）
            t = r.get('title', '')
            if not t or _norm(t) in seen:
                continue
            seen.add(_norm(t))
            row = {'kind': 'recent_official', 'title': t, 'source': r.get('source', ''), 'days_ago': r.get('days_ago'),
                   'score': None, 'official': True, 'summary': (r.get('summary') or '')[:300]}
            if r.get('posted_recently'):
                row['posted_recently'] = r['posted_recently']
            rows.append(row)
            n += 1
            if n >= RECENT_OFFICIAL_LIMIT:
                break
    today = ctx.get('today_iso') or ''
    past = []
    for p in ctx.get('past_themes_7days') or ctx.get('past_posts', []):  # 2026-10-12：7日分のテーマ（無ければ従来の14本）
        try:
            d = datetime.datetime.strptime(str(p.get('date', '')), '%Y/%m/%d').date()
            t0 = datetime.date.fromisoformat(today) if today else d
            if 0 <= (t0 - d).days <= 7:
                past.append({'date': p.get('date'), 'theme': p.get('theme', '')})
        except Exception:
            continue
    return {'today': ctx.get('today'), 'post_time': ctx.get('post_time'), 'field': ctx.get('field', ''), 'evidence_domains': ctx.get('evidence_domains', []),
            'candidates': rows[:limit] if limit else rows, 'past_7days': past}


def _match(title, pool):
    """候補の見出しに合わせる：記号・空白をそろえて同じなら一致。無ければいちばん近い見出し（0.9以上）"""
    nt = _norm(title)
    for p in pool:
        if _norm(p) == nt:
            return p
    best, score = None, 0.0
    for p in pool:
        s = difflib.SequenceMatcher(None, nt, _norm(p)).ratio()
        if s > score:
            best, score = p, s
    return best if score >= 0.9 else None


def attach(ctx_path, choice_path):
    """選んだ話題（topic-choice.json）を材料に入れる。計画・書く段・書き直しの段は、この話題に従う。
    見出しだけの話題・数日前の公式の発表は、ここで本文を読んで一次情報（primary_evidence）に足す（書く段と照合の道具の根拠）。
    本文が読めないときは控え（backups）の順に試す。どれもだめなら入れない（その場合は、従来どおり書く段が選ぶ）。"""
    ctx = json.load(open(ctx_path, encoding='utf-8'))
    try:
        raw = open(choice_path, encoding='utf-8').read()
    except Exception as e:
        print(f"⚠️ 話題を選ぶ段の結果がありません（{e.__class__.__name__}）。書く段が選びます")
        return None
    try:
        ch = json.loads(raw)
    except Exception:
        # 見出しの中の「"」で JSON が壊れることがある（10/10 試し：Claudeで作られた"履歴書"）。1行ずつ取り出す
        ch = {}
        for k in ('topic', 'why', 'reader_use', 'angle', 'evidence_url'):
            m = re.search(r'"' + k + r'"\s*:\s*"(.*)",?\s*$', raw, re.M)
            if m:
                ch[k] = m.group(1)
        print("   （結果の JSON が壊れていたので、行から読み取りました）")
    hot = {h.get('title', ''): h for h in ctx.get('hot_topics', [])}
    heads = {} if ctx.get('post_time') == 'night' else {c.get('title', ''): c for c in ctx.get('topic_candidates', [])}
    recent = {} if ctx.get('post_time') == 'night' else {r.get('title', ''): r for r in ctx.get('official_recent', [])}
    pool = list(hot) + list(heads) + list(recent)
    tries = [ch] + [b for b in (ch.get('backups') or []) if isinstance(b, dict)][:2]
    for i, c in enumerate(tries):
        t = _match(str(c.get('topic', '')).strip(), pool)
        if not t:
            print(f"⚠️ 選んだ話題が候補に見つかりません：{str(c.get('topic', ''))[:60]}")
            continue
        evidence = None
        if t not in hot:  # 見出しだけ・数日前の公式・点数の外の記事：本文を読む
            # 名簿の媒体の記事で要約がある：要約は材料（media_articles）にあるので、本文が読めなくても書ける（読めれば足す）
            trusted_summary = t in heads and bool(heads[t].get('summary')) and bool(heads[t].get('press_trusted'))
            url = str(c.get('evidence_url') or '') or (recent[t].get('url') if t in recent else heads.get(t, {}).get('url', ''))
            host = urlparse(url).netloc.lower()
            domains = EVIDENCE_DOMAINS + tuple(ctx.get('evidence_domains') or [])
            if not url or not any(host == d or host.endswith('.' + d) for d in domains):
                if not trusted_summary:
                    print(f"⚠️ 本文を読める公式・名簿の媒体のページがありません（{host or 'リンクなし'}）：{t[:60]}")
                    continue
                url = ''
            text = ''
            if url:
                try:
                    text = recent[t].get('body') if t in recent and recent[t].get('body') else fetch_article_text(url, EVIDENCE_CHARS)
                except Exception as e:
                    print(f"⚠️ 本文を読めませんでした（{e.__class__.__name__}・{host}）：{t[:60]}")
                    text = ''
            if len(text) < 200 and not trusted_summary:
                print(f"⚠️ 本文が読めない・短すぎます（{len(text)}字・{host or 'リンクなし'}）：{t[:60]}")
                continue
            if len(text) >= 200:
                source = recent[t].get('source') if t in recent else host
                evidence = {"topic": t, "keywords": [w for w in re.findall(r"[A-Z][\w.-]{3,}", t)][:4], "source": source, "url": url, "text": text}
                ctx.setdefault('primary_evidence', []).append(evidence)
        ctx['chosen_topic'] = {'topic': t, 'angle': c.get('angle') or ch.get('angle', 'new'),
                               'why': c.get('why') or ch.get('why', ''), 'reader_use': c.get('reader_use') or ch.get('reader_use', ''),
                               'evidence_url': evidence['url'] if evidence else '', 'others': ch.get('others', [])[:5]}
        json.dump(ctx, open(ctx_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f"✅ 今日の話題{'（控え' + str(i) + '）' if i else ''}：{t[:80]}")
        print(f"   形：{ctx['chosen_topic']['angle']}／理由：{str(ctx['chosen_topic']['why'])[:120]}")
        if evidence:
            print(f"   本文：{evidence['source']}（{len(evidence['text'])}字）{evidence['url']}")
        return ctx['chosen_topic']
    print("⚠️ 選んだ話題をどれも材料に入れられませんでした。書く段が選びます")
    return None


if __name__ == '__main__':
    if sys.argv[1] == '--attach':
        attach(sys.argv[2], sys.argv[3])
        sys.exit(0)
    ctx = json.load(open(sys.argv[1], encoding='utf-8'))
    out = build(ctx)
    json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    kinds = {k: sum(1 for r in out['candidates'] if r['kind'] == k) for k in ('new', 'headline', 'recent_official')}
    print(f"✅ 話題の候補 {len(out['candidates'])} 件（本文あり {kinds['new']}・見出しだけ {kinds['headline']}・数日前の公式 {kinds['recent_official']}）"
          f"・直近7日の投稿 {len(out['past_7days'])} 件 → {sys.argv[2]}")
