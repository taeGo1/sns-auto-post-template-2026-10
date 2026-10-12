// 書体を sns-studio に同梱して読み込む（2026-10-02）
// クラウド（GitHub Actions の Linux）にはヒラギノ・Didot・Arial Black が無いため、
// 無料で使える Google の書体（SIL Open Font License・public/fonts/OFL.txt）に置き換え、
// Mac で作ってもクラウドで作っても同じ見た目になるようにした。
import { continueRender, delayRender, staticFile } from 'remotion';

const FONTS: { family: string; file: string; weight: string }[] = [
  { family: 'Noto Sans JP', file: 'fonts/NotoSansJP-VF.ttf', weight: '100 900' },
  { family: 'Noto Serif JP', file: 'fonts/NotoSerifJP-VF.ttf', weight: '200 900' },
  { family: 'Playfair Display', file: 'fonts/PlayfairDisplay-VF.ttf', weight: '400 900' },
  { family: 'Archivo Black', file: 'fonts/ArchivoBlack-Regular.ttf', weight: '400' },
  { family: 'JetBrains Mono', file: 'fonts/JetBrainsMono-VF.ttf', weight: '100 800' },
  // 絵文字も同梱（Mac の Apple の絵文字とクラウドで見た目が変わらないように）
  { family: 'Noto Color Emoji', file: 'fonts/NotoColorEmoji.ttf', weight: '400' },
];

if (typeof document !== 'undefined') {
  const handle = delayRender('書体の読み込み');
  Promise.all(
    FONTS.map((f) => {
      const face = new FontFace(f.family, `url('${staticFile(f.file)}') format('truetype')`, { weight: f.weight });
      return face.load().then((loaded) => {
        document.fonts.add(loaded);
      });
    })
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error('書体の読み込みに失敗', err);
      continueRender(handle);
    });
}
