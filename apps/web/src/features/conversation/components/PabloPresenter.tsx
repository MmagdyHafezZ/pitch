'use client'

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Center, Html, useAnimations, useGLTF } from '@react-three/drei'
import type { AnimationAction, AnimationClip, Group as ThreeGroup, Object3D } from 'three'
import type { CharacterAlignmentPayload } from '../types/conversation.types'

type PlaybackMode = 'idle' | 'speaking' | 'listening'
type RequiredTargetName = 'mad' | 'open_mouth' | 'open' | 'open_mad'
type ControlledFeatureName = 'body' | 'Mouth'

interface WordTiming {
  text: string
  start: number
  end: number
}

interface MorphBinding {
  influences: number[]
  index: number
}

interface MorphDictionaryHost {
  name?: string
  parent?: Object3D | null
  traverse?: (callback: (object: MorphDictionaryHost) => void) => void
  geometry?: {
    userData?: {
      targetNames?: string[]
    }
  }
  morphTargetDictionary?: Record<string, number>
  morphTargetInfluences?: number[] | null
}

interface GltfMeshDefinition {
  extras?: {
    targetNames?: string[]
  }
}

interface GltfNodeDefinition {
  name?: string
  mesh?: number
}

interface GltfJsonDefinition {
  meshes?: GltfMeshDefinition[]
  nodes?: GltfNodeDefinition[]
}

interface GltfAsset {
  scene: ThreeGroup
  animations: AnimationClip[]
  parser?: {
    json?: GltfJsonDefinition
  }
}

interface PabloModelProps {
  modelPath: string
  mouthOpen: boolean
  playbackMode: PlaybackMode
}

export interface PabloPresenterProps {
  playbackMode: PlaybackMode
  audioElementRef: RefObject<HTMLAudioElement | null>
  alignment?: CharacterAlignmentPayload | null
  normalizedAlignment?: CharacterAlignmentPayload | null
  modelPath?: string
  backgroundImage?: string
  minHeight?: string
}

const REQUIRED_TARGETS = ['mad', 'open_mouth', 'open', 'open_mad'] as const
const CONTROLLED_FEATURE_NAMES = ['body', 'Mouth'] as const
const LISTEN_ANIMATION_NAME = 'Action'
const IDLE_ANIMATION_NAME = 'idle'
const LISTEN_FPS = 24
const LISTEN_LOOP_START_FRAME = 2
const LISTEN_FRAME_DURATION = 1 / LISTEN_FPS
const DEFAULT_MODEL_PATH = '/models/Pablo.glb'
const DEFAULT_BACKGROUND_IMAGE = '/pablo_session_background.png'
const PABLO_VIEW_SCALE = 1.56
const PABLO_VIEW_OFFSET_X = 0
const PABLO_VIEW_OFFSET_Y = -0.74
const PABLO_VIEW_ROTATION_X = 0
const PABLO_VIEW_ROTATION_Y = 0
const PABLO_CAMERA_FOV = 24
const PABLO_CAMERA_POSITION = [0, 1.48, 4.18] as const
const PABLO_CAMERA_TARGET = [0, 0.36, 0] as const

const CONTROLLED_FEATURE_TARGETS: Record<ControlledFeatureName, readonly RequiredTargetName[]> = {
  body: ['mad', 'open_mouth'],
  Mouth: ['open', 'open_mad'],
}

function getPreferredAlignment({
  alignment,
  normalizedAlignment,
}: {
  alignment?: CharacterAlignmentPayload | null
  normalizedAlignment?: CharacterAlignmentPayload | null
}): CharacterAlignmentPayload | null {
  if (normalizedAlignment) {
    return normalizedAlignment
  }

  return alignment ?? null
}

