// Apple touch icon from the logo: pink + cocoa dots (design tokens).
import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0EEE9', borderRadius: 40 }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: '#E8B4B8', marginRight: -10 }} />
      <div style={{ width: 64, height: 64, borderRadius: 32, background: '#2A211E' }} />
    </div>,
    size,
  )
}
