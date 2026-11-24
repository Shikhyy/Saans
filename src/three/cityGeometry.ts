import * as THREE from 'three'
import { buildingWindowTexture } from './textures'

export type Disposable = THREE.BufferGeometry | THREE.Material | THREE.Texture

function addRoofFurniture(
  scene: THREE.Scene,
  random: () => number,
  buildings: THREE.InstancedMesh,
  placed: number,
  disposables: Disposable[],
): void {
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const composePos = new THREE.Vector3()
  const composeScale = new THREE.Vector3()

  const tankGeometry = new THREE.CylinderGeometry(0.9, 0.9, 1.4, 10)
  const tankMaterial = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 1 })
  disposables.push(tankGeometry, tankMaterial)
  const tanks = new THREE.InstancedMesh(tankGeometry, tankMaterial, 90)
  let tankCount = 0
  for (let i = 0; i < placed && tankCount < 90; i += 2) {
    buildings.getMatrixAt(i, matrix)
    matrix.decompose(position, quaternion, scale)
    if (random() > 0.55) continue
    matrix.makeScale(1, 1, 1)
    matrix.setPosition(position.x + scale.x * 0.22, scale.y + 0.7, position.z - scale.z * 0.18)
    tanks.setMatrixAt(tankCount, matrix)
    tankCount += 1
  }
  tanks.count = tankCount
  tanks.instanceMatrix.needsUpdate = true
  scene.add(tanks)

  const parapetGeometry = new THREE.BoxGeometry(1, 1, 1)
  const parapetMaterial = new THREE.MeshStandardMaterial({ color: 0x12161c, roughness: 1 })
  const antennaGeometry = new THREE.CylinderGeometry(0.055, 0.075, 1, 5)
  const antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 1 })
  disposables.push(parapetGeometry, parapetMaterial, antennaGeometry, antennaMaterial)

  const parapets = new THREE.InstancedMesh(parapetGeometry, parapetMaterial, placed)
  const setbacks = new THREE.InstancedMesh(
    parapetGeometry,
    parapetMaterial,
    Math.ceil(placed * 0.4),
  )
  const antennas = new THREE.InstancedMesh(antennaGeometry, antennaMaterial, 60)
  let setbackCount = 0
  let antennaCount = 0

  for (let i = 0; i < placed; i += 1) {
    buildings.getMatrixAt(i, matrix)
    matrix.decompose(position, quaternion, scale)
    const roof = position.y + scale.y / 2

    matrix.compose(
      composePos.set(position.x, roof + 0.16, position.z),
      quaternion,
      composeScale.set(scale.x * 1.04, 0.32, scale.z * 1.04),
    )
    parapets.setMatrixAt(i, matrix)

    if (scale.y > 8 && random() < 0.38 && setbackCount < setbacks.count) {
      const lift = 1.4 + random() * 2.4
      matrix.compose(
        composePos.set(
          position.x + (random() - 0.5) * scale.x * 0.2,
          roof + 0.32 + lift / 2,
          position.z + (random() - 0.5) * scale.z * 0.2,
        ),
        quaternion,
        composeScale.set(
          scale.x * (0.5 + random() * 0.18),
          lift,
          scale.z * (0.5 + random() * 0.18),
        ),
      )
      setbacks.setMatrixAt(setbackCount, matrix)
      setbackCount += 1
    }

    if (random() < 0.22 && antennaCount < 60) {
      const height = 1.4 + random() * 2.6
      matrix.compose(
        composePos.set(
          position.x + (random() - 0.5) * scale.x * 0.7,
          roof + height / 2,
          position.z + (random() - 0.5) * scale.z * 0.7,
        ),
        quaternion,
        composeScale.set(1, height, 1),
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
  scene.add(parapets, setbacks, antennas)
}

function addFarHorizon(scene: THREE.Scene, random: () => number, disposables: Disposable[]): void {
  const farGeometry = new THREE.BoxGeometry(1, 1, 1)
  const farMaterial = new THREE.MeshBasicMaterial({ color: 0x101318 })
  disposables.push(farGeometry, farMaterial)
  const far = new THREE.InstancedMesh(farGeometry, farMaterial, 220)
  const matrix = new THREE.Matrix4()
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
  scene.add(far)
}

/** Populate ground plane, instanced buildings, rooftop furniture, and skyline silhouette ring. */
export function addCityStructures(
  scene: THREE.Scene,
  random: () => number,
  count: number,
  disposables: Disposable[],
): THREE.MeshStandardMaterial {
  const groundGeometry = new THREE.PlaneGeometry(1400, 1400)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d0f13,
    roughness: 1,
    metalness: 0,
  })
  disposables.push(groundGeometry, groundMaterial)
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1)
  const windows = buildingWindowTexture(random)
  const material = new THREE.MeshStandardMaterial({
    color: 0x1b1f26,
    roughness: 0.86,
    metalness: 0.06,
    emissive: new THREE.Color('#ffb066'),
    emissiveMap: windows,
    emissiveIntensity: 0,
  })
  disposables.push(buildingGeometry, windows, material)

  const buildings = new THREE.InstancedMesh(buildingGeometry, material, count)
  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()
  const palette = ['#1a1e25', '#20252d', '#171a20', '#242a33', '#14171c']

  let placed = 0
  let guard = 0
  while (placed < count && guard < 4000) {
    guard += 1
    const gridX = Math.floor(random() * 18) - 9
    const gridZ = Math.floor(random() * 20) - 15
    if (Math.abs(gridX) < 1 || Math.abs(gridZ) < 1) continue
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
  scene.add(buildings)

  addRoofFurniture(scene, random, buildings, placed, disposables)
  addFarHorizon(scene, random, disposables)

  return material
}
