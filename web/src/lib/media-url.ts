/** a small version of an uploaded picture for cards and the cart (the file route resizes it; see api/media/file) */
export const thumb = (url: string | null | undefined, w = 640): string => {
  if (!url) return ''
  return url.startsWith('/api/media/file/') && !url.includes('?') ? `${url}?w=${w}` : url
}
