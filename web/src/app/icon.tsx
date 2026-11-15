// Favicon from the logo: pink + cocoa dots (design tokens).
import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0EEE9', borderRadius: 16 }}>
      <div style={{ width: 24, height: 24, borderRadius: 12, background: '#E8B4B8', marginRight: -4 }} />
      <div style={{ width: 24, height: 24, borderRadius: 12, background: '#2A211E' }} />
    </div>,
    size,
  )
}