function isWordCharacter(character: string): boolean {
  return /[\p{L}\p{N}'’_-]/u.test(character)
}

function deriveWordTimings(alignment: CharacterAlignmentPayload | null): WordTiming[] {
  if (!alignment?.characters?.length) return []

  const characters = alignment.characters
  const starts =
    alignment.characterStartTimesSeconds ?? alignment.character_start_times_seconds ?? []
  const ends = alignment.characterEndTimesSeconds ?? alignment.character_end_times_seconds ?? []
  const total = Math.min(characters.length, starts.length, ends.length)
  const words: WordTiming[] = []

  let currentText = ''
  let currentStart = 0
  let currentEnd = 0
  let isBuildingWord = false

  for (let index = 0; index < total; index += 1) {
    const character = characters[index] ?? ''
    const isWordPart = isWordCharacter(character)

    if (isWordPart) {
      if (!isBuildingWord) {
        currentText = character
        currentStart = starts[index] ?? 0
        currentEnd = ends[index] ?? currentStart
        isBuildingWord = true
      } else {
        currentText += character
        currentEnd = ends[index] ?? currentEnd
      }
      continue
    }

    if (isBuildingWord) {
      words.push({
        text: currentText,
        start: currentStart,
        end: currentEnd,
      })
      currentText = ''
      currentStart = 0
      currentEnd = 0
      isBuildingWord = false
    }
  }

  if (isBuildingWord) {
    words.push({
      text: currentText,
      start: currentStart,
      end: currentEnd,
    })
  }

  return words.filter((word) => word.text.trim().length > 0 && word.end >= word.start)
}

function findActiveWordIndex(words: WordTiming[], currentTime: number): number {
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    if (currentTime >= word.start && currentTime < word.end) {
      return index
    }
  }

  return -1
}

function applyMorphBindings(bindings: MorphBinding[], value: number) {
  for (const binding of bindings) {
    binding.influences[binding.index] = value
  }
}

function buildMorphTargetDictionary(targetNames: string[]): Record<string, number> {
  return Object.fromEntries(targetNames.map((targetName, index) => [targetName, index]))
}

function getMorphTargetDictionary(
  object: MorphDictionaryHost,
  fallbackTargetNames: string[] = []
): Record<string, number> | null {
  if (object.morphTargetDictionary && Object.keys(object.morphTargetDictionary).length > 0) {
    return object.morphTargetDictionary
  }

  if (
    fallbackTargetNames.length > 0 &&
    Array.isArray(object.morphTargetInfluences) &&
    object.morphTargetInfluences.length === fallbackTargetNames.length
  ) {
    return buildMorphTargetDictionary(fallbackTargetNames)
  }

  return null
}

function hasMorphInfluences(object: MorphDictionaryHost): object is MorphDictionaryHost & {
  morphTargetInfluences: number[]
} {
  return Array.isArray(object.morphTargetInfluences)
}

function isControlledFeatureName(value: string | undefined): value is ControlledFeatureName {
  return CONTROLLED_FEATURE_NAMES.includes(value as ControlledFeatureName)
}

function getControlledFeatureName(object: Object3D): ControlledFeatureName | null {
  let current: Object3D | null = object

  while (current) {
    if (isControlledFeatureName(current.name)) {
      return current.name
    }

    current = current.parent
  }

  return null
}

function featureAcceptsTarget(featureName: ControlledFeatureName, targetName: RequiredTargetName) {
  return CONTROLLED_FEATURE_TARGETS[featureName].includes(targetName)
}

function syncMorphState(bindings: Record<RequiredTargetName, MorphBinding[]>, mouthOpen: boolean) {
  applyMorphBindings(bindings.mad, 0)
  applyMorphBindings(bindings.open_mouth, mouthOpen ? 1 : 0)
  applyMorphBindings(bindings.open, mouthOpen ? 1 : 0)
  applyMorphBindings(bindings.open_mad, 0)
}

function applyAnimationTime(
  action: AnimationAction,
  mixer: { update: (deltaTime: number) => void },
  time: number
) {
  action.time = time
  mixer.update(0)
}

