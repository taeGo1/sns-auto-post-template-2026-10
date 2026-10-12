"""ページの本文・Google ニュース・RSS を読む（集める先は settings.yml で決める）"""
import re
import requests
import defusedxml.ElementTree as ET
from html.parser import HTMLParser
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime



def _strip_html(text: str) -> str:
    """HTMLタグを除去してプレーンテキストにする"""
    text = re.sub(r'<[^>]+>', '', text or '')
    return ' '.join(text.split())


def _days_ago(pubdate_str: str):
    """RSS の pubDate 文字列から「何日前の記事か」を計算。失敗したら None。"""
    try:
        dt = parsedate_to_datetime(pubdate_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - dt
        return max(0, delta.days)
    except Exception:
        return None


def _days_ago_iso(s: str):
    """Atom の日時（2026-10-03T20:19:57Z など）から「何日前か」。失敗したら None。"""
    try:
        dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0, (datetime.now(timezone.utc) - dt).days)
    except Exception:
        return None


class _HTMLTextExtractor(HTMLParser):
    """script/style/nav などを除いたページ本文テキストを抽出する"""
    _SKIP_TAGS = {'script', 'style', 'nav', 'footer', 'head', 'noscript'}

    def __init__(self):
        super().__init__()
        self._parts = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP_TAGS:
            self._skip = True

    def handle_endtag(self, tag):
        if tag in self._SKIP_TAGS:
            self._skip = False

    def handle_data(self, data):
        if not self._skip:
            s = data.strip()
            if s:
                self._parts.append(s)

    def get_text(self):
        return '\n'.join(self._parts)


def fetch_page_text(url: str, max_chars: int = 4000) -> str:
    """指定URLのページ本文テキストを取得して返す"""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        extractor = _HTMLTextExtractor()
        extractor.feed(resp.text)
        text = ' '.join(extractor.get_text().split())
        return text[:max_chars]
    except Exception as e:
        return f"[取得失敗: {e}]"


def fetch_article_text(url: str, max_chars: int = 3000) -> str:
    """ページの本文だけを読む（2026-10-12）。<article> か <main> があればその中だけ（メニューの文字で字数を使い切らない）。
    Adobe 公式ブログは記事の .plain.html から。情報収集（collect_info.py）と、選んだ話題の本文を読む段（build_candidates.py）で共通。"""
    import html as _html
    u = url + ".plain.html" if "blog.adobe.com" in url and not url.endswith(".html") else url
    r = requests.get(u, timeout=20, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    r.raise_for_status()
    h = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", r.text)
    boxes = [b for tag in ("article", "main") for b in re.findall(rf"(?is)<{tag}[^>]*>(.*?)</{tag}>", h)]
    boxes = [b for b in boxes if len(b) > 500]
    if boxes:  # 本文の箱がいくつかあるときは、いちばん長いもの（横の欄の小さな箱を本文と取り違えない）
        h = max(boxes, key=len)
    else:
        h = re.sub(r"(?is)<(nav|header|footer)[^>]*>.*?</\1>", " ", h)
    return re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()[:max_chars]


def fetch_google_news(keywords_ja, keywords_en, max_items: int = 8) -> list[dict]:
    """Google ニュースの検索結果（見出しと日付だけ）。話題を見つけるために使う。本文は取れない。"""
    articles, seen = [], set()
    searches = [(q, "hl=ja&gl=JP&ceid=JP:ja") for q in (keywords_ja or [])] + [(q, "hl=en-US&gl=US&ceid=US:en") for q in (keywords_en or [])]
    for query, locale in searches:
        try:
            url = f"https://news.google.com/rss/search?q={requests.utils.quote(query + ' when:3d')}&{locale}"  # 直近3日の記事だけ（関連の古い記事が混ざらないように）
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            for item in root.findall('.//item')[:max_items]:
                title = item.findtext('title', '').strip()
                pub = item.findtext('pubDate', '').strip()
                if title and title not in seen:
                    seen.add(title)
                    articles.append({"title": title, "pubDate": pub, "days_ago": _days_ago(pub), "source": "Google ニュース：" + query, "summary": ""})
        except Exception as e:
            print(f"   Google ニュースの取得に失敗（{query}）: {e}")
    print(f"   Google ニュース：{len(articles)}件")
    return articles


def fetch_rss(feeds, max_items_per_feed: int = 6) -> list[dict]:
    """RSS（公式ブログ・信頼できるメディア）を読む。feeds は [{"name": "表示名", "url": "RSS の URL"}]。要約があるので書く材料にもなる。"""
    articles = []
    for f in feeds or []:
        name, url = f.get("name", f.get("url", "")), f.get("url", "")
        try:
            resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}, timeout=15)
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            items = root.findall('.//item')
            if not items:  # Atom 形式（<entry>）
                ns = {'a': 'http://www.w3.org/2005/Atom'}
                for ent in root.findall('a:entry', ns)[:max_items_per_feed]:
                    title = (ent.findtext('a:title', '', ns) or '').strip()
                    pub = (ent.findtext('a:published', '', ns) or ent.findtext('a:updated', '', ns) or '').strip()
                    desc = _strip_html(ent.findtext('a:summary', '', ns) or ent.findtext('a:content', '', ns) or '')
                    link = ent.find('a:link', ns)
                    if title:
                        articles.append({"source": name, "title": title, "pubDate": pub, "days_ago": _days_ago_iso(pub),
                                         "summary": desc[:300], "url": link.get('href', '') if link is not None else ''})
                continue
            for item in items[:max_items_per_feed]:
                title = item.findtext('title', '').strip()
                pub = item.findtext('pubDate', '').strip()
                if title:
                    articles.append({"source": name, "title": title, "pubDate": pub, "days_ago": _days_ago(pub),
                                     "summary": _strip_html(item.findtext('description', ''))[:300], "url": item.findtext('link', '').strip()})
        except Exception as e:
            print(f"   RSS の取得に失敗（{name}）: {e}")
    print(f"   RSS：{len(articles)}件")
    return articles
