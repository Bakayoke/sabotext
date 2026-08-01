import { useEffect, useRef, useState } from 'react'

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector
  if (!Ctor) return null
  try {
    return new Ctor({ formats: ['qr_code'] })
  } catch {
    return null
  }
}

export function parseJoinCodeFromScan(raw: string): string | null {
  const text = raw.trim()
  try {
    const url = new URL(text)
    const join = url.searchParams.get('join')?.toUpperCase().replace(/[^A-Z]/g, '') ?? ''
    if (join.length === 4) return join
  } catch {
    // not a URL
  }
  const query = text.match(/[?&]join=([A-Za-z]{4})\b/i)
  if (query?.[1]) return query[1].toUpperCase()
  const bare = text.toUpperCase().replace(/[^A-Z]/g, '')
  if (bare.length === 4) return bare
  return null
}

export function QrJoinScanner({
  onCode,
  onError,
  unsupportedHint,
  scanningLabel,
}: {
  onCode: (code: string) => void
  onError: (msg: string) => void
  unsupportedHint: string
  scanningLabel: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onCodeRef = useRef(onCode)
  const onErrorRef = useRef(onError)
  const [unsupported, setUnsupported] = useState(false)
  const stopped = useRef(false)

  onCodeRef.current = onCode
  onErrorRef.current = onError

  useEffect(() => {
    stopped.current = false
    const detector = getBarcodeDetector()
    if (!detector) {
      setUnsupported(true)
      return
    }

    let stream: MediaStream | null = null
    let raf = 0
    let lastDetect = 0

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        const video = videoRef.current
        if (!video || stopped.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        video.srcObject = stream
        await video.play()

        const tick = async () => {
          if (stopped.current) return
          const now = Date.now()
          if (now - lastDetect > 350 && video.readyState >= 2) {
            lastDetect = now
            try {
              const codes = await detector!.detect(video)
              for (const c of codes) {
                const parsed = parseJoinCodeFromScan(c.rawValue ?? '')
                if (parsed) {
                  onCodeRef.current(parsed)
                  return
                }
              }
            } catch {
              // keep scanning
            }
          }
          raf = requestAnimationFrame(() => {
            void tick()
          })
        }
        raf = requestAnimationFrame(() => {
          void tick()
        })
      } catch {
        setUnsupported(true)
        onErrorRef.current(unsupportedHint)
      }
    }

    void start()

    return () => {
      stopped.current = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      const video = videoRef.current
      if (video) video.srcObject = null
    }
  }, [unsupportedHint])

  if (unsupported) {
    return <p className="footer-note">{unsupportedHint}</p>
  }

  return (
    <div className="qr-scan">
      <video ref={videoRef} className="qr-scan-video" playsInline muted />
      <p className="footer-note center">{scanningLabel}</p>
    </div>
  )
}
