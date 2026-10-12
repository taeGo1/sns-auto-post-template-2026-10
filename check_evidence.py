"""投稿案の根拠を機械で照合する（2026-10-03・試し）。AI の判断ではなく、文字どおりの照合。

1. evidence の quote（根拠の原文）が、材料（公式の本文・更新履歴の行・記事の見出しと要約）に本当にあるか
2. 投稿の中の「名前・数字・コマンド」が、材料か根拠の原文に出てくるか（根拠の無い名前・数字を見つける）
3. 投稿の**すべての行**が、次のどれかに当たるか（2026-10-03 追加。根拠の無い文の素通りを止める）
   - 根拠の付いた文（evidence の sentence）の一部
   - 作者の一言・お願い（voice_lines。最後の4行の中・3行まで・体験の形でない・数字や名前を含まない）
   - 出どころの表示（「（〇〇によると）」「（公式 〇〇）」）や、記号だけ・「つまり、」だけのつなぎの行

当たらない行は投稿から**自動で削除**して上書きする（--report-only を付けたときだけ、削除せずに報告だけ）（人に確認を回さない・迷ったら削除）。
削除した行と理由は evidence-check.json に残す。事実チェック（validate_post.md）は、そのあと意味のずれ・言いすぎを見る。
使い方：python check_evidence.py <sns-posts.json> <sns-context.json> <evidence-check.json> [--report-only]
"""
import json
import re
import sys
import unicodedata


def norm(s):
    s = unicodedata.normalize('NFKC', str(s or ''))
    s = s.replace('“', '"').replace('”', '"').replace('’', "'").replace('‘', "'")
    s = s.replace('*', '').replace('`', '')  # Markdown の太字・コードの印は照合で無視する（原文にあって引用で外されるため）
    s = s.replace('|', ' ').replace(':', ' ').replace('：', ' ')  # 表の区切り「|」と「:」は空白扱い（表の行を「〇〇：△△」と引用するため。両側に同じ扱い）
    return re.sub(r'\s+', ' ', s).strip().lower()


def key(s):
    """行と文を比べるための形：空白・句読点・かっこ・絵文字を外す（文字・数字とコマンドの記号だけ残す）。"""
    return re.sub(r'[^\w$./@()\-]', '', norm(s).replace(' ', ''))


def corpus_of(ctx):
    parts = []
    for a in ctx.get('ai_sources', []) + ctx.get('x_sources', []):
        parts.append(a.get('text', ''))
    for e in ctx.get('primary_evidence', []):
        parts += [f"{l.get('version', '')} {l.get('line', '')}" for l in e.get('lines', [])]  # 版の番号も材料に入れる
        parts.append(e.get('text', ''))  # 公式ドキュメントの本文
    for k in ('media_articles', 'rss_articles', 'hot_topics'):
        for a in ctx.get(k, []):
            parts += [a.get('title', ''), a.get('summary', '')]
    wr = ctx.get('work_record') or {}  # 本当に試した記録（朝・夜）：頼んだこと・手順・数字も材料として照合できる
    if wr.get('ok'):
        parts += [wr.get('task', ''), ' '.join(wr.get('steps', [])), ' '.join(wr.get('result_preview', [])),
                  ' '.join(f"{f.get('file')} {f.get('lines')}行 {f.get('lines')} 行" for f in wr.get('files_written', [])),
                  f"{wr.get('tests_passed')}件 {wr.get('tests_passed')} テスト {wr.get('real_seconds')}秒 {wr.get('real_seconds')} 秒"]
    return norm(' \n '.join(parts))


TOKEN_PATTERNS = [
    r'`[^`\n]{2,60}`',                    # `コマンド`
    r'(?<![\w/])/[a-z][\w-]{2,}',          # /plugin など
    r'--[a-z][\w-]{2,}',                   # --max-findings など
    r'\$\.[\w.]+\(?\)?',                   # $.ui.selection()
    r'\b\d+(?:\.\d+)+\b',                  # 2.1.287 などの版
    r'\d[\d,]*(?:\.\d+)?\s*(?:%|％|倍|件|万|億|ドル|円|秒|分|時間|ページ|トークン|tokens?|[KkMm]\b)',  # 数字＋単位
    r'\b[A-Z][A-Za-z0-9]+(?:\s[A-Z0-9][A-Za-z0-9.]+)*\b',  # 英字の名前（Claude Mods など）
]
IGNORE = {'claude', 'claude code', 'anthropic', 'ai', 'x', 'ok', 'ng', 'url', 'ui', 'api', 'cli', 'mac', 'windows',
          'follow', 'pc', 'sns', 'web', 'lp'}