function getListenLoopStartFrame(totalFrames: number) {
  return Math.min(Math.max(LISTEN_LOOP_START_FRAME, 1), totalFrames)
}

function PabloModel({ modelPath, mouthOpen, playbackMode }: PabloModelProps) {
  const gltf = useGLTF(modelPath) as GltfAsset
  const model = useMemo(() => gltf.scene as ThreeGroup & MorphDictionaryHost, [gltf.scene])
  const exportedTargetNamesByNodeName = useMemo(() => {
    const nodes = gltf.parser?.json?.nodes ?? []
    const meshes = gltf.parser?.json?.meshes ?? []

    return new Map(
      nodes
        .filter((node) => isControlledFeatureName(node.name))
        .map((node) => {
          const mesh = typeof node.mesh === 'number' ? meshes[node.mesh] : null
          return [node.name as ControlledFeatureName, mesh?.extras?.targetNames ?? []] as const
        })
    )
  }, [gltf.parser?.json?.meshes, gltf.parser?.json?.nodes])
  const animationClips = useMemo(
    () =>
      gltf.animations.map((clip) => {
        const nextClip = clip.clone()
        nextClip.tracks = nextClip.tracks.filter(
          (track) => !track.name.includes('.morphTargetInfluences')
        )
        return nextClip
      }),
    [gltf.animations]
  )
  const { actions, mixer } = useAnimations(animationClips, model)
  const bindingsRef = useRef<Record<RequiredTargetName, MorphBinding[]>>({
    mad: [],
    open_mouth: [],
    open: [],
    open_mad: [],
  })
  const listenAccumulatorRef = useRef(0)
  const listenFrameRef = useRef(0)
  const appliedAnimationTimeRef = useRef<number | null>(null)

  const idleAction = actions[IDLE_ANIMATION_NAME] ?? null
  const listenAction = actions[LISTEN_ANIMATION_NAME] ?? null
  const listenAnimationFrames = listenAction
    ? Math.max(1, Math.round(listenAction.getClip().duration * LISTEN_FPS))
    : 0

  useLayoutEffect(() => {
    const nextBindings: Record<RequiredTargetName, MorphBinding[]> = {
      mad: [],
      open_mouth: [],
      open: [],
      open_mad: [],
    }

    model.traverse?.((object) => {
      const nextObject = object as Object3D & MorphDictionaryHost
      if (!hasMorphInfluences(nextObject)) return

      const featureName = getControlledFeatureName(nextObject)
      if (!featureName) return

      const exportedTargetNames =
        nextObject.name && isControlledFeatureName(nextObject.name)
          ? (exportedTargetNamesByNodeName.get(nextObject.name) ?? [])
          : nextObject.parent?.name && isControlledFeatureName(nextObject.parent.name)
            ? (exportedTargetNamesByNodeName.get(nextObject.parent.name) ?? [])
            : (nextObject.geometry?.userData?.targetNames ?? [])
      const dictionary = getMorphTargetDictionary(nextObject, exportedTargetNames)
      if (!dictionary) return

      for (const [targetName, targetIndex] of Object.entries(dictionary)) {
        if (
          !REQUIRED_TARGETS.includes(targetName as RequiredTargetName) ||
          !featureAcceptsTarget(featureName, targetName as RequiredTargetName)
        ) {
          continue
        }

        nextBindings[targetName as RequiredTargetName].push({
          influences: nextObject.morphTargetInfluences,
          index: targetIndex,
        })
      }
    })

    bindingsRef.current = nextBindings
    syncMorphState(nextBindings, mouthOpen)
  }, [exportedTargetNamesByNodeName, model, mouthOpen])

  useLayoutEffect(() => {
    syncMorphState(bindingsRef.current, mouthOpen)
  }, [mouthOpen])

  useEffect(() => {
    for (const action of Object.values(actions) as AnimationAction[]) {
      action?.stop()
    }

    const defaultAction = idleAction ?? listenAction
    if (!defaultAction) {
      appliedAnimationTimeRef.current = null
      return undefined
    }

    defaultAction.reset()
    defaultAction.enabled = true
    defaultAction.clampWhenFinished = true
    defaultAction.play()
    defaultAction.paused = true
    applyAnimationTime(defaultAction, mixer, 0)
    appliedAnimationTimeRef.current = 0

    return () => {
      idleAction?.stop()
      listenAction?.stop()
    }
  }, [actions, idleAction, listenAction, mixer])

  useEffect(() => {
    listenAccumulatorRef.current = 0

    if (playbackMode !== 'listening') {
      listenFrameRef.current = 0
      const defaultAction = idleAction ?? listenAction
      if (!defaultAction) {
        appliedAnimationTimeRef.current = null
        return
      }

      listenAction?.stop()
      defaultAction.reset()
      defaultAction.enabled = true
      defaultAction.clampWhenFinished = true
      defaultAction.play()
      defaultAction.paused = true
      applyAnimationTime(defaultAction, mixer, 0)
      appliedAnimationTimeRef.current = 0
      return
    }

    if (!listenAction) {
      listenFrameRef.current = 0
      appliedAnimationTimeRef.current = null
      return
    }

    if (listenAnimationFrames > 0) {
      idleAction?.stop()
      listenFrameRef.current = getListenLoopStartFrame(listenAnimationFrames)
      const listenStartTime = Math.min(
        listenFrameRef.current / LISTEN_FPS,
        listenAction.getClip().duration
      )
      listenAction.reset()
      listenAction.enabled = true
      listenAction.clampWhenFinished = true
      listenAction.play()
      listenAction.paused = true
      applyAnimationTime(listenAction, mixer, listenStartTime)
      appliedAnimationTimeRef.current = listenStartTime
      return
    }

    listenFrameRef.current = 0
    applyAnimationTime(listenAction, mixer, 0)
    appliedAnimationTimeRef.current = 0
  }, [idleAction, listenAction, listenAnimationFrames, mixer, playbackMode])

  useFrame((_, delta) => {
    syncMorphState(bindingsRef.current, mouthOpen)

    if (!listenAction) {
      return
    }

    if (playbackMode !== 'listening' || listenAnimationFrames <= 0) {
      if (appliedAnimationTimeRef.current !== 0) {
        applyAnimationTime(listenAction, mixer, 0)
        appliedAnimationTimeRef.current = 0
      }
      listenAccumulatorRef.current = 0
      listenFrameRef.current = 0
      return
    }

    listenAccumulatorRef.current += delta
    const listenLoopStartFrame = getListenLoopStartFrame(listenAnimationFrames)
    let nextFrame = listenFrameRef.current || listenLoopStartFrame

    while (listenAccumulatorRef.current >= LISTEN_FRAME_DURATION) {
      listenAccumulatorRef.current -= LISTEN_FRAME_DURATION
      nextFrame = nextFrame >= listenAnimationFrames ? listenLoopStartFrame : nextFrame + 1
    }

    const nextTime = Math.min(nextFrame / LISTEN_FPS, listenAction.getClip().duration)
    if (
      nextFrame !== listenFrameRef.current ||
      appliedAnimationTimeRef.current == null ||
      Math.abs(appliedAnimationTimeRef.current - nextTime) > 0.0001
    ) {
      listenFrameRef.current = nextFrame
      applyAnimationTime(listenAction, mixer, nextTime)
      appliedAnimationTimeRef.current = nextTime
    }
  })

  return (
    <Center>
      <primitive
        object={model}
        position={[PABLO_VIEW_OFFSET_X, PABLO_VIEW_OFFSET_Y, 0]}
        rotation={[PABLO_VIEW_ROTATION_X, PABLO_VIEW_ROTATION_Y, 0]}
        scale={PABLO_VIEW_SCALE}
      />
    </Center>
  )
}

