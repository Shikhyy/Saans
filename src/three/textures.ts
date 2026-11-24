import * as THREE from 'three'

/** Deterministic PRNG (Mulberry32) used so procedural cityscapes remain reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Generate a soft radial glow sprite texture for particles, street lights, and solar disc. */
export function softRadialTexture(
  size = 64,
  inner = 'rgba(255,255,255,0.9)',
  mid = 'rgba(255,255,255,0.35)',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, inner)
    gradient.addColorStop(0.45, mid)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Generate an emissive window grid texture for city buildings. */
export function buildingWindowTexture(random: () => number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 128, 256)
    for (let y = 12; y < 246; y += 17) {
      for (let x = 10; x < 118; x += 13) {
        if (random() < 0.16) {
          const warmth = Math.floor(150 + random() * 80)
          ctx.fillStyle = `rgba(255, ${warmth}, ${Math.floor(warmth * 0.55)}, ${0.45 + random() * 0.5})`
          ctx.fillRect(x, y, 5, 6)
        }
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}