# 作者の一言・お願いに入っていたら、体験・使用感の形なので一言として認めない（作り話の入口）
EXPERIENCE_WORDS = ['使ってから', '使ってみ', '使っている', '使ってい', '使い始め', '使いはじめ', '試して', '試した', 'してから', '以前は', '前は', '毎回', '私も', 'うちでも',
                    '手元で', '実際に', 'やってみた', '触って', '触った', '導入して', 'クライアント', 'という声', '聞く', '聞いた']
CONNECTORS = {'つまり', 'まとめると', 'ポイントは', 'やることはこれだけ', '流れはこう', 'たとえば', '例', '背景には', 'できること', 'やり方', '作り方', '使い方', '手順'}


def tokens_of(text):
    found = []
    for p in TOKEN_PATTERNS:
        for m in re.finditer(p, text):
            t = m.group(0).strip('`').strip()
            if norm(t) in IGNORE or len(t) < 2:
                continue
            found.append(t)
    return list(dict.fromkeys(found))


def is_connector(line):
    """記号だけ（👇・↓・→）、「つまり、」などのつなぎだけの行。連続したら1つにまとめる対象。"""
    k = key(line)
    return k == '' or k in {key(c) for c in CONNECTORS}


def is_structural(line):
    """つなぎの行、または短い見出し（「Modsでできること：」「例：」「・エージェントビュー」）。見出しは連続してよい（箇条書き）。"""
    if is_connector(line):
        return True
    st = line.strip()
    if st[-1:] in '：:' and len(st) <= 14 and all(norm(t) in _CORPUS for t in tokens_of(st)):
        return True
    # 箇条書き・番号の短い見出し（「・エージェントビュー」「① 画面を追加する」）：名前だけで主張が無いので残す（名前・数字が材料にあるとき）。2026-10-04
    # 「・無料：Flash-Liteのみ」のような「項目：値」は事実の主張なので見出し扱いしない（途中に：があれば対象外）
    return (bool(re.match(r'^[・①-⑳]', st)) and len(st) <= 30 and st[-1:] not in '。.'
            and '：' not in st[1:-1] and ':' not in st[1:-1]
            and all(norm(t) in _CORPUS for t in tokens_of(st)))


_CORPUS = ''  # main() で材料を入れる（短い見出しの名前の照合用）


def is_attribution(line):
    """出どころの表示：（マイナビニュースによると）（公式 更新履歴 2.1.287）（ITmedia AI+）など、かっこだけの短い行。"""
    s = line.strip()
    return len(s) <= 70 and s[:1] in '(（' and s[-1:] in ')）' 


def core_of(line):
    """箇条書きの印・矢印・番号を外した、行の中身。"""
    return key(re.sub(r'^[\s・\-→↓⇒①-⑳❶-❿0-9０-９.．)）]+', '', line))


def fixed_lines_of(ctx):
    """更新履歴の「Fixed（不具合を直した）」行。これを根拠に「できる・追加された」と書くのは言いすぎ。"""
    return [norm(l.get('line', '')) for e in ctx.get('primary_evidence', []) for l in e.get('lines', []) if l.get('kind') == 'fixed']


LIMIT_WORDS = re.compile(r'(1つ|ひとつ|一つ|だけ|のみ|唯一|すべて|全て|全部|初めて|はじめて|最大|最小|必ず|常に)')
LIMIT_IN_QUOTE = re.compile(r'(\b(one|only|single|sole|all|every|each|first(?!-)|max|maximum|min|minimum|always|automatic|automatically)\b|\d|のみ|だけ|唯一|すべて|全て|全部|初めて|はじめて|最大|最小|必ず|常に|ひとつ|一つ|1つ)', re.I)  # 日本語の原文（記事の要約）の限定も認める
FEATURE_WORDS = re.compile(r'(できる|できます|追加|入った|対応|表示|取得|使える|機能)')


