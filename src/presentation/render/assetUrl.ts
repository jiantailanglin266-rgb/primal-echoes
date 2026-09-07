/**
 * `public/assets/` 以下のランタイム読み込み URL。
 * 相対ベース（GitHub Pages のサブパス対応）にビルド ID を付け、デプロイ後に古いキャッシュが残らないようにする。
 */
export function assetUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}${relativePath}?v=${__PE_BUILD_ID__}`;
}
