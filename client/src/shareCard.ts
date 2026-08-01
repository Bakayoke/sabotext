/** Draw a shareable Sabotext meme card — highlight-first, then optional scores. */
export async function renderResultsImage(opts: {
  title: string
  subtitle: string
  rows: { rank: string; name: string; score: string }[]
  highlight?: string
  /** Full meme: task + original → sabotage */
  meme?: {
    task: string
    original: string
    sabotage: string
    author: string
  }
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
  ctx.font = '800 68px Syne, Georgia, serif'
  ctx.fillText('Sabotext', 72, 120)

  let y = 190

  if (opts.meme) {
    ctx.fillStyle = '#fde68a'
    ctx.font = '800 28px "DM Sans", sans-serif'
    ctx.fillText('ÅRETS SABOTAGE', 72, y)
    y += 50

    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '700 26px "DM Sans", sans-serif'
    y = drawWrapped(ctx, opts.meme.task.slice(0, 120), 72, y, w - 144, 34)
    y += 28

    // Original bubble
    const origLines = wrapLines(ctx, `"${opts.meme.original}"`, w - 200, '600 28px "DM Sans", sans-serif')
    const origH = Math.max(100, 56 + origLines.length * 36)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, 72, y, w - 144, origH, 20)
    ctx.fill()
    ctx.fillStyle = 'rgba(253, 230, 138, 0.85)'
    ctx.font = '800 20px "DM Sans", sans-serif'
    ctx.fillText('ORIGINALET', 96, y + 36)
    ctx.fillStyle = '#fff'
    ctx.font = '600 28px "DM Sans", sans-serif'
    let ly = y + 72
    for (const line of origLines.slice(0, 4)) {
      ctx.fillText(line, 96, ly)
      ly += 36
    }
    y += origH + 24

    // Arrow
    ctx.fillStyle = '#fde68a'
    ctx.font = '800 36px "DM Sans", sans-serif'
    ctx.fillText('↓', w / 2 - 12, y + 8)
    y += 36

    // Sabotage bubble
    const sabLines = wrapLines(ctx, `"${opts.meme.sabotage}"`, w - 200, '700 32px "DM Sans", sans-serif')
    const sabH = Math.max(120, 64 + sabLines.length * 40)
    ctx.fillStyle = 'rgba(245, 158, 11, 0.28)'
    roundRect(ctx, 72, y, w - 144, sabH, 20)
    ctx.fill()
    ctx.fillStyle = '#fde68a'
    ctx.font = '800 20px "DM Sans", sans-serif'
    ctx.fillText(`SABOTAGE · ${opts.meme.author.toUpperCase().slice(0, 18)}`, 96, y + 36)
    ctx.fillStyle = '#fff'
    ctx.font = '700 32px "DM Sans", sans-serif'
    ly = y + 78
    for (const line of sabLines.slice(0, 5)) {
      ctx.fillText(line, 96, ly)
      ly += 40
    }
    y += sabH + 36

    // Compact score strip
    if (opts.rows.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '700 22px "DM Sans", sans-serif'
      const strip = opts.rows
        .slice(0, 4)
        .map((r) => `${r.rank} ${r.name} ${r.score}`)
        .join('   ')
      ctx.fillText(strip.slice(0, 58), 72, y)
    }
  } else {
    ctx.fillStyle = '#fde68a'
    ctx.font = '800 44px "DM Sans", sans-serif'
    ctx.fillText(opts.title.slice(0, 40), 72, y)
    y += 50
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.font = '700 30px "DM Sans", sans-serif'
    ctx.fillText(opts.subtitle.slice(0, 48), 72, y)
    y += 60

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

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string[] {
  ctx.font = font
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapLines(ctx, text, maxWidth, ctx.font)
  for (const line of lines.slice(0, 3)) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  return y
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