def check_post(p, corpus, fixed, fix):
    text = p.get('post_text', '')
    evid = p.get('evidence', []) or []
    failed, good = [], []
    for e in evid:
        q = norm(e.get('quote', ''))
        sent = e.get('sentence', '')
        parts = [x.strip() for x in re.split(r'\.\.\.|…', q) if x.strip()]  # 「…」でつないだ引用は、切れ目ごとに材料にあればよい
        if not (q and parts and all(len(x) >= 10 and x in corpus for x in parts)):
            failed.append({'sentence': sent, 'quote': e.get('quote', ''), 'reason': '根拠の原文が材料に見つからない'})
        elif any(q in f or f in q for f in fixed) and FEATURE_WORDS.search(sent) and not re.search(r'(修正|直|不具合|バグ)', sent):
            failed.append({'sentence': sent, 'quote': e.get('quote', ''), 'reason': '不具合の修正（Fixed）の行を「できること」の根拠にしている'})
        elif LIMIT_WORDS.search(re.sub(r'できるだけ|なるだけ|だけど|だけで(?=な)', '', sent)) and not LIMIT_IN_QUOTE.search(q):  # 「できるだけ早く」の「だけ」は限定ではない
            failed.append({'sentence': sent, 'quote': e.get('quote', ''), 'reason': f'原文に無い数・限定の言い切り（{LIMIT_WORDS.search(sent).group(1)}）'})
        else:
            good.append(e)
    quotes = [x.strip() for e in good for x in re.split(r'\.\.\.|…', norm(e.get('quote', ''))) if x.strip()]
    sentence_keys = [key(e.get('sentence', '')) for e in good]

    def supported(t):
        nt = norm(t)
        if nt in corpus or any(nt in q for q in quotes):
            return True
        parts = nt.split(' ')  # 「CHANGELOG 2.1.287」のような組み合わせは、1語ずつ材料にあればよい
        return len(parts) > 1 and all(x in corpus or any(x in q for q in quotes) for x in parts)

    lines = text.split('\n')
    content_idx = [i for i, l in enumerate(lines) if l.strip() and not is_structural(l)]
    tail = set(content_idx[-6:])  # 見立て3行＋お願い1行（作者の決定 2026-10-04）＋出どころ等の余裕
    # 声・解釈・かみ砕きは行数で縛らない（割合は書く側の目安。作者の決定 2026-10-04）。縛るのは「名前・数字が材料にあるか」「体験の形でないか」だけ
    voice_keys = [key(v) for v in (p.get('voice_lines') or [])]
    plain_keys = [key(v) for v in (p.get('plain_lines') or [])] + [key(v) for v in (p.get('insight_lines') or [])]

    removed, unsupported = [], []
    keep = [True] * len(lines)
    intro = set(content_idx[:2])  # 1〜2行目の導入（問いかけ・「〜に、」の呼びかけ）。2026-10-05：「どっちのモデルで頼む？」に、 が事実の行として消えた
    for i, line in enumerate(lines):
        if not line.strip() or is_structural(line):
            continue
        bad_tokens = [t for t in tokens_of(line) if not supported(t)]
        reason = None
        st = line.strip()
        if (i in intro and st.endswith(('？', '?', '、', '👇')) and not bad_tokens
                and not any(w in line for w in EXPERIENCE_WORDS)):
            pass  # 導入の問いかけ・呼びかけは一言と同じ扱い（名前・数字が材料にあり、体験の形でなければ残す）
        elif is_attribution(line):
            if bad_tokens:
                reason = f'根拠の無い名前・数字（{", ".join(bad_tokens)}）'
        elif core_of(line) and any(core_of(line) in s for s in sentence_keys):
            if bad_tokens:
                reason = f'根拠の無い名前・数字（{", ".join(bad_tokens)}）'
        elif key(line) and any(key(line) in v for v in plain_keys):
            if bad_tokens:
                reason = f'かみ砕きの行に材料に無い名前・数字（{", ".join(bad_tokens)}）'
            elif any(w in line for w in EXPERIENCE_WORDS) and not line.strip().endswith(('？', '?')):
                reason = 'かみ砕きの行が体験・使用感の形'
        elif key(line) and any(key(line) in v for v in voice_keys):  # 一言が複数行に分かれていてもよい
            if any(w in line for w in EXPERIENCE_WORDS) and not line.strip().endswith(('？', '?')):  # 途中に置いてよい（2026-10-04 作者）  # 読む人への問いかけ（〜使っていますか？）は体験ではない
                reason = '一言が体験・使用感の形（作り話の入口）'
            elif tokens_of(line):
                reason = '一言に名前・数字が入っている（事実の行として根拠が要る）'
        else:
            reason = '根拠が付いていない事実の行'
        unsupported += bad_tokens
        if reason:
            keep[i] = False
            removed.append({'line': line, 'reason': reason})

    if fix:
        out = []
        for i, line in enumerate(lines):
            if not keep[i]:
                continue
            if is_connector(line) and line.strip():
                prev = next((l for l in reversed(out) if l.strip()), None)
                if prev is None or is_connector(prev):  # 先頭のつなぎ・つなぎの連続は外す（見出し・箇条書きは対象外）
                    continue
            out.append(line)
        # 見出し（「〇〇：」）の中身が全部消えたら、見出しも消す（「階層化される：」のあとに何も無い、を防ぐ。2026-10-04 本番初回で発生）
        cleaned = []
        for idx, line in enumerate(out):
            st = line.strip()
            if st and st[-1] in '：:' and len(st) <= 30:
                nxt = next((l for l in out[idx + 1:] if l.strip()), None)
                if nxt is None or nxt.strip()[-1] in '：:' or is_connector(nxt) or is_attribution(nxt):
                    removed.append({'line': line, 'reason': '見出しの中身が全部消えたため見出しも削除'})
                    continue
            cleaned.append(line)
        out = cleaned
        while out and (not out[-1].strip() or (is_structural(out[-1]) and '👇' not in out[-1])):
            out.pop()
        p['post_text'] = re.sub(r'\n{3,}', '\n\n', '\n'.join(out)).strip()
        kept_keys = key(p['post_text'])
        p['evidence'] = [e for e in good if core_of(e.get('sentence', ''))[:12] in kept_keys]

    # 報道だけの話題（根拠の出どころに公式が無い）なのに「（〇〇によると）」の出どころ行が無い → 報告だけ（直す段が足す）。2026-10-05 昼の試しで抜けた
    warnings = []
    sources = [str(e.get('source', '')) for e in evid]
    official_src = any(('公式' in s) or ('official' in s.lower()) or ('docs' in s.lower()) or ('changelog' in s.lower()) for s in sources)
    has_attr = any(('によると' in l or 'の記事によれば' in l) for l in lines)  # かっこ行でも本文の中でもよい（2026-10-05：かっこ行はやめた）
    if evid and not official_src and not has_attr:
        warnings.append('報道だけの話題なのに「（〇〇によると）」の出どころの行が無い。媒体名を1行足す')

    left = [l for l in p.get('post_text', '').split('\n') if l.strip() and not is_structural(l)] if fix else None
    return {'theme': p.get('theme'), 'evidence_ok': len(good), 'evidence_failed': failed,
            'unsupported_tokens': list(dict.fromkeys(unsupported)), 'evidence_count': len(evid),
            'removed_lines': removed, 'warnings': warnings, 'lines_left': len(left) if left is not None else None,
            'chars_left': len(p.get('post_text', '')) if fix else None}


