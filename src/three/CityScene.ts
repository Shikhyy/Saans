import * as THREE from 'three'
import { addCityStructures, type Disposable } from './cityGeometry'
import { mulberry32, softRadialTexture } from './textures'

/**
 * The city is the clock.
 *
 * One scene, one render loop, no post-processing: fog density is the smog, the sky shader is the
 * hour, and the camera walks from a rooftop view down to street level as the day advances. Everything
 * that can be instanced is instanced; the loop stops when the canvas leaves the viewport or the tab
 * is hidden.
 */

export type Quality = 'high' | 'medium' | 'low'

export interface CityState {
  /** 0 at the hero, 1 at the end of the clock section */
  progress: number
  /** local hour, 0–24 */
  hour: number
  pm25: number
}

const QUALITY: Record<Quality, { dpr: number; buildings: number; particles: number; aa: boolean }> =
  {
    high: { dpr: 2, buildings: 240, particles: 3600, aa: true },
    medium: { dpr: 1.5, buildings: 180, particles: 1800, aa: true },
    low: { dpr: 1, buildings: 110, particles: 700, aa: false },
  }

const CAMERA_POSITIONS: readonly [number, number, number][] = [
  [0, 24, 66],
  [10, 22, 62],
  [16, 14, 40],
  [8, 7.5, 22],
  [2.5, 4.2, 8],
]

const CAMERA_TARGETS: readonly [number, number, number][] = [
  [0, 11, -44],
  [-2, 11, -48],
  [-4, 9.5, -50],
  [-4, 7.5, -52],
  [-3, 6.5, -54],
]

const SKY = {
  dayTop: new THREE.Color('#46596b'),
  dayHorizon: new THREE.Color('#96a0a8'),
  nightTop: new THREE.Color('#080d15'),
  nightHorizon: new THREE.Color('#241d18'),
  emberTop: new THREE.Color('#2b2030'),
  emberHorizon: new THREE.Color('#b4642f'),
  smogAmber: new THREE.Color('#c98a4a'),
}

