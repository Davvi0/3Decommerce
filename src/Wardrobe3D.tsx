
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export type WardrobePiece = {
  id: string
  name: string
  color: string
}

type Wardrobe3DProps = {
  pieces: WardrobePiece[]
  activeIndex: number
  onSelect: (index: number) => void
  onNavigate?: (index: number) => void
  mode?: 'wardrobe' | 'detail'
}

type ClothMotionState = {
  angularVelocity: number
  linearVelocityX: number
  linearVelocityZ: number
}

type ClothMeshData = {
  geometry: THREE.BufferGeometry
  position: THREE.BufferAttribute
  base: Float32Array
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type PointerCaptureEvent = {
  target: unknown
  pointerId: number
}

type PointerCaptureTarget = {
  setPointerCapture?: (pointerId: number) => void
  hasPointerCapture?: (pointerId: number) => boolean
  releasePointerCapture?: (pointerId: number) => void
}

function capturePointer(event: PointerCaptureEvent) {
  const target = event.target as PointerCaptureTarget | null
  target?.setPointerCapture?.(event.pointerId)
}

function releaseCapturedPointer(event: PointerCaptureEvent) {
  const target = event.target as PointerCaptureTarget | null

  if (target?.hasPointerCapture?.(event.pointerId)) {
    target.releasePointerCapture?.(event.pointerId)
  }
}

/* ======================================================
   MODELO DA CAMISETA
   ====================================================== */

function ShirtModel({
  color,
  targetHeight,
  centerY = 0,
  simulateCloth = false,
  clothMotion,
}: {
  color: string
  targetHeight: number
  centerY?: number
  simulateCloth?: boolean
  clothMotion?: MutableRefObject<ClothMotionState>
}) {
  const { scene } = useGLTF('/models/tee-caimento.glb')
  const clothMeshes = useRef<ClothMeshData[]>([])
  const dynamics = useRef({
    x: 0,
    vx: 0,
    z: 0,
    vz: 0,
    folds: 0.002,
    foldsVelocity: 0,
  })

  const model = useMemo(() => {
    const clone = scene.clone(true)

    clone.updateMatrixWorld(true)

    const bounds = new THREE.Box3().setFromObject(clone)
    const dimensions = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())

    const scale = targetHeight / Math.max(dimensions.y, 0.001)
    const lengthScale = 1.2
    const verticalScale = scale * lengthScale
    const depthRatio = 0.52

    clone.scale.set(scale, verticalScale, scale * depthRatio)
    clone.position.set(
      -center.x * scale,
      centerY + (targetHeight - dimensions.y * verticalScale) / 2 -
        center.y * verticalScale,
      -center.z * scale * depthRatio,
    )

    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return

      if (simulateCloth) {
        object.geometry = object.geometry.clone()
      }

      object.castShadow = true
      object.receiveShadow = true

      const prepareMaterial = (source: THREE.Material) => {
        const material = source.clone() as THREE.Material & {
          color?: THREE.Color
          roughness?: number
          metalness?: number
          sheen?: number
          sheenRoughness?: number
          sheenColor?: THREE.Color
        }

        if (material.color instanceof THREE.Color) {
          material.color.set(color)
        }

        if (typeof material.roughness === 'number') {
          material.roughness = Math.max(
            0.72,
            Math.min(material.roughness, 0.9),
          )
        }

        if (typeof material.metalness === 'number') {
          material.metalness = 0
        }

        if (
          material instanceof THREE.MeshStandardMaterial ||
          material instanceof THREE.MeshPhysicalMaterial
        ) {
          material.map = null
          material.normalMap = null
          material.bumpMap = null
          material.displacementMap = null
        }

        if (material instanceof THREE.MeshPhysicalMaterial) {
          material.sheen = 0.05
          material.sheenRoughness = 0.96
          material.sheenColor.set('#ffffff')
        }

        return material
      }

      object.material = Array.isArray(object.material)
        ? object.material.map(prepareMaterial)
        : prepareMaterial(object.material)
    })

    return clone
  }, [scene, color, targetHeight, centerY, simulateCloth])

  useEffect(() => {
    clothMeshes.current = []
    dynamics.current.x = 0
    dynamics.current.vx = 0
    dynamics.current.z = 0
    dynamics.current.vz = 0
    dynamics.current.folds = 0.002
    dynamics.current.foldsVelocity = 0

    if (!simulateCloth) {
      return () => {
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material]
          materials.forEach((material) => material.dispose())
        })
      }
    }

    const meshes: ClothMeshData[] = []

    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return

      const geometry = object.geometry as THREE.BufferGeometry
      const position = geometry.getAttribute('position') as
        | THREE.BufferAttribute
        | undefined

      if (!position || !(position.array instanceof Float32Array)) return

      const base = new Float32Array(position.array)
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity

      for (let i = 0; i < base.length; i += 3) {
        const x = base[i]
        const y = base[i + 1]

        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }

      position.setUsage(THREE.DynamicDrawUsage)

      meshes.push({
        geometry,
        position,
        base,
        minX,
        maxX,
        minY,
        maxY,
      })
    })

    clothMeshes.current = meshes

    return () => {
      clothMeshes.current = []
      meshes.forEach((entry) => entry.geometry.dispose())

      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material]

        materials.forEach((material) => material.dispose())
      })
    }
  }, [model, simulateCloth])

  useFrame((state, delta) => {
    if (
      !simulateCloth ||
      !clothMotion ||
      clothMeshes.current.length === 0
    ) {
      return
    }

    const dt = Math.min(delta, 1 / 30)
    const motion = clothMotion.current
    const speedX = THREE.MathUtils.clamp(
      motion.linearVelocityX,
      -5,
      5,
    )
    const speedZ = THREE.MathUtils.clamp(
      motion.linearVelocityZ,
      -5,
      5,
    )
    const angularSpeed = THREE.MathUtils.clamp(
      motion.angularVelocity,
      -10,
      10,
    )

    const targetX = THREE.MathUtils.clamp(
      -angularSpeed * 0.012 - speedX * 0.025,
      -0.06,
      0.06,
    )

    const targetZ = THREE.MathUtils.clamp(
      angularSpeed * 0.006 - speedZ * 0.02,
      -0.032,
      0.032,
    )

    const targetFolds = THREE.MathUtils.clamp(
      0.002 +
        Math.abs(angularSpeed) * 0.002 +
        Math.abs(speedX) * 0.004,
      0.002,
      0.018,
    )

    const stateNow = dynamics.current

    stateNow.vx +=
      ((targetX - stateNow.x) * 44 - stateNow.vx * 9.5) * dt
    stateNow.x += stateNow.vx * dt

    stateNow.vz +=
      ((targetZ - stateNow.z) * 38 - stateNow.vz * 8.5) * dt
    stateNow.z += stateNow.vz * dt

    stateNow.foldsVelocity +=
      ((targetFolds - stateNow.folds) * 32 -
        stateNow.foldsVelocity * 8) *
      dt
    stateNow.folds += stateNow.foldsVelocity * dt

    const phase = state.clock.elapsedTime

    for (const entry of clothMeshes.current) {
      const {
        position,
        base,
        minX,
        maxX,
        minY,
        maxY,
        geometry,
      } = entry

      const values = position.array as Float32Array
      const height = Math.max(maxY - minY, 0.0001)
      const halfWidth = Math.max((maxX - minX) * 0.5, 0.0001)
      const centerX = (minX + maxX) * 0.5

      for (let i = 0; i < base.length; i += 3) {
        const baseX = base[i]
        const baseY = base[i + 1]
        const baseZ = base[i + 2]

        const ny = THREE.MathUtils.clamp(
          (baseY - minY) / height,
          0,
          1,
        )

        const nx = THREE.MathUtils.clamp(
          (baseX - centerX) / halfWidth,
          -1.5,
          1.5,
        )

        // A parte superior fica progressivamente mais estável.
        const pinned = THREE.MathUtils.smoothstep(ny, 0.76, 0.95)
        const free = 1 - pinned
        const weight = free * free

        // Ondas sobrepostas criam dobras visuais em movimento.
        const waveA = Math.sin(
          ny * 12.5 + nx * 4.2 + phase * 2.25,
        )
        const waveB = Math.sin(
          nx * 18 - ny * 6.2 + phase * 1.7,
        )
        const waveC = Math.sin(
          ny * 25 + nx * 9.5 - phase * 1.15,
        )

        const amplitude =
          stateNow.folds *
          weight *
          (0.5 + Math.min(Math.abs(nx), 1) * 0.55)

        const wrinkle =
          (waveA * 0.52 + waveB * 0.31 + waveC * 0.17) *
          amplitude

        values[i] =
          baseX + stateNow.x * weight + waveB * amplitude * 0.16

        values[i + 1] =
          baseY -
          Math.abs(nx) * amplitude * 0.1 +
          waveA * amplitude * 0.035

        values[i + 2] =
          baseZ + stateNow.z * weight + wrinkle
      }

      position.needsUpdate = true
      geometry.computeVertexNormals()
    }
  })

  return <primitive object={model} dispose={null} />
}