def main():
    fix = '--report-only' not in sys.argv
    args = [a for a in sys.argv[1:] if a != '--report-only']
    posts = json.load(open(args[0], encoding='utf-8'))
    ctx = json.load(open(args[1], encoding='utf-8'))
    corpus = corpus_of(ctx)
    global _CORPUS
    _CORPUS = corpus
    fixed = fixed_lines_of(ctx)
    report = {'fixed': fix, 'posts': [], 'total_failed': 0, 'total_removed_lines': 0}
    for i, p in enumerate(posts, 1):
        r = check_post(p, corpus, fixed, fix)
        r['post'] = i
        report['posts'].append(r)
        report['total_failed'] += len(r['evidence_failed']) + len(r['unsupported_tokens'])
        report['total_removed_lines'] += len(r['removed_lines'])
        print(f"投稿{i}：根拠 {r['evidence_ok']}/{r['evidence_count']} 一致・根拠の無い名前/数字 {len(r['unsupported_tokens'])} 件・"
              f"{'削除' if fix else '削除対象'} {len(r['removed_lines'])} 行" + (f"・残り {r['chars_left']}字" if fix else ''))
        for f in r['evidence_failed']:
            print(f"   ✗ 根拠：{f['sentence'][:50]} ← {f['quote'][:60]}")
        for d in r['removed_lines']:
            print(f"   － {d['line'][:50]}（{d['reason']}）")
    json.dump(report, open(args[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if fix:
        json.dump(posts, open(args[0], 'w', encoding='utf-8'), ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
