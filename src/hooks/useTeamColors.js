/**
 * useTeamColors — extracts dominant colors from a team logo at runtime
 * using HTML Canvas pixel sampling. Updates automatically if the logo changes.
 * Returns { primary, accent, dim, text } CSS color strings.
 */
import { useState, useEffect } from 'react'

const cache = {}

export function useTeamColors(logoSrc) {
  const [colors, setColors] = useState(null)

  useEffect(() => {
    if (!logoSrc) return
    if (cache[logoSrc]) { setColors(cache[logoSrc]); return }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const SIZE   = 64
        canvas.width = SIZE; canvas.height = SIZE
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, SIZE, SIZE)
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data

        // Sample pixels, skip near-white and near-black and near-transparent
        const buckets = {}
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3]
          if (a < 128) continue
          const brightness = (r + g + b) / 3
          if (brightness > 235 || brightness < 20) continue

          // Quantize to buckets of 32
          const qr = Math.round(r/32)*32
          const qg = Math.round(g/32)*32
          const qb = Math.round(b/32)*32
          const key = `${qr},${qg},${qb}`
          buckets[key] = (buckets[key] || 0) + 1
        }

        // Sort by frequency
        const sorted = Object.entries(buckets).sort((a,b) => b[1]-a[1])
        if (!sorted.length) { setColors(fallback()); return }

        // Primary = most frequent color
        const [pr,pg,pb] = sorted[0][0].split(',').map(Number)
        const primary = `rgb(${pr},${pg},${pb})`

        // Accent = second most frequent that's visually different
        let accent = primary
        for (const [key] of sorted.slice(1)) {
          const [ar,ag,ab] = key.split(',').map(Number)
          const diff = Math.abs(ar-pr)+Math.abs(ag-pg)+Math.abs(ab-pb)
          if (diff > 80) { accent = `rgb(${ar},${ag},${ab})`; break }
        }

        const result = {
          primary,
          accent,
          dim:     `rgba(${pr},${pg},${pb},0.15)`,
          dimDeep: `rgba(${pr},${pg},${pb},0.25)`,
          border:  `rgba(${pr},${pg},${pb},0.35)`,
          text:    isLight(pr,pg,pb) ? '#1a1a1a' : '#ffffff',
        }
        cache[logoSrc] = result
        setColors(result)
      } catch {
        setColors(fallback())
      }
    }
    img.onerror = () => setColors(fallback())
    img.src = logoSrc
  }, [logoSrc])

  return colors
}

function isLight(r,g,b) { return (r*299+g*587+b*114)/1000 > 128 }
function fallback() {
  return { primary:'#e8822a', accent:'#f5a623', dim:'rgba(232,130,42,0.15)',
    dimDeep:'rgba(232,130,42,0.25)', border:'rgba(232,130,42,0.35)', text:'#ffffff' }
}
