import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

/** Local QR (no third-party API). */
export function JoinQr({ url, size = 200, alt }: { url: string; size?: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      color: { dark: '#0a3d36', light: '#fffbf5' },
    }).then((data) => {
      if (!cancelled) setSrc(data)
    })
    return () => {
      cancelled = true
    }
  }, [url, size])

  if (!src) {
    return <div className="qr-placeholder" style={{ width: size, height: size }} aria-hidden />
  }
  return <img className="qr-img" src={src} width={size} height={size} alt={alt} />
}
