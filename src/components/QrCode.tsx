'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

/**
 * A scannable QR image for `value`. A QR is functional imagery, not a UI
 * surface: phone cameras want dark modules on a light quiet zone, so the code
 * itself is fixed black-on-white (theme tokens wouldn't survive the camera).
 * We frame it in a white rounded card so that reads as deliberate in both themes.
 */
export function QrCode({ value, size = 208 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    QRCode.toDataURL(value, { margin: 1, width: size, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (live) setSrc(url)
      })
      .catch(() => {
        if (live) setSrc(null)
      })
    return () => {
      live = false
    }
  }, [value, size])

  return (
    <div
      className="mx-auto grid place-items-center rounded-2xl bg-white p-3"
      style={{ width: size + 24, height: size + 24 }}
    >
      {src && (
        <img
          src={src}
          alt="Scan to load this profile on another device"
          width={size}
          height={size}
        />
      )}
    </div>
  )
}
