// Small charts drawn as plain SVG on the server: no chart library, no client JavaScript.
import { int } from './fmt'

export function Bars({ data, title, format = int }: { data: { label: string; value: number }[]; title: string; format?: (n: number) => string }) {
  const W = 720, H = 130, PAD = 4
  const max = Math.max(1, ...data.map((d) => d.value))
  const bw = (W - PAD * 2) / Math.max(1, data.length)
  const total = data.reduce((a, d) => a + d.value, 0)
  return (
    <div className="yp-card">
      <div className="yp-row" style={{ justifyContent: 'space-between' }}><b className="yp-h3" style={{ margin: 0 }}>{title}</b><span className="yp-muted">Jami: {format(total)}</span></div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} width="100%" role="img" aria-label={title} style={{ display: 'block' }}>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="currentColor" strokeOpacity={0.08} />)}
        {data.map((d, i) => {
          const h = Math.max(d.value ? 2 : 0, (d.value / max) * (H - 6))
          return <rect key={d.label} x={PAD + i * bw + bw * 0.12} y={H - h} width={Math.max(1, bw * 0.76)} height={h} rx={2} fill="#a8475c"><title>{`${d.label}: ${format(d.value)}`}</title></rect>
        })}
        {data.length > 0 && [0, Math.floor((data.length - 1) / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
          <text key={i} x={PAD + i * bw + bw / 2} y={H + 15} fontSize={11} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fill="currentColor" fillOpacity={0.55}>{data[i].label.slice(5)}</text>
        ))}
      </svg>
    </div>
  )
}

/** steps of the buying path: width = share of the first step, text = how many are left after the previous step */
export function FunnelBars({ steps }: { steps: { label: string; value: number; hint: string }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1)
  return (
    <div className="yp-card">
      <b className="yp-h3" style={{ margin: 0 }}>Xarid yoʻli (sessiyalar)</b>
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : s.value
        const keep = prev ? s.value / prev : 0
        return (
          <div key={s.label} title={s.hint}>
            <div className="yp-row" style={{ justifyContent: 'space-between', fontSize: 13.5 }}>
              <span>{s.label}</span>
              <span><b>{int(s.value)}</b>{i > 0 && <span className="yp-muted"> · oldingi bosqichdan {Math.round(keep * 100)}% qoldi</span>}</span>
            </div>
            <div className="yp-bar" style={{ height: 12 }}><i style={{ width: `${Math.max(s.value ? 1 : 0, (s.value / top) * 100)}%` }} /></div>
          </div>
        )
      })}
      <span className="yp-muted">Har bosqichda — shu ishni qilgan alohida kirishlar (sessiyalar) soni. Hamma ham bosqichlarni ketma-ket bosib oʻtmaydi, shuning uchun raqamlar taxminiy yoʻl koʻrsatadi.</span>
    </div>
  )
}
