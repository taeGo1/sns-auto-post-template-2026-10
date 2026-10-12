"""⑩ 届ける：動画・カルーセル画像・文章を Google ドライブに保存し、メールで知らせる。

ドライブへの保存とメールは、あなたの Google アカウントの「受け取り係」（gas/受け取り係.gs）が行う（無料）。
GitHub の Secrets：GAS_URL（受け取り係のウェブアプリの URL）・GAS_KEY（受け取り係の鍵）
使い方：python deliver.py <作業フォルダ> <書き出したフォルダ（sns-studio/out/〇〇）>
"""
import json
import os
import base64
import glob
import sys

import requests


def load(path, default=None):
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:
        return default


def gas(payload):
    r = requests.post(os.environ["GAS_URL"], json={**payload, "key": os.environ.get("GAS_KEY", "")}, timeout=300)
    r.raise_for_status()
    res = r.json()
    if not res.get("ok"):
        raise RuntimeError(res.get("error", "受け取り係でエラー"))
    return res


def main(work, out_dir):
    ctx = load(os.path.join(work, "sns-context.json"), {})
    posts = load(os.path.join(work, "sns-posts.json"), []) or []
    draft = load(os.path.join(work, "sns-draft.json"), {}) or {}
    check = load(os.path.join(work, "sns-check.json"), {}) or {}
    replay = load(os.path.join(work, "replay.json"), {}) or {}
    work_caps = load(os.path.join(work, "sns-captions-work.json"), {}) or {}
    mode = os.getenv("VIDEO_MODE", "")
    run_url = f"{os.getenv('GITHUB_SERVER_URL', 'https://github.com')}/{os.getenv('GITHUB_REPOSITORY', '')}/actions/runs/{os.getenv('GITHUB_RUN_ID', '')}"

    topic = (ctx.get("chosen_topic") or {}).get("topic", "（話題を選ぶ段がうまく動きませんでした）")
    lines = [f"■ 今日の話題：{topic}"]
    why = (ctx.get("chosen_topic") or {}).get("why")
    if why:
        lines.append(f"　選んだ理由：{why}")
    wr = ctx.get("work_record") or {}
    if wr.get("ok"):
        lines.append(f"■ 試したこと：{wr.get('task', '')}（Claude Code が実際に動いた記録。データは架空のサンプル）")
    elif wr:
        lines.append(f"■ 試さなかった理由：{wr.get('reason', '')}")
    lines.append(f"■ 動画：{'作業動画（試した記録）' if mode == 'work' else 'パターン動画' if mode else 'なし'}")
    lines += ["", "▼ 動画・カルーセルの画像・この文章は、Google ドライブのこのフォルダに入っています", "（ドライブのリンク）", ""]

    # X の投稿案
    for i, p in enumerate(posts, 1):
        n = len(str(p.get("post_text", "")).replace("\n", ""))
        floor = ctx.get("post_length_min") or 0
        note = "　※ 短めです" if floor and n < floor else ""
        lines += ["=" * 30, f"▼ X の投稿案{i}（{n}字）{note}" + ("　← 動画と同じ話題" if i == 1 else ""), "=" * 30, p.get("post_text", ""), ""]
    if mode == "work" and work_caps.get("x"):
        lines += ["=" * 30, "▼ X（作業動画と一緒に出す用）", "=" * 30, work_caps["x"], ""]

    # Instagram・Threads・TikTok（作業動画の日は、作業動画用の文章を優先）
    caps = dict(draft.get("captions") or {})
    if mode == "work":
        caps.update({k: v for k, v in work_caps.items() if v and k != "x"})
    for title, key in [("Instagram（リール）", "instagram_reel"), ("Instagram（カルーセル）", "instagram_carousel"),
                       ("Threads", "threads"), ("TikTok", "tiktok")]:
        if caps.get(key):
            lines += ["=" * 30, f"▼ {title}", "=" * 30, caps[key], ""]

    items = list(draft.get("check_items") or []) + [f"【検査】{w}" for w in check.get("warnings", [])] + \
        [f"【検査・未解決】{e}" for e in check.get("errors", [])]
    lines += ["■ 確認してほしいこと", *(items or ["なし"]), "",
              "※ 投稿する前に、事実（数字・名前・条件）と言いすぎが無いかを、最後に自分の目で確認してください。"]
    body = "\n".join(lines)
    with open(os.path.join(work, "届いた内容.txt"), "w", encoding="utf-8") as f:
        f.write(body)

    if not os.getenv("GAS_URL"):
        print("⚠️ 受け取り係（GAS_URL・GAS_KEY）の設定が無いので、ドライブに保存せず、メールも送りません。")
        print("   実行結果のページの Artifacts に、同じもの（動画・画像・届いた内容.txt）が入っています")
        print(body)
        return
    folder = os.path.basename(out_dir.rstrip("/")) if out_dir and os.path.isdir(out_dir) else (topic[:20] or "SNS自動投稿")
    url = ""
    files = sorted(glob.glob(os.path.join(out_dir, "*.mp4"))) + sorted(glob.glob(os.path.join(out_dir, "カルーセル", "*.png"))) if out_dir and os.path.isdir(out_dir) else []
    for f in files:
        mime = "video/mp4" if f.endswith(".mp4") else "image/png"
        name = os.path.basename(f) if f.endswith(".mp4") else "カルーセル_" + os.path.basename(f)
        try:
            url = gas({"action": "file", "folder": folder, "name": name, "mime": mime,
                       "data": base64.b64encode(open(f, "rb").read()).decode()}).get("url", url)
            print(f"   ドライブに保存：{name}")
        except Exception as e:
            print(f"⚠️ ドライブに保存できませんでした（{name}）：{e}")
    body = body.replace("（ドライブのリンク）", url or "（ドライブに保存できませんでした。実行結果のページの Artifacts をご覧ください：" + run_url + "）")
    try:
        url = gas({"action": "file", "folder": folder, "name": "届いた内容.txt", "mime": "text/plain",
                   "data": base64.b64encode(body.encode("utf-8")).decode()}).get("url", url)
    except Exception as e:
        print(f"⚠️ 文章をドライブに保存できませんでした：{e}")
    gas({"action": "mail", "subject": f"【SNS自動生成】今日の投稿案と動画：{topic[:40]}", "body": body})
    print(f"✅ ドライブに保存し、メールを送りました：{url}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
