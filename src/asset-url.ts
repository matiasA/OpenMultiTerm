export function assetUrl(path: string) {
  return new URL(`./${path.replace(/^\/+/, '')}`, window.location.href).toString()
}
