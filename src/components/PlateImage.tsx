export type PhotoPlateName = 'chulha' | 'lamp' | 'tomb' | 'ward'

export interface PlateImageProps {
  name: PhotoPlateName
  sizes: string
  width: number
  height: number
  alt: string
  defaultSize?: 520 | 900 | 1600
  lazy?: boolean
  parallax?: string
}

/** Responsive editorial plate picture with consistent srcset widths across the app. */
export function PlateImage({
  name,
  sizes,
  width,
  height,
  alt,
  defaultSize = 900,
  lazy = false,
  parallax,
}: PlateImageProps) {
  return (
    <img
      src={`/img/${name}-${defaultSize}.jpg`}
      srcSet={`/img/${name}-520.jpg 520w, /img/${name}-900.jpg 900w, /img/${name}-1600.jpg 1600w`}
      sizes={sizes}
      width={width}
      height={height}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      decoding={lazy ? 'async' : undefined}
      data-parallax={parallax}
    />
  )
}
