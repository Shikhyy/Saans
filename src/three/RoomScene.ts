import * as THREE from 'three'

/**
 * The home, in cutaway. The room is a model of the mass balance in `core/indoor.ts`: turn the
 * purifier on and the particles are drawn out of the air at the CADR the household actually owns.
 */

function glowTexture(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.3)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export class RoomScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly particles: THREE.Points
  private readonly particleMaterial: THREE.PointsMaterial
  private readonly fan: THREE.Mesh
  private readonly led: THREE.Mesh
  private readonly windowGlow: THREE.Mesh
  private readonly windowLight: THREE.PointLight
  private readonly disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = []
  private readonly reducedMotion: boolean
  private readonly resizeObserver: ResizeObserver

  private purifierOn = false
  private indoorPm25 = 200
  private frame = 0
  private active = false
  private disposed = false
  private elapsed = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    reducedMotion: boolean,
  ) {
    this.reducedMotion = reducedMotion

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(new THREE.Color('#0b0d11'))

    this.camera = new THREE.PerspectiveCamera(32, 4 / 3, 0.1, 100)
    this.camera.position.set(7.4, 6.2, 9.2)
    this.camera.lookAt(0, 1.1, -0.8)

    this.scene.add(new THREE.AmbientLight(0xffd7b0, 0.5))

    const key = new THREE.PointLight(0xffb26b, 22, 22, 2)
    key.position.set(1.6, 3.2, 2.2)
    this.scene.add(key)

    this.windowLight = new THREE.PointLight(0x9fb6c8, 12, 18, 2)
    this.windowLight.position.set(-1.4, 2.2, -3.6)
    this.scene.add(this.windowLight)

    const floorGeometry = new THREE.BoxGeometry(8, 0.24, 8)
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.9 })
    this.disposables.push(floorGeometry, floorMaterial)
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.position.set(0, -0.12, 0)
    this.scene.add(floor)

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 1 })
    const backWall = new THREE.BoxGeometry(8, 4.4, 0.2)
    const sideWall = new THREE.BoxGeometry(0.2, 4.4, 8)
    this.disposables.push(wallMaterial, backWall, sideWall)
    const back = new THREE.Mesh(backWall, wallMaterial)
    back.position.set(0, 2.2, -4)
    this.scene.add(back)
    const side = new THREE.Mesh(sideWall, wallMaterial)
    side.position.set(-4, 2.2, 0)
    this.scene.add(side)

    // window: the outside air, as a lit plane
    const windowGeometry = new THREE.PlaneGeometry(2.6, 1.8)
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xc99055 })
    this.disposables.push(windowGeometry, windowMaterial)
    this.windowGlow = new THREE.Mesh(windowGeometry, windowMaterial)
    this.windowGlow.position.set(1.1, 2.4, -3.88)
    this.scene.add(this.windowGlow)

    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.8 })
    this.disposables.push(frameMaterial)
    const barGeometry = new THREE.BoxGeometry(2.8, 0.1, 0.12)
    this.disposables.push(barGeometry)
    for (const y of [3.34, 2.4, 1.46]) {
      const bar = new THREE.Mesh(barGeometry, frameMaterial)
      bar.position.set(1.1, y, -3.84)
      this.scene.add(bar)
    }
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.12), frameMaterial)
    this.disposables.push(mullion.geometry)
    mullion.position.set(1.1, 2.4, -3.84)
    this.scene.add(mullion)

    // bed
    const bedMaterial = new THREE.MeshStandardMaterial({ color: 0x3b302a, roughness: 0.95 })
    const blanketMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1 })
    const bedGeometry = new THREE.BoxGeometry(3, 0.42, 2)
    const blanketGeometry = new THREE.BoxGeometry(2.9, 0.14, 1.9)
    const pillowGeometry = new THREE.BoxGeometry(1.1, 0.22, 0.5)
    this.disposables.push(bedMaterial, blanketMaterial, bedGeometry, blanketGeometry, pillowGeometry)
    const bed = new THREE.Mesh(bedGeometry, bedMaterial)
    bed.position.set(-2.2, 0.3, -2.6)
    this.scene.add(bed)
    const blanket = new THREE.Mesh(blanketGeometry, blanketMaterial)
    blanket.position.set(-2.2, 0.56, -2.6)
    this.scene.add(blanket)
    const pillow = new THREE.Mesh(pillowGeometry, bedMaterial)
    pillow.position.set(-2.2, 0.62, -3.35)
    this.scene.add(pillow)

    // stove
    const counterMaterial = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.7 })
    const counterGeometry = new THREE.BoxGeometry(2.4, 0.9, 1.3)
    this.disposables.push(counterMaterial, counterGeometry)
    const counter = new THREE.Mesh(counterGeometry, counterMaterial)
    counter.position.set(2.2, 0.45, -3.2)
    this.scene.add(counter)

    const burnerMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b2b2b,
      emissive: new THREE.Color('#ff7a3d'),
      emissiveIntensity: 0.6,
      roughness: 0.6,
    })
    const burnerGeometry = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 16)
    this.disposables.push(burnerMaterial, burnerGeometry)
    for (const x of [1.7, 2.7]) {
      const burner = new THREE.Mesh(burnerGeometry, burnerMaterial)
      burner.position.set(x, 0.93, -3.2)
      this.scene.add(burner)
    }

    // purifier
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d4cc, roughness: 0.55 })
    const bodyGeometry = new THREE.CylinderGeometry(0.42, 0.42, 1.3, 24)
    this.disposables.push(bodyMaterial, bodyGeometry)
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.set(2.6, 0.65, 1.9)
    this.scene.add(body)

    const fanGeometry = new THREE.CircleGeometry(0.3, 20)
    const fanMaterial = new THREE.MeshStandardMaterial({
      color: 0x14171c,
      roughness: 0.8,
      side: THREE.DoubleSide,
    })
    this.disposables.push(fanGeometry, fanMaterial)
    this.fan = new THREE.Mesh(fanGeometry, fanMaterial)
    this.fan.position.set(2.6, 1.32, 1.9)
    this.fan.rotation.x = -Math.PI / 2
    this.scene.add(this.fan)

    const ledMaterial = new THREE.MeshBasicMaterial({ color: 0x2f3a33 })
    const ledGeometry = new THREE.SphereGeometry(0.06, 8, 8)
    this.disposables.push(ledMaterial, ledGeometry)
    this.led = new THREE.Mesh(ledGeometry, ledMaterial)
    this.led.position.set(2.6, 1.1, 2.32)
    this.scene.add(this.led)

    // particles
    const count = 700
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = -3.6 + Math.random() * 7.2
      positions[i * 3 + 1] = 0.2 + Math.random() * 3.2
      positions[i * 3 + 2] = -3.6 + Math.random() * 7.2
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const sprite = glowTexture()
    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.075,
      map: sprite,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color('#e7b98a'),
    })
    this.disposables.push(geometry, sprite, this.particleMaterial)
    this.particles = new THREE.Points(geometry, this.particleMaterial)
    this.scene.add(this.particles)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
    this.render()
  }

  resize(): void {
    const width = this.canvas.clientWidth || 640
    const height = this.canvas.clientHeight || 480
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
    if (this.reducedMotion) this.render()
  }

  setPurifier(on: boolean): void {
    this.purifierOn = on
    const material = this.led.material as THREE.MeshBasicMaterial
    material.color.set(on ? '#4fd08a' : '#2f3a33')
    if (this.reducedMotion) this.render()
  }

  setIndoor(pm25: number, hazeColor: string): void {
    this.indoorPm25 = pm25
    const material = this.windowGlow.material as THREE.MeshBasicMaterial
    material.color.set(hazeColor)
    this.windowLight.intensity = 6 + Math.min(20, pm25 / 40)
    if (this.reducedMotion) this.render()
  }

  setActive(active: boolean): void {
    if (this.active === active) return
    this.active = active
    if (active && !this.reducedMotion) this.loop()
    else cancelAnimationFrame(this.frame)
  }

  private loop = (): void => {
    if (!this.active || this.disposed) return
    this.frame = requestAnimationFrame(this.loop)
    this.render()
  }

  private render(): void {
    if (this.disposed) return
    this.elapsed += 0.016

    const intensity = THREE.MathUtils.clamp(this.indoorPm25 / 400, 0.05, 1)
    this.particleMaterial.opacity = 0.08 + intensity * 0.75

    if (this.purifierOn) {
      this.fan.rotation.z += 0.42
    }

    if (!this.reducedMotion) {
      const attribute = this.particles.geometry.getAttribute('position')
      const array = attribute.array as Float32Array
      const target = new THREE.Vector3(2.6, 0.7, 1.9)

      for (let i = 0; i < array.length; i += 3) {
        let x = array[i] ?? 0
        let y = array[i + 1] ?? 0
        let z = array[i + 2] ?? 0

        if (this.purifierOn) {
          const dx = target.x - x
          const dy = target.y - y
          const dz = target.z - z
          const distance = Math.hypot(dx, dy, dz) || 1
          const pull = 0.055 + intensity * 0.05
          x += (dx / distance) * pull
          y += (dy / distance) * pull
          z += (dz / distance) * pull
          if (distance < 0.5) {
            x = -3.6 + Math.random() * 7.2
            y = 0.4 + Math.random() * 3
            z = -3.6 + Math.random() * 7.2
          }
        } else {
          x += Math.sin(this.elapsed * 0.6 + i) * 0.0035
          y += 0.0016 + intensity * 0.0025
          z += Math.cos(this.elapsed * 0.5 + i) * 0.0035
          if (y > 3.9) y = 0.3
        }

        array[i] = x
        array[i + 1] = y
        array[i + 2] = z
      }
      attribute.needsUpdate = true
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    for (const item of this.disposables) item.dispose()
    this.renderer.dispose()
  }
}