function PabloCameraRig() {
  const { camera } = useThree()

  useLayoutEffect(() => {
    camera.position.set(...PABLO_CAMERA_POSITION)
    camera.lookAt(...PABLO_CAMERA_TARGET)
    camera.updateProjectionMatrix()
  }, [camera])

  return null
}

function LoadingModelFallback() {
  return (
    <Html center>
      <div
        style={{
          borderRadius: 14,
          padding: '0.65rem 0.9rem',
          background: 'rgba(15, 23, 42, 0.84)',
          color: 'white',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.01em',
        }}
      >
        Loading Pablo...
      </div>
    </Html>
  )
}

export function PabloPresenter({
  playbackMode,
  audioElementRef,
  alignment,
  normalizedAlignment,
  modelPath = DEFAULT_MODEL_PATH,
  backgroundImage = DEFAULT_BACKGROUND_IMAGE,
  minHeight = '100%',
}: PabloPresenterProps) {
  const preferredAlignment = useMemo(
    () => getPreferredAlignment({ alignment, normalizedAlignment }),
    [alignment, normalizedAlignment]
  )
  const words = useMemo(() => deriveWordTimings(preferredAlignment), [preferredAlignment])
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    if (playbackMode !== 'speaking') {
      setCurrentTime(0)
      return undefined
    }

    let frameId: number | null = null

    const update = () => {
      const audio = audioElementRef.current
      if (!audio) {
        frameId = window.requestAnimationFrame(update)
        return
      }

      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0)

      if (!audio.paused && !audio.ended) {
        frameId = window.requestAnimationFrame(update)
      }
    }

    frameId = window.requestAnimationFrame(update)

    return () => {
      if (frameId != null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [audioElementRef, playbackMode])

  const activeWordIndex = useMemo(
    () => findActiveWordIndex(words, currentTime),
    [words, currentTime]
  )
  const mouthOpen =
    playbackMode === 'speaking' &&
    (words.length > 0 ? activeWordIndex >= 0 : Math.floor(currentTime / 0.12) % 2 === 0)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight,
        borderRadius: 32,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.14), rgba(15, 23, 42, 0.3)), url("${backgroundImage}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at center, rgba(255, 255, 255, 0.08), transparent 46%), linear-gradient(180deg, rgba(8, 15, 32, 0.04), rgba(8, 15, 32, 0.42))',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ pointerEvents: 'none', position: 'relative', zIndex: 1 }}
        camera={{ position: [...PABLO_CAMERA_POSITION], fov: PABLO_CAMERA_FOV }}
      >
        <PabloCameraRig />
        <ambientLight intensity={0.72} />
        <hemisphereLight args={['#edf7ff', '#0f172a', 1.2]} />
        <directionalLight position={[4.8, 5.4, 5.8]} intensity={2.1} color="#fff2d9" />
        <directionalLight position={[-4.2, 2.6, 2.1]} intensity={1.12} color="#8bd5ff" />
        <spotLight
          position={[0.6, 6.4, 4.5]}
          angle={0.62}
          penumbra={1}
          intensity={1.2}
          color="#ffffff"
        />
        <pointLight position={[0.3, 1.8, 2.8]} intensity={0.55} color="#ffffff" />
        <Suspense fallback={<LoadingModelFallback />}>
          <PabloModel modelPath={modelPath} mouthOpen={mouthOpen} playbackMode={playbackMode} />
        </Suspense>
      </Canvas>
      <div
        style={{
          position: 'absolute',
          inset: 'auto 0 0 0',
          height: '28%',
          background:
            'linear-gradient(180deg, rgba(8, 15, 32, 0), rgba(8, 15, 32, 0.48) 70%, rgba(8, 15, 32, 0.68))',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
    </div>
  )
}

useGLTF.preload(DEFAULT_MODEL_PATH)
