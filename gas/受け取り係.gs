/**
 * 受け取り係（Google Apps Script）
 * GitHub で作った動画・カルーセル画像・文章を、あなたの Google ドライブに保存して、メールで知らせます。
 * 無料（Google アカウントの範囲内）で動きます。
 *
 * 使い方（README の「ステップ3」）：
 *  1. script.google.com で「新しいプロジェクト」→ このファイルの中身を全部貼り付けて保存
 *  2. 上の関数の選択で「はじめに1回だけ実行」を選んで「実行」→ 許可の画面で「許可」
 *     → 下の「実行ログ」に出る「GAS_KEY に入れる値」をコピー
 *  3. 右上の「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *     → 次のユーザーとして実行：自分／アクセスできるユーザー：全員 →「デプロイ」→ ウェブアプリの URL をコピー
 *  4. GitHub の Secrets に GAS_URL（URL）と GAS_KEY（鍵）を入れる
 */

const TOP_FOLDER = 'SNS自動投稿';  // ドライブにできるフォルダの名前（変えてもOK）

function はじめに1回だけ実行() {
  const key = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('KEY', key);
  DriveApp.getRootFolder();            // ドライブを使う許可
  MailApp.getRemainingDailyQuota();    // メールを送る許可
  Logger.log('GAS_KEY に入れる値：' + key);
}

function doPost(e) {
  const req = JSON.parse(e.postData.contents);
  const key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key || req.key !== key) return out_({ ok: false, error: '鍵（GAS_KEY）が違います' });
  if (req.action === 'file') {
    const folder = folder_(req.folder);
    const blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mime, req.name);
    folder.createFile(blob);
    return out_({ ok: true, url: folder.getUrl() });
  }
  if (req.action === 'mail') {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), req.subject, req.body);
    return out_({ ok: true });
  }
  return out_({ ok: false, error: 'action が違います' });
}

function folder_(name) {
  const tops = DriveApp.getFoldersByName(TOP_FOLDER);
  const top = tops.hasNext() ? tops.next() : DriveApp.createFolder(TOP_FOLDER);
  const subs = top.getFoldersByName(name);
  return subs.hasNext() ? subs.next() : top.createFolder(name);
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