/* ======================================================
   CABIDE
   ====================================================== */

function Hanger() {
  return (
    <group>
      <Line
        points={[
          [-0.31, 0.60, -0.07],
          [0, 0.82, -0.07],
          [0.31, 0.60, -0.07],
        ]}
        color="#9b9385"
        lineWidth={1.5}
      />

      <Line
        points={[
          [0, 0.82, -0.07],
          [0, 0.88, -0.07],
          [0.055, 0.94, -0.07],
          [0.075, 1.00, -0.07],
          [0.045, 1.055, -0.07],
          [0, 1.075, -0.07],
          [-0.035, 1.05, -0.07],
          [-0.03, 1.02, -0.07],
        ]}
        color="#9b9385"
        lineWidth={1.5}
      />
    </group>
  )
}

/* ======================================================
   AMBIENTE DO CLOSET
   ====================================================== */

function ClosetEnvironment({ width }: { width: number }) {
  return (
    <>
      <mesh
        position={[0, 1.085, -0.075]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.023, 0.023, 5.1, 16]} />
        <meshStandardMaterial
          color="#0d0d0c"
          metalness={0.9}
          roughness={0.34}
        />
      </mesh>

      <mesh
        position={[0, -0.1, -0.85]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry args={[width * 1.8, 4.2]} />
        <shadowMaterial transparent opacity={0.34} />
      </mesh>

      <ambientLight intensity={0.55} />

      <hemisphereLight args={['#e4e0d8', '#121110', 0.7]} />

      <spotLight
        position={[1.1, 2.6, 2.7]}
        angle={0.62}
        penumbra={1}
        intensity={16}
        distance={9}
        color="#f4e8d6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />

      <pointLight
        position={[0, 1.3, 0.85]}
        intensity={3.2}
        distance={5}
        color="#efe2cd"
      />

      <pointLight
        position={[-width * 0.28, 0.45, 0.2]}
        intensity={1.6}
        distance={4}
        color="#d8d1c5"
      />

      <pointLight
        position={[width * 0.28, 0.45, 0.2]}
        intensity={1.6}
        distance={4}
        color="#d8d1c5"
      />
    </>
  )
}

