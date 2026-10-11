import Image from 'next/image'

const WIDTH = 1920
const HEIGHT = 1080

/**
 * A 1920 x 1080 app screenshot cropped to one region and enlarged, so the
 * interesting part is readable. `region` is in screenshot pixels: its left
 * edge, top edge and width; the height follows from `aspect` (width / height).
 */
export function Shot({
  src,
  alt,
  region,
  aspect = 1.6,
}: {
  src: string
  alt: string
  region: { x: number; y: number; w: number }
  aspect?: number
}) {
  const zoom = WIDTH / region.w
  const left = -(region.x / WIDTH) * zoom * 100
  const top = -(region.y / HEIGHT) * zoom * (HEIGHT / WIDTH) * aspect * 100
  return (
    <div className="relative overflow-hidden bg-mk-band" style={{ aspectRatio: String(aspect) }}>
      <Image
        src={src}
        alt={alt}
        width={WIDTH}
        height={HEIGHT}
        sizes="(min-width: 1200px) 1600px, 140vw"
        className="absolute h-auto max-w-none"
        style={{ width: `${zoom * 100}%`, left: `${left}%`, top: `${top}%` }}
      />
    </div>
  )
}
