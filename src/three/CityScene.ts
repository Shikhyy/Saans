import * as THREE from 'three'

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

const QUALITY: Record<Quality, { dpr: number; buildings: number; particles: number; aa: boolean }> = {
  high: { dpr: 2, buildings: 240, particles: 3600, aa: true },
  medium: { dpr: 1.5, buildings: 180, particles: 1800, aa: true },
  low: { dpr: 1, buildings: 110, particles: 700, aa: false },
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function softTexture(size = 64, inner = 'rgba(255,255,255,0.9)'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, inner)
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function windowTexture(random: () => number): THREE.CanvasTexture {
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

const SKY = {
  dayTop: new THREE.Color('#46596b'),
  dayHorizon: new THREE.Color('#96a0a8'),
  nightTop: new THREE.Color('#080d15'),
  nightHorizon: new THREE.Color('#241d18'),
  emberTop: new THREE.Color('#2b2030'),
  emberHorizon: new THREE.Color('#b4642f'),
}

export class CityScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly clock = new THREE.Clock()
  private readonly fog: THREE.FogExp2
  private readonly skyMaterial: THREE.ShaderMaterial
  private readonly sun: THREE.Sprite
  private readonly sunLight: THREE.DirectionalLight
  private readonly hemi: THREE.HemisphereLight
  private readonly particles: THREE.Points
  private readonly particleMaterial: THREE.PointsMaterial
  private readonly streetLights: THREE.Points
  private readonly streetMaterial: THREE.PointsMaterial
  private readonly buildingMaterial: THREE.MeshStandardMaterial
  private readonly disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = []

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

    // ---- sky
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: SKY.nightTop.clone() },
        uHorizon: { value: SKY.nightHorizon.clone() },
        uSunDir: { value: new THREE.Vector3(0, 0.2, -1) },
        uSunColor: { value: new THREE.Color('#ffb26b') },
        uHaze: { value: 0.5 },
        uNight: { value: 1 },
        uGlow: { value: new THREE.Color('#ff9a4a') },
      },
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
    this.disposables.push(skyGeometry, this.skyMaterial)
    this.scene.add(new THREE.Mesh(skyGeometry, this.skyMaterial))

    // ---- light
    this.hemi = new THREE.HemisphereLight(0x9fb0c2, 0x14100c, 0.55)
    this.scene.add(this.hemi)

    this.sunLight = new THREE.DirectionalLight(0xffc38a, 1.6)
    this.sunLight.position.set(-40, 40, -60)
    this.scene.add(this.sunLight)

    // ---- ground
    const groundGeometry = new THREE.PlaneGeometry(1400, 1400)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0d0f13,
      roughness: 1,
      metalness: 0,
    })
    this.disposables.push(groundGeometry, groundMaterial)
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    this.scene.add(ground)

    // ---- buildings
    const buildingGeometry = new THREE.BoxGeometry(1, 1, 1)
    const windows = windowTexture(random)
    this.disposables.push(buildingGeometry, windows)
    this.buildingMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b1f26,
      roughness: 0.86,
      metalness: 0.06,
      emissive: new THREE.Color('#ffb066'),
      emissiveMap: windows,
      emissiveIntensity: 0,
    })
    this.disposables.push(this.buildingMaterial)

    const buildings = new THREE.InstancedMesh(buildingGeometry, this.buildingMaterial, tier.buildings)
    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    const palette = ['#1a1e25', '#20252d', '#171a20', '#242a33', '#14171c']

    let placed = 0
    let guard = 0
    while (placed < tier.buildings && guard < 4000) {
      guard += 1
      const gridX = Math.floor(random() * 18) - 9
      const gridZ = Math.floor(random() * 20) - 15
      if (Math.abs(gridX) < 1 || Math.abs(gridZ) < 1) continue // keep the two streets clear
      const x = gridX * 8 + (random() - 0.5) * 2.6
      const z = gridZ * 8 + (random() - 0.5) * 2.6 - 26
      const distance = Math.hypot(x, z + 26)
      if (distance < 10) continue
      const height = 3.5 + random() * (distance > 62 ? 21 : 13)
      const width = 3.2 + random() * 3.4
      const depth = 3.2 + random() * 3.4
      matrix.makeScale(width, height, depth)
      matrix.setPosition(x, height / 2, z)
      buildings.setMatrixAt(placed, matrix)
      color.set(palette[Math.floor(random() * palette.length)] ?? '#1a1e25')
      buildings.setColorAt(placed, color)
      placed += 1
    }
    buildings.count = placed
    buildings.instanceMatrix.needsUpdate = true
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true
    this.scene.add(buildings)

    // ---- water tanks on roofs (the skyline's real silhouette)
    const tankGeometry = new THREE.CylinderGeometry(0.9, 0.9, 1.4, 10)
    const tankMaterial = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 1 })
    this.disposables.push(tankGeometry, tankMaterial)
    const tanks = new THREE.InstancedMesh(tankGeometry, tankMaterial, 90)
    let tankCount = 0
    for (let i = 0; i < placed && tankCount < 90; i += 2) {
      buildings.getMatrixAt(i, matrix)
      const position = new THREE.Vector3()
      const scale = new THREE.Vector3()
      const quaternion = new THREE.Quaternion()
      matrix.decompose(position, quaternion, scale)
      if (random() > 0.55) continue
      matrix.makeScale(1, 1, 1)
      matrix.setPosition(position.x + scale.x * 0.22, scale.y + 0.7, position.z - scale.z * 0.18)
      tanks.setMatrixAt(tankCount, matrix)
      tankCount += 1
    }
    tanks.count = tankCount
    tanks.instanceMatrix.needsUpdate = true
    this.scene.add(tanks)

    // ---- roof furniture: a Delhi skyline is parapets, stair boxes and antennas before it is towers
    const parapetGeometry = new THREE.BoxGeometry(1, 1, 1)
    const parapetMaterial = new THREE.MeshStandardMaterial({ color: 0x12161c, roughness: 1 })
    this.disposables.push(parapetGeometry, parapetMaterial)
    const parapets = new THREE.InstancedMesh(parapetGeometry, parapetMaterial, placed)
    const setbacks = new THREE.InstancedMesh(parapetGeometry, parapetMaterial, Math.ceil(placed * 0.4))
    let setbackCount = 0

    const antennaGeometry = new THREE.CylinderGeometry(0.055, 0.075, 1, 5)
    const antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 1 })
    this.disposables.push(antennaGeometry, antennaMaterial)
    const antennas = new THREE.InstancedMesh(antennaGeometry, antennaMaterial, 60)
    let antennaCount = 0

    for (let i = 0; i < placed; i += 1) {
      buildings.getMatrixAt(i, matrix)
      const position = new THREE.Vector3()
      const scale = new THREE.Vector3()
      const quaternion = new THREE.Quaternion()
      matrix.decompose(position, quaternion, scale)
      const roof = position.y + scale.y / 2

      matrix.compose(
        new THREE.Vector3(position.x, roof + 0.16, position.z),
        quaternion,
        new THREE.Vector3(scale.x * 1.04, 0.32, scale.z * 1.04),
      )
      parapets.setMatrixAt(i, matrix)

      if (scale.y > 8 && random() < 0.38 && setbackCount < setbacks.count) {
        const lift = 1.4 + random() * 2.4
        matrix.compose(
          new THREE.Vector3(
            position.x + (random() - 0.5) * scale.x * 0.2,
            roof + 0.32 + lift / 2,
            position.z + (random() - 0.5) * scale.z * 0.2,
          ),
          quaternion,
          new THREE.Vector3(scale.x * (0.5 + random() * 0.18), lift, scale.z * (0.5 + random() * 0.18)),
        )
        setbacks.setMatrixAt(setbackCount, matrix)
        setbackCount += 1
      }

      if (random() < 0.22 && antennaCount < 60) {
        const height = 1.4 + random() * 2.6
        matrix.compose(
          new THREE.Vector3(
            position.x + (random() - 0.5) * scale.x * 0.7,
            roof + height / 2,
            position.z + (random() - 0.5) * scale.z * 0.7,
          ),
          quaternion,
          new THREE.Vector3(1, height, 1),
        )
        antennas.setMatrixAt(antennaCount, matrix)
        antennaCount += 1
      }
    }
    parapets.instanceMatrix.needsUpdate = true
    setbacks.count = setbackCount
    setbacks.instanceMatrix.needsUpdate = true
    antennas.count = antennaCount
    antennas.instanceMatrix.needsUpdate = true
    this.scene.add(parapets, setbacks, antennas)

    // ---- the far city: a low ring of silhouettes so the horizon is a city, not an edge
    const farGeometry = new THREE.BoxGeometry(1, 1, 1)
    const farMaterial = new THREE.MeshBasicMaterial({ color: 0x101318 })
    this.disposables.push(farGeometry, farMaterial)
    const far = new THREE.InstancedMesh(farGeometry, farMaterial, 220)
    for (let i = 0; i < 220; i += 1) {
      const angle = (i / 220) * Math.PI * 2 + random() * 0.04
      const radius = 120 + random() * 110
      const height = 3 + random() * 11
      const width = 5 + random() * 14
      matrix.makeScale(width, height, 5 + random() * 14)
      matrix.setPosition(Math.cos(angle) * radius, height / 2 - 0.4, Math.sin(angle) * radius - 40)
      far.setMatrixAt(i, matrix)
    }
    far.instanceMatrix.needsUpdate = true
    this.scene.add(far)

    // ---- particles: the air itself
    const particleGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(tier.particles * 3)
    for (let i = 0; i < tier.particles; i += 1) {
      const radius = 8 + random() * 90
      const angle = random() * Math.PI * 2
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = random() * 42
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particleSprite = softTexture(48, 'rgba(255,255,255,0.75)')
    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.55,
      map: particleSprite,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color('#e8d2b4'),
      sizeAttenuation: true,
    })
    this.disposables.push(particleGeometry, particleSprite, this.particleMaterial)
    this.particles = new THREE.Points(particleGeometry, this.particleMaterial)
    this.scene.add(this.particles)

    // ---- street lights
    const lightPositions: number[] = []
    for (let i = 20; i >= -130; i -= 11) {
      lightPositions.push(-6.5, 4.4, i, 6.5, 4.4, i)
    }
    const streetGeometry = new THREE.BufferGeometry()
    streetGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lightPositions, 3))
    const streetSprite = softTexture(64, 'rgba(255,200,140,1)')
    this.streetMaterial = new THREE.PointsMaterial({
      size: 4.2,
      map: streetSprite,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color('#ffae5c'),
    })
    this.disposables.push(streetGeometry, streetSprite, this.streetMaterial)
    this.streetLights = new THREE.Points(streetGeometry, this.streetMaterial)
    this.scene.add(this.streetLights)

    // ---- sun
    const sunMaterial = new THREE.SpriteMaterial({
      map: softTexture(256, 'rgba(255,214,160,1)'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color('#ffb26b'),
    })
    this.sun = new THREE.Sprite(sunMaterial)
    this.sun.scale.set(80, 80, 1)
    this.scene.add(this.sun)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
    this.bindPointer()
    this.render()
  }

  private bindPointer(): void {
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

    // ---- sun position
    const sunAngle = ((hour - 6) / 12) * Math.PI
    const elevation = Math.sin(sunAngle) * 1.15 - 0.18
    const azimuth = -0.85
    const sunDirection = new THREE.Vector3(
      Math.cos(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(azimuth) * Math.cos(elevation),
    ).normalize()

    // ---- sky colours
    const daylight = THREE.MathUtils.clamp(elevation * 2.2, 0, 1)
    const ember = THREE.MathUtils.clamp(1 - Math.abs(elevation) * 5.5, 0, 1) * (1 - haze * 0.25)

    const top = SKY.nightTop.clone().lerp(SKY.dayTop, daylight).lerp(SKY.emberTop, ember * 0.55)
    const horizon = SKY.nightHorizon
      .clone()
      .lerp(SKY.dayHorizon, daylight)
      .lerp(SKY.emberHorizon, ember * 0.75)
      .lerp(new THREE.Color('#c98a4a'), haze * 0.32)

    this.skyMaterial.uniforms.uTop!.value = top
    this.skyMaterial.uniforms.uHorizon!.value = horizon
    this.skyMaterial.uniforms.uSunDir!.value = sunDirection
    this.skyMaterial.uniforms.uHaze!.value = haze
    this.skyMaterial.uniforms.uNight!.value = 1 - daylight

    this.fog.color.copy(horizon).multiplyScalar(0.82)
    this.fog.density = 0.0055 + haze * 0.03

    // ---- lights
    const night = 1 - daylight
    this.buildingMaterial.emissiveIntensity = 0.18 + night * 0.72
    this.streetMaterial.opacity = 0.3 + night * 0.7
    this.hemi.intensity = 0.34 + daylight * 0.5
    this.sunLight.intensity = 0.25 + daylight * 1.5
    this.sunLight.color.setRGB(1, 0.72 - haze * 0.14, 0.5 - haze * 0.12)

    this.sun.position.copy(sunDirection).multiplyScalar(420)
    const sunMaterial = this.sun.material as THREE.SpriteMaterial
    sunMaterial.opacity = THREE.MathUtils.clamp(0.25 + daylight * 0.9, 0, 1) * (1 - haze * 0.45)
    this.sun.scale.setScalar(70 + haze * 70)

    // ---- particles
    this.particleMaterial.opacity = 0.08 + haze * 0.5
    this.particleMaterial.size = 0.42 + haze * 0.5

    // ---- camera: the walk down
    const p = THREE.MathUtils.clamp(progress, 0, 1)
    const ease = p * p * (3 - 2 * p)
    const positions: [number, number, number][] = [
      [0, 24, 66],
      [10, 22, 62],
      [16, 14, 40],
      [8, 7.5, 22],
      [2.5, 4.2, 8],
    ]
    const targets: [number, number, number][] = [
      [0, 11, -44],
      [-2, 11, -48],
      [-4, 9.5, -50],
      [-4, 7.5, -52],
      [-3, 6.5, -54],
    ]

    const segment = ease * (positions.length - 1)
    const index = Math.min(positions.length - 2, Math.floor(segment))
    const local = segment - index
    const a = positions[index] ?? positions[0]!
    const b = positions[index + 1] ?? positions[positions.length - 1]!
    const ta = targets[index] ?? targets[0]!
    const tb = targets[index + 1] ?? targets[targets.length - 1]!

    const drift = this.reducedMotion ? 0 : Math.sin(this.clock.elapsedTime * 0.25) * 0.5

    this.yaw += (this.targetYaw - this.yaw) * 0.08
    this.pitch += (this.targetPitch - this.pitch) * 0.08

    const cameraPosition = new THREE.Vector3(
      THREE.MathUtils.lerp(a[0], b[0], local) + drift,
      THREE.MathUtils.lerp(a[1], b[1], local) + this.pitch * 6,
      THREE.MathUtils.lerp(a[2], b[2], local),
    )
    const lookAt = new THREE.Vector3(
      THREE.MathUtils.lerp(ta[0], tb[0], local),
      THREE.MathUtils.lerp(ta[1], tb[1], local),
      THREE.MathUtils.lerp(ta[2], tb[2], local),
    )

    // Orbit: rotate the camera around the look-at point.
    const offset = cameraPosition.clone().sub(lookAt)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    spherical.theta += this.yaw
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + this.pitch * 0.6, 0.35, 1.52)
    offset.setFromSpherical(spherical)
    cameraPosition.copy(lookAt).add(offset)

    this.camera.position.copy(cameraPosition)
    this.camera.lookAt(lookAt)

    if (!this.reducedMotion) {
      const positionsAttribute = this.particles.geometry.getAttribute('position')
      const array = positionsAttribute.array as Float32Array
      const time = this.clock.elapsedTime
      for (let i = 0; i < array.length; i += 3) {
        array[i + 1] = (array[i + 1] ?? 0) + 0.014 + haze * 0.02
        array[i] = (array[i] ?? 0) + Math.sin(time * 0.3 + i) * 0.004
        if ((array[i + 1] ?? 0) > 44) array[i + 1] = 0
      }
      positionsAttribute.needsUpdate = true
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    for (const item of this.disposables) item.dispose()
    this.sun.material.dispose()
    this.renderer.dispose()
  }
}