/* ======================================================
   CAMISETA PENDURADA
   ====================================================== */

type HangingPieceProps = {
  piece: WardrobePiece
  index: number
  targetX: number
  active: boolean
  compact: boolean
  onSelect: (index: number) => void
  beginDrag: (x: number) => void
  moveDrag: (x: number) => void
  endDrag: () => void
  wasDragged: () => boolean
}

function HangingPiece({
  piece,
  index,
  targetX,
  active,
  compact,
  onSelect,
  beginDrag,
  moveDrag,
  endDrag,
  wasDragged,
}: HangingPieceProps) {
  const group = useRef<THREE.Group>(null)
  const rotationGroup = useRef<THREE.Group>(null)
  const pieceScaleGroup = useRef<THREE.Group>(null)

  const manualRotation = useRef(0)

  const clothMotion = useRef<ClothMotionState>({
    angularVelocity: 0,
    linearVelocityX: 0,
    linearVelocityZ: 0,
  })

  const motionHistory = useRef({
    initialized: false,
    rotationY: 0,
    positionX: 0,
    positionZ: 0,
  })

  const rotationStart = useRef<{
    x: number
    rotation: number
  } | null>(null)

  const [hovered, setHovered] = useState(false)

  const sideRotation = active
    ? 0
    : targetX < 0
      ? 1.16
      : -1.16

  useEffect(() => {
    manualRotation.current = 0
  }, [targetX])

  useFrame((state, delta) => {
    const object = group.current

    const desiredScale = active
      ? compact
        ? 1.02
        : 1.06
      : compact
        ? 0.84
        : 0.87

    const hookAlignmentY = 1.085 - 1.075 * desiredScale

    if (object) {
      object.position.x = THREE.MathUtils.damp(
        object.position.x,
        targetX,
        3.8,
        delta,
      )

      object.position.z = THREE.MathUtils.damp(
        object.position.z,
        active ? 0.9 : -0.025,
        3.2,
        delta,
      )

      const floating =
        Math.sin(state.clock.elapsedTime * 0.7 + index) *
        (active ? 0.003 : 0.002)

      object.position.y = THREE.MathUtils.damp(
        object.position.y,
        active
          ? hookAlignmentY - 0.22
          : hookAlignmentY + floating,
        4,
        delta,
      )
    }

    if (pieceScaleGroup.current) {
      const nextScale = THREE.MathUtils.damp(
        pieceScaleGroup.current.scale.x,
        desiredScale * (active && hovered ? 1.015 : 1),
        5,
        delta,
      )

      pieceScaleGroup.current.scale.setScalar(nextScale)
    }

    if (rotationGroup.current) {
      rotationGroup.current.rotation.y = THREE.MathUtils.damp(
        rotationGroup.current.rotation.y,
        sideRotation + manualRotation.current,
        4,
        delta,
      )
    }

    // Mede a velocidade da peça para reagir com atraso no tecido.
    if (object && rotationGroup.current && delta > 0) {
      const history = motionHistory.current
      const rotationY = rotationGroup.current.rotation.y

      if (history.initialized) {
        clothMotion.current.angularVelocity =
          THREE.MathUtils.clamp(
            (rotationY - history.rotationY) / delta,
            -10,
            10,
          )

        clothMotion.current.linearVelocityX =
          THREE.MathUtils.clamp(
            (object.position.x - history.positionX) / delta,
            -5,
            5,
          )

        clothMotion.current.linearVelocityZ =
          THREE.MathUtils.clamp(
            (object.position.z - history.positionZ) / delta,
            -5,
            5,
          )
      } else {
        history.initialized = true
      }

      history.rotationY = rotationY
      history.positionX = object.position.x
      history.positionZ = object.position.z
    }
  })

  return (
    <group
      ref={group}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (active) setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onPointerDown={(event) => {
        event.stopPropagation()
        beginDrag(event.clientX)
        capturePointer(event)

        if (!active) return

        rotationStart.current = {
          x: event.clientX,
          rotation: manualRotation.current,
        }
      }}
      onPointerMove={(event) => {
        if (event.buttons === 0) return

        event.stopPropagation()
        moveDrag(event.clientX)

        if (!active) return

        const start = rotationStart.current
        if (!start) return

        const distance = event.clientX - start.x

        if (Math.abs(distance) > 5) {
          manualRotation.current =
            start.rotation + distance * 0.012
        }
      }}
      onPointerUp={(event) => {
        endDrag()
        rotationStart.current = null
        releaseCapturedPointer(event)
      }}
      onPointerCancel={(event) => {
        endDrag()
        rotationStart.current = null
        releaseCapturedPointer(event)
      }}
      onClick={(event) => {
        event.stopPropagation()

        if (!wasDragged()) {
          onSelect(index)
        }
      }}
    >
      <group ref={rotationGroup}>
        <group ref={pieceScaleGroup}>
          <Hanger />

          <ShirtModel
            color={piece.color}
            targetHeight={1.65}
            centerY={0.22}
            simulateCloth={active}
            clothMotion={clothMotion}
          />
        </group>
      </group>
    </group>
  )
}

