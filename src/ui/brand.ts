/**
 * ブランド資産のインライン版。アニメーションさせたい箇所（ローディングの環、タイトル）で使う。
 * 静止表示は `assets/brand/*.svg` を <img> で参照する。
 */
let symbolCounter = 0;

/** シンボル「裂かれた残響」。mask の id が衝突しないよう呼ぶたびに採番する。 */
export function symbolSvg(className = ''): string {
  symbolCounter += 1;
  const inner = SYMBOL_INNER.replace(/%ID%/g, String(symbolCounter));
  return `<svg class="pe-symbol ${className}" viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`;
}

const SYMBOL_INNER = "<mask id=\"pe-claw-%ID%\"><rect width=\"100\" height=\"100\" fill=\"white\"/><g transform=\"rotate(-38 50 50)\" stroke=\"black\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M38 6 V94\" stroke-width=\"6.5\"/><path d=\"M50 6 V94\" stroke-width=\"5.0\"/><path d=\"M62 6 V94\" stroke-width=\"3.8\"/></g></mask><g mask=\"url(#pe-claw-%ID%)\" fill=\"none\" stroke=\"currentColor\"><circle class=\"pe-sym-ring pe-sym-ring-1\" cx=\"50\" cy=\"50\" r=\"14\" stroke-width=\"6.5\"/><circle class=\"pe-sym-ring pe-sym-ring-2\" cx=\"50\" cy=\"50\" r=\"27\" stroke-width=\"4.2\"/><circle class=\"pe-sym-ring pe-sym-ring-3\" cx=\"50\" cy=\"50\" r=\"40\" stroke-width=\"2.6\"/></g><circle class=\"pe-sym-core\" cx=\"50\" cy=\"50\" r=\"3.6\" fill=\"currentColor\"/>";