export class CityScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly clock = new THREE.Clock()
  private readonly fog: THREE.FogExp2
  private readonly skyUniforms = {
    uTop: { value: SKY.nightTop.clone() },
    uHorizon: { value: SKY.nightHorizon.clone() },
    uSunDir: { value: new THREE.Vector3(0, 0.2, -1) },
    uSunColor: { value: new THREE.Color('#ffb26b') },
    uHaze: { value: 0.5 },
    uNight: { value: 1 },
    uGlow: { value: new THREE.Color('#ff9a4a') },
  }
  private readonly sun: THREE.Sprite
  private readonly sunMaterial: THREE.SpriteMaterial
  private readonly sunLight: THREE.DirectionalLight
  private readonly hemi: THREE.HemisphereLight
  private readonly particlePositions: Float32Array
  private readonly particleAttribute: THREE.BufferAttribute
  private readonly particleMaterial: THREE.PointsMaterial
  private readonly streetMaterial: THREE.PointsMaterial
  private readonly buildingMaterial: THREE.MeshStandardMaterial
  private readonly disposables: Disposable[] = []

  // Scratch vectors/colors reused across animation frames to avoid GC pressure at 60fps.
  private readonly tmpHorizon = new THREE.Color()
  private readonly tmpCamPos = new THREE.Vector3()
  private readonly tmpLookAt = new THREE.Vector3()
  private readonly tmpOffset = new THREE.Vector3()
  private readonly tmpSpherical = new THREE.Spherical()

  private frame = 0
  private active = false
  private disposed = false
  private state: CityState = { progress: 0, hour: 17, pm25: 180 }

  private yaw = 0
  private pitch = 0
  private targetYaw = 0
  private targetPitch = 0
  private dragging = false
  private lastPointer = { x: 0, y: 0 }

  private readonly reducedMotion: boolean
  private readonly resizeObserver: ResizeObserver
  private readonly unbindPointer: () => void

  constructor(
    private readonly canvas: HTMLCanvasElement,
    quality: Quality,
    reducedMotion: boolean,
  ) {
    const tier = QUALITY[quality]
    this.reducedMotion = reducedMotion

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: tier.aa,
      powerPreference: 'high-performance',
      alpha: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.5, 1200)
    this.fog = new THREE.FogExp2(0x1a1f26, 0.012)
    this.scene.fog = this.fog

    const random = mulberry32(20261123)

    this.buildSky()

    this.hemi = new THREE.HemisphereLight(0x9fb0c2, 0x14100c, 0.55)
    this.scene.add(this.hemi)
    this.sunLight = new THREE.DirectionalLight(0xffc38a, 1.6)
    this.sunLight.position.set(-40, 40, -60)
    this.scene.add(this.sunLight)

    this.buildingMaterial = addCityStructures(this.scene, random, tier.buildings, this.disposables)

    const particles = this.buildParticles(random, tier.particles)
    this.particlePositions = particles.positions
    this.particleAttribute = particles.attribute
    this.particleMaterial = particles.material

    this.streetMaterial = this.buildStreetLights()

    const sunParts = this.buildSun()
    this.sun = sunParts.sun
    this.sunMaterial = sunParts.material

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
    this.unbindPointer = this.bindPointer()
    this.render()
  }

  private buildSky(): void {
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld;
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uHaze;
        uniform float uNight;
        uniform vec3 uGlow;
        void main() {
          vec3 dir = normalize(vWorld);
          float h = clamp(dir.y * 1.35, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.72));
          float d = max(dot(dir, normalize(uSunDir)), 0.0);
          float disc = pow(d, 320.0);
          float glow = pow(d, 6.0);
          col += uSunColor * (disc * 1.4 + glow * 0.28) * (0.45 + uHaze * 0.9);
          col = mix(col, uHorizon, smoothstep(0.02, -0.15, dir.y) * 0.85);
          // Sodium light pollution: the sky over a smog city glows at the horizon all night.
          float band = exp(-max(dir.y, 0.0) * 5.5);
          col += uGlow * band * uNight * (0.16 + uHaze * 0.5);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    const skyGeometry = new THREE.SphereGeometry(600, 32, 20)
    this.disposables.push(skyGeometry, skyMaterial)
    this.scene.add(new THREE.Mesh(skyGeometry, skyMaterial))
  }

  private buildParticles(
    random: () => number,
    count: number,
  ): {
    positions: Float32Array
    attribute: THREE.BufferAttribute
    material: THREE.PointsMaterial
  } {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const radius = 8 + random() * 90
      const angle = random() * Math.PI * 2
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = random() * 42
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    const attribute = new THREE.BufferAttribute(positions, 3)
    geometry.setAttribute('position', attribute)
    const sprite = softRadialTexture(48, 'rgba(255,255,255,0.75)')
    const material = new THREE.PointsMaterial({
      size: 0.55,
      map: sprite,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color('#e8d2b4'),
      sizeAttenuation: true,
    })
    this.disposables.push(geometry, sprite, material)
    this.scene.add(new THREE.Points(geometry, material))
    return { positions, attribute, material }
  }

  private buildStreetLights(): THREE.PointsMaterial {
    const lightPositions: number[] = []
    for (let i = 20; i >= -130; i -= 11) {
      lightPositions.push(-6.5, 4.4, i, 6.5, 4.4, i)
    }
    const streetGeometry = new THREE.BufferGeometry()
    streetGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lightPositions, 3))
    const streetSprite = softRadialTexture(64, 'rgba(255,200,140,1)')
    const material = new THREE.PointsMaterial({
      size: 4.2,
      map: streetSprite,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color('#ffae5c'),
    })
    this.disposables.push(streetGeometry, streetSprite, material)
    this.scene.add(new THREE.Points(streetGeometry, material))
    return material
  }

  private buildSun(): { sun: THREE.Sprite; material: THREE.SpriteMaterial } {
    const sunSprite = softRadialTexture(256, 'rgba(255,214,160,1)')
    const material = new THREE.SpriteMaterial({
      map: sunSprite,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color('#ffb26b'),
    })
    this.disposables.push(sunSprite, material)
    const sun = new THREE.Sprite(material)
    sun.scale.set(80, 80, 1)
    this.scene.add(sun)
    return { sun, material }
  }

  private bindPointer(): () => void {
    const onDown = (event: PointerEvent) => {
      this.dragging = true
      this.lastPointer = { x: event.clientX, y: event.clientY }
      this.canvas.setPointerCapture(event.pointerId)
      this.canvas.style.cursor = 'grabbing'
    }
    const onMove = (event: PointerEvent) => {
      if (!this.dragging) return
      const dx = event.clientX - this.lastPointer.x
      const dy = event.clientY - this.lastPointer.y
      this.lastPointer = { x: event.clientX, y: event.clientY }
      this.targetYaw = THREE.MathUtils.clamp(this.targetYaw + dx * 0.0022, -0.5, 0.5)
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * 0.0016, -0.16, 0.2)
    }
    const onUp = () => {
      this.dragging = false
      this.canvas.style.cursor = 'grab'
    }
    this.canvas.addEventListener('pointerdown', onDown)
    this.canvas.addEventListener('pointermove', onMove)
    this.canvas.addEventListener('pointerup', onUp)
    this.canvas.addEventListener('pointercancel', onUp)

    return () => {
      this.canvas.removeEventListener('pointerdown', onDown)
      this.canvas.removeEventListener('pointermove', onMove)
      this.canvas.removeEventListener('pointerup', onUp)
      this.canvas.removeEventListener('pointercancel', onUp)
    }
  }

  resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth
    const height = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
    this.render()
  }

  update(state: CityState): void {
    this.state = state
    if (this.reducedMotion) this.render()
  }

  setActive(active: boolean): void {
    if (this.active === active) return
    this.active = active
    if (active && !this.reducedMotion) {
      this.clock.start()
      this.loop()
    } else if (!active) {
      cancelAnimationFrame(this.frame)
    }
  }

  private loop = (): void => {
    if (!this.active || this.disposed) return
    this.frame = requestAnimationFrame(this.loop)
    this.render()
  }

  private render(): void {
    if (this.disposed) return

    const { progress, hour, pm25 } = this.state
    const haze = THREE.MathUtils.clamp(pm25 / 420, 0, 1)

    const sunAngle = ((hour - 6) / 12) * Math.PI
    const elevation = Math.sin(sunAngle) * 1.15 - 0.18
    const azimuth = -0.85
    this.skyUniforms.uSunDir.value
      .set(
        Math.cos(azimuth) * Math.cos(elevation),
        Math.sin(elevation),
        Math.sin(azimuth) * Math.cos(elevation),
      )
      .normalize()

    const daylight = THREE.MathUtils.clamp(elevation * 2.2, 0, 1)
    const ember = THREE.MathUtils.clamp(1 - Math.abs(elevation) * 5.5, 0, 1) * (1 - haze * 0.25)

    this.skyUniforms.uTop.value
      .copy(SKY.nightTop)
      .lerp(SKY.dayTop, daylight)
      .lerp(SKY.emberTop, ember * 0.55)
    this.tmpHorizon
      .copy(SKY.nightHorizon)
      .lerp(SKY.dayHorizon, daylight)
      .lerp(SKY.emberHorizon, ember * 0.75)
      .lerp(SKY.smogAmber, haze * 0.32)
    this.skyUniforms.uHorizon.value.copy(this.tmpHorizon)
    this.skyUniforms.uHaze.value = haze
    this.skyUniforms.uNight.value = 1 - daylight

    this.fog.color.copy(this.tmpHorizon).multiplyScalar(0.82)
    this.fog.density = 0.0055 + haze * 0.03

    const night = 1 - daylight
    this.buildingMaterial.emissiveIntensity = 0.18 + night * 0.72
    this.streetMaterial.opacity = 0.3 + night * 0.7
    this.hemi.intensity = 0.34 + daylight * 0.5
    this.sunLight.intensity = 0.25 + daylight * 1.5
    this.sunLight.color.setRGB(1, 0.72 - haze * 0.14, 0.5 - haze * 0.12)

    this.sun.position.copy(this.skyUniforms.uSunDir.value).multiplyScalar(420)
    this.sunMaterial.opacity =
      THREE.MathUtils.clamp(0.25 + daylight * 0.9, 0, 1) * (1 - haze * 0.45)
    this.sun.scale.setScalar(70 + haze * 70)

    this.particleMaterial.opacity = 0.08 + haze * 0.5
    this.particleMaterial.size = 0.42 + haze * 0.5

    const p = THREE.MathUtils.clamp(progress, 0, 1)
    const ease = p * p * (3 - 2 * p)
    const segment = ease * (CAMERA_POSITIONS.length - 1)
    const index = Math.min(CAMERA_POSITIONS.length - 2, Math.floor(segment))
    const local = segment - index
    const a = CAMERA_POSITIONS[index]
    const b = CAMERA_POSITIONS[index + 1]
    const ta = CAMERA_TARGETS[index]
    const tb = CAMERA_TARGETS[index + 1]
    if (!a || !b || !ta || !tb) return

    const drift = this.reducedMotion ? 0 : Math.sin(this.clock.elapsedTime * 0.25) * 0.5

    this.yaw += (this.targetYaw - this.yaw) * 0.08
    this.pitch += (this.targetPitch - this.pitch) * 0.08

    this.tmpCamPos.set(
      THREE.MathUtils.lerp(a[0], b[0], local) + drift,
      THREE.MathUtils.lerp(a[1], b[1], local) + this.pitch * 6,
      THREE.MathUtils.lerp(a[2], b[2], local),
    )
    this.tmpLookAt.set(
      THREE.MathUtils.lerp(ta[0], tb[0], local),
      THREE.MathUtils.lerp(ta[1], tb[1], local),
      THREE.MathUtils.lerp(ta[2], tb[2], local),
    )

    this.tmpOffset.copy(this.tmpCamPos).sub(this.tmpLookAt)
    this.tmpSpherical.setFromVector3(this.tmpOffset)
    this.tmpSpherical.theta += this.yaw
    this.tmpSpherical.phi = THREE.MathUtils.clamp(
      this.tmpSpherical.phi + this.pitch * 0.6,
      0.35,
      1.52,
    )
    this.tmpOffset.setFromSpherical(this.tmpSpherical)
    this.tmpCamPos.copy(this.tmpLookAt).add(this.tmpOffset)

    this.camera.position.copy(this.tmpCamPos)
    this.camera.lookAt(this.tmpLookAt)

    if (!this.reducedMotion) {
      const array = this.particlePositions
      const time = this.clock.elapsedTime
      for (let i = 0; i < array.length; i += 3) {
        array[i + 1] = (array[i + 1] ?? 0) + 0.014 + haze * 0.02
        array[i] = (array[i] ?? 0) + Math.sin(time * 0.3 + i) * 0.004
        if ((array[i + 1] ?? 0) > 44) array[i + 1] = 0
      }
      this.particleAttribute.needsUpdate = true
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.unbindPointer()
    this.resizeObserver.disconnect()
    for (const item of this.disposables) item.dispose()
    this.renderer.dispose()
  }
}