/* ======================================================
   CENA PRINCIPAL DO CLOSET
   ====================================================== */

function WardrobeScene({
  pieces,
  activeIndex,
  onSelect,
}: {
  pieces: WardrobePiece[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  const { size, camera } = useThree()
  const referenceHeight = useRef(size.height)

  const compact =
    size.width / Math.max(size.height, 1) < 1.15

  const active =
    pieces.length > 0
      ? Math.max(0, Math.min(activeIndex, pieces.length - 1))
      : 0

  const sideGap = compact ? 0.68 : 0.92
  const sideSpacing = compact ? 0.14 : 0.19

  const layout = useMemo(() => {
    const positions = new Array<number>(pieces.length).fill(0)

    if (pieces.length === 0) return positions

    const left: number[] = []
    const right: number[] = []

    pieces.forEach((_, index) => {
      if (index === active) return

      if (index < active) {
        left.push(index)
      } else {
        right.push(index)
      }
    })

    left.forEach((index, rank) => {
      positions[index] =
        -(sideGap + (left.length - 1 - rank) * sideSpacing)
    })

    right.forEach((index, rank) => {
      positions[index] = sideGap + rank * sideSpacing
    })

    positions[active] = 0

    return positions
  }, [pieces, active, sideGap, sideSpacing])

  const farthest = Math.max(
    0,
    ...layout.map((position) => Math.abs(position)),
  )

  const closetWidth = Math.max(
    compact ? 3.8 : 4.8,
    2 * (farthest + 0.48),
  )

  const drag = useRef<{
    startX: number
    moved: boolean
  } | null>(null)

  const dragged = useRef(false)

  function beginDrag(clientX: number) {
    dragged.current = false

    drag.current = {
      startX: clientX,
      moved: false,
    }
  }

  function moveDrag(clientX: number) {
    const current = drag.current
    if (!current) return

    if (Math.abs(clientX - current.startX) > 6) {
      current.moved = true
      dragged.current = true
    }
  }

  function endDrag() {
    drag.current = null
  }

  useFrame((_, delta) => {
    const targetZ =
      referenceHeight.current > 0
        ? 6.2 * (size.height / referenceHeight.current)
        : 6.2

    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      targetZ,
      3,
      delta,
    )

    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      0.02,
      3,
      delta,
    )

    camera.lookAt(0, 0, 0)
  })

  return (
    <>
      <ClosetEnvironment width={closetWidth} />

      {pieces.map((piece, index) => (
        <HangingPiece
          key={piece.id}
          piece={piece}
          index={index}
          targetX={layout[index]}
          active={index === active}
          compact={compact}
          onSelect={onSelect}
          beginDrag={beginDrag}
          moveDrag={moveDrag}
          endDrag={endDrag}
          wasDragged={() => dragged.current}
        />
      ))}
    </>
  )
}

