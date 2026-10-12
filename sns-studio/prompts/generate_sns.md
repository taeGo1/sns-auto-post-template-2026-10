# 動画・カルーセル・SNS の文章の下書き（1本分）

今日の X の投稿案と同じ話題で、Instagram（リール・カルーセル）・Threads・TikTok の下書きを **1本分** 作ります。投稿はしません（下書きまで）。

## 読むファイル（全部 Read してから書き始める）
1. `sns-studio/rules/SNSの型.md` … 型・場面・文字数（**いちばん大事**）
2. `prompts/reader.md` … 読む人
3. `tonmana.md` … 口調（空なら、読みやすい普通の口調）
4. `hallucination_rules.md` … 事実チェックの決まり
5. 起動時の指示にある：X の投稿案 `sns-posts.json`（1件目が今日の話題）・材料 `sns-context.json`（`chosen_topic`・`work_record`）

## 手順
1. **話題は X の投稿案の1件目と同じ**（動画は投稿とセットで出すため。別の話題にしない）
2. 型（pattern）を SNSの型.md の表から選ぶ。理由を1行
3. リール（`reel.scenes`）を書く：7〜10場面・35〜45秒。流れは SNSの型.md の「2. リール」のとおり。最後から2場面目は `todo`、最後は `cta`。イメージ図を3場面以上。同じ絵の場面を続けない
4. カルーセル（`carousel.slides`）を書く：4〜8枚。1枚目 `cover`、最後から2枚目 `todo`、最後 `cta`
5. キャプション（Instagram リール・カルーセル・Threads・TikTok）を SNSの型.md の「4. 文章」の長さで書く。中身は X の投稿案と同じ事実だけ
6. 自分で見直す（下の最終チェック）

## 絶対に守ること
- **材料にない事実を足さない。** 数字・機能名・日付・発表元は、X の投稿案と材料にあるものだけ
- **作り話は厳禁。** 使ったことの無いものを使ったことにしない。聞いた話・架空の事例を作らない
- 使い方は「たとえば、こんな使い方ができます」の形で、現実味のあるものだけ（深さは reader.md）
- 試した記録（`work_record`）があれば、その数字は記録どおり。架空のサンプルデータならそう書く
- 迷ったところは `check_items` に【要確認】として書き、最後まで作る（止まらない）
- 文字数の上限を守る。超えそうなら言葉を削る。改行は `\n` で自分で入れる

## 出力（下書きファイル `sns-draft.json`（置き場所は起動時の指示）に Write する。JSON だけ・1回で書く）
```json
{
  "theme": "フォルダ名にするテーマ（20字以内・記号なし）",
  "pattern": "howto",
  "pattern_reason": "この型にした理由（1行）",
  "props": {
    "pattern": "howto",
    "carousel": { "slides": [ {"type": "cover", "title": "…", "mark": "…"} ] },
    "reel": { "scenes": [ {"kind": "hook", "text": "…", "mark": "…", "beats": 6} ] }
  },
  "captions": {
    "instagram_reel": "…",
    "instagram_carousel": "…",
    "threads": "…",
    "tiktok": "…"
  },
  "check_items": ["【要確認】…（無ければ空の配列）"]
}
```
- `props` の形は `sns-studio/src/types.ts` の `SnsProps` と同じ（`bgm`・`platform`・`handle` は書かない。機械が足す）
- `props.pattern` と外側の `pattern` は同じ値

## 最終チェック（Write の前に1つずつ確かめる）
- [ ] X の投稿案の1件目と同じ話題か
- [ ] 材料にない数字・名前・日付・作り話が入っていないか
- [ ] リールは7〜10場面・イメージ図3場面以上・最後から2番目が todo・最後が cta か
- [ ] 各場面・各枚の文字数と行数が上限の中か／mark が text に含まれているか
