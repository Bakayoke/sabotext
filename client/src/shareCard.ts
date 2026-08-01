/** Draw a shareable Sabotext results card and return a PNG blob. */
export async function renderResultsImage(opts: {
  title: string
  subtitle: string
  rows: { rank: string; name: string; score: string }[]
  highlight?: string
  footer: string
  cta?: string
}): Promise<Blob | null> {
  const w = 1080
  const h = 1350
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#0f766e')
  grad.addColorStop(0.45, '#06241f')
  grad.addColorStop(1, '#d97706')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath()
  ctx.arc(920, 150, 200, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(120, 1180, 140, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 72px Syne, Georgia, serif'
  ctx.fillText('Sabotext', 72, 130)

  ctx.fillStyle = '#fde68a'
  ctx.font = '800 44px "DM Sans", sans-serif'
  ctx.fillText(opts.title.slice(0, 40), 72, 220)

  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.font = '700 30px "DM Sans", sans-serif'
  ctx.fillText(opts.subtitle.slice(0, 48), 72, 275)

  let y = 340
  if (opts.highlight) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.22)'
    roundRect(ctx, 72, y - 40, w - 144, 72, 16)
    ctx.fill()
    ctx.fillStyle = '#fde68a'
    ctx.font = '700 24px "DM Sans", sans-serif'
    ctx.fillText(`💬 ${opts.highlight.slice(0, 52)}`, 96, y + 4)
    y += 90
  }

  for (const row of opts.rows.slice(0, 8)) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, 72, y - 52, w - 144, 88, 18)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '800 36px "DM Sans", sans-serif'
    ctx.fillText(row.rank, 100, y)
    ctx.fillText(row.name.slice(0, 22), 200, y)
    ctx.textAlign = 'right'
    ctx.fillText(row.score, w - 100, y)
    ctx.textAlign = 'left'
    y += 110
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '700 26px "DM Sans", sans-serif'
  ctx.fillText(opts.footer.slice(0, 52), 72, h - 120)

  ctx.fillStyle = '#fde68a'
  ctx.font = '800 32px "DM Sans", sans-serif'
  ctx.fillText((opts.cta || 'sabotext.com').slice(0, 42), 72, h - 70)

  return await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