/* ======================================================
   DETALHE 3D DO PRODUTO
   ====================================================== */

function DetailScene({ color }: { color: string }) {
  const { size } = useThree()
  const compact = size.width / Math.max(size.height, 1) > 1.3

  return (
    <>
      <color attach="background" args={['#171815']} />

      <ambientLight intensity={0.9} />

      <hemisphereLight args={['#eee5d5', '#20211c', 0.8]} />

      <directionalLight
        position={[-3, 4, 4]}
        intensity={2.4}
      />

      <spotLight
        position={[1, 3, 3]}
        angle={0.55}
        penumbra={0.9}
        intensity={15}
        distance={9}
        color="#f2e8d2"
      />

      <pointLight
        position={[-2, 0, 2]}
        intensity={4}
        color="#b4b79e"
      />

      <ShirtModel
        color={color}
        targetHeight={compact ? 2.2 : 2.7}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.8}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={(Math.PI * 2) / 3}
      />
    </>
  )
}

/* ======================================================
   COMPONENTE EXPORTADO
   ====================================================== */

export default function Wardrobe3D({
  pieces,
  activeIndex,
  onSelect,
  mode = 'wardrobe',
}: Wardrobe3DProps) {
  const detail = mode === 'detail'

  const selectedColor =
    pieces[activeIndex]?.color ?? '#d2cdc3'

  return (
    <div
      className={
        detail
          ? 'wardrobe-3d detail-canvas'
          : 'wardrobe-3d'
      }
      style={{
        width: '100%',
        height: '100%',
        minHeight: detail ? 0 : 400,
        position: 'relative',
        touchAction: detail ? 'none' : 'pan-y',
      }}
    >
      <Canvas
        shadows={!detail}
        dpr={[1, 1.5]}
        camera={
          detail
            ? {
                position: [0, 0, 5],
                fov: 34,
              }
            : {
                position: [0, 0.02, 6.2],
                fov: 38,
              }
        }
        gl={{
          antialias: true,
          alpha: !detail,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(
            '#171815',
            detail ? 1 : 0,
          )
        }}
      >
        <Suspense
          fallback={
            <Html center>
              <div className="three-loading">
                CARREGANDO MODELO 3D...
              </div>
            </Html>
          }
        >
          {detail ? (
            <DetailScene color={selectedColor} />
          ) : (
            <WardrobeScene
              pieces={pieces}
              activeIndex={activeIndex}
              onSelect={onSelect}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload('/models/tee-caimento.glb')
