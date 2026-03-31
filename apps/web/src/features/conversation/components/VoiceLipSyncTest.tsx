'use client'

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Container,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconRotateClockwise,
} from '@tabler/icons-react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, useAnimations, useGLTF } from '@react-three/drei'
import { Quaternion } from 'three'
import type { AnimationAction, AnimationClip, Group as ThreeGroup, Object3D } from 'three'

type MoodState = 'normal' | 'mad'
type PlaybackMode = 'idle' | 'speaking' | 'listening'
type RequiredTargetName = 'mad' | 'open_mouth' | 'open' | 'open_mad'
type ControlledFeatureName = 'body' | 'Mouth'
type InspectedNodeName = ControlledFeatureName | 'eyeL' | 'eyeR' | 'browL' | 'browR'
type Vector3Tuple = [number, number, number]

interface CharacterAlignmentPayload {
  characters?: string[]
  character_start_times_seconds?: number[]
  character_end_times_seconds?: number[]
}

export interface VoiceLipSyncFixture {
  audio_base64?: string
  alignment?: CharacterAlignmentPayload | null
  normalized_alignment?: CharacterAlignmentPayload | null
}

interface WordTiming {
  text: string
  start: number
  end: number
}

interface MorphBinding {
  influences: number[]
  index: number
  meshName: string
  objectName: string
}

interface BindingDetail {
  featureName: ControlledFeatureName
  objectName: string
  meshName: string
  index: number
}

interface RuntimeNodeSummary {
  objectName: string
  objectType: string
  parentName: string | null
  childNames: string[]
  morphTargetNames: string[]
  morphTargetInfluenceCount: number
}

interface ExportedNodeSummary {
  nodeName: string
  meshName: string | null
  targetNames: string[]
}

interface AnimationMorphTrackSummary {
  clipName: string
  targetNodeNames: string[]
}

interface MorphDiagnostics {
  warnings: string[]
  bindingCounts: Record<RequiredTargetName, number>
  featureBindingCounts: Record<ControlledFeatureName, Record<RequiredTargetName, number>>
  bindingDetails: Record<RequiredTargetName, BindingDetail[]>
  liveBindingValues: Record<RequiredTargetName, number[]>
  availableTargets: string[]
  availableAnimations: string[]
  listenAnimationFound: boolean
  listenAnimationFrames: number
  runtimeNodes: RuntimeNodeSummary[]
  exportedNodes: ExportedNodeSummary[]
  originalAnimationMorphTracks: AnimationMorphTrackSummary[]
  filteredAnimationMorphTracks: AnimationMorphTrackSummary[]
}

interface VoiceLipSyncTestProps {
  fixture: VoiceLipSyncFixture | null
  fixtureSourcePath: string | null
  loadError: string | null
  audioMimeType: string
  modelPath: string
}

interface PabloModelProps {
  modelPath: string
  mood: MoodState
  mouthOpen: boolean
  playbackMode: PlaybackMode
  onDiagnosticsChange: (diagnostics: MorphDiagnostics) => void
}

interface MorphDictionaryHost {
  name?: string
  parent?: Object3D | null
  traverse?: (callback: (object: MorphDictionaryHost) => void) => void
  children?: Object3D[]
  type?: string
  geometry?: {
    morphAttributes?: Record<string, unknown[]>
    userData?: {
      targetNames?: string[]
    }
  }
  morphTargetDictionary?: Record<string, number>
  morphTargetInfluences?: number[] | null
  updateMorphTargets?: () => void
}

interface GltfMeshDefinition {
  name?: string
  extras?: {
    targetNames?: string[]
  }
}

interface GltfNodeDefinition {
  name?: string
  mesh?: number
}

interface GltfAnimationChannelDefinition {
  target?: {
    node?: number
    path?: string
  }
}

interface GltfAnimationDefinition {
  name?: string
  channels?: GltfAnimationChannelDefinition[]
}

interface GltfJsonDefinition {
  meshes?: GltfMeshDefinition[]
  nodes?: GltfNodeDefinition[]
  animations?: GltfAnimationDefinition[]
}

interface GltfAsset {
  scene: ThreeGroup
  animations: AnimationClip[]
  cameras?: SceneCamera[]
  parser?: {
    json?: GltfJsonDefinition
  }
}

interface SceneCamera extends Object3D {
  isCamera: boolean
  isPerspectiveCamera?: boolean
  isOrthographicCamera?: boolean
  fov?: number
  near?: number
  far?: number
  zoom?: number
  left?: number
  right?: number
  top?: number
  bottom?: number
  updateProjectionMatrix?: () => void
}

interface PerspectiveSceneCamera extends SceneCamera {
  isPerspectiveCamera: true
  fov: number
  near: number
  far: number
  zoom: number
}

interface OrthographicSceneCamera extends SceneCamera {
  isOrthographicCamera: true
  near: number
  far: number
  zoom: number
  left: number
  right: number
  top: number
  bottom: number
}

interface CameraSnapshot {
  position: Vector3Tuple
  rotation: Vector3Tuple
  near: number | null
  far: number | null
  zoom: number | null
  fov: number | null
}

const REQUIRED_TARGETS = ['mad', 'open_mouth', 'open', 'open_mad'] as const
const CONTROLLED_FEATURE_NAMES = ['body', 'Mouth'] as const
const INSPECTED_NODE_NAMES = ['body', 'Mouth', 'eyeL', 'eyeR', 'browL', 'browR'] as const
const LISTEN_ANIMATION_NAME = 'Action'
const IDLE_ANIMATION_NAME = 'idle'
const LISTEN_FPS = 24
const LISTEN_LOOP_START_FRAME = 2
const LISTEN_FRAME_DURATION = 1 / LISTEN_FPS
const PABLO_CAMERA_FOV = 24
const PABLO_CAMERA_POSITION = [0, 1.48, 4.18] as const
const PABLO_CAMERA_TARGET = [0, 0.36, 0] as const
const PABLO_BACKGROUND_IMAGE = '/pablo_session_background.png'

const CONTROLLED_FEATURE_TARGETS: Record<ControlledFeatureName, readonly RequiredTargetName[]> = {
  body: ['mad', 'open_mouth'],
  Mouth: ['open', 'open_mad'],
}

function isSceneCamera(object: Object3D): object is SceneCamera {
  return (object as SceneCamera).isCamera === true
}

function isPerspectiveCamera(camera: SceneCamera): camera is PerspectiveSceneCamera {
  return 'isPerspectiveCamera' in camera && camera.isPerspectiveCamera === true
}

function isOrthographicCamera(camera: SceneCamera): camera is OrthographicSceneCamera {
  return 'isOrthographicCamera' in camera && camera.isOrthographicCamera === true
}

function findEmbeddedCamera(scene: Object3D): SceneCamera | null {
  let embeddedCamera: SceneCamera | null = null

  scene.traverse((object) => {
    if (embeddedCamera || !isSceneCamera(object)) {
      return
    }

    embeddedCamera = object
  })

  return embeddedCamera
}

function getPrimaryEmbeddedCamera(gltf: GltfAsset): SceneCamera | null {
  const exportedCamera = gltf.cameras?.find(isSceneCamera)
  if (exportedCamera) {
    return exportedCamera
  }

  return findEmbeddedCamera(gltf.scene)
}

function updateSceneCameraProjection(camera: SceneCamera) {
  camera.updateProjectionMatrix?.()
}

function toVector3Tuple(x: number, y: number, z: number): Vector3Tuple {
  return [x, y, z]
}

function areNumbersClose(left: number, right: number, epsilon = 0.0001): boolean {
  return Math.abs(left - right) <= epsilon
}

function areVectorTuplesEqual(left: Vector3Tuple, right: Vector3Tuple): boolean {
  return left.every((value, index) => areNumbersClose(value, right[index]))
}

function areCameraSnapshotsEqual(
  left: CameraSnapshot | null,
  right: CameraSnapshot | null
): boolean {
  if (!left || !right) {
    return left === right
  }

  return (
    areVectorTuplesEqual(left.position, right.position) &&
    areVectorTuplesEqual(left.rotation, right.rotation) &&
    areNumbersClose(left.near ?? 0, right.near ?? 0) &&
    areNumbersClose(left.far ?? 0, right.far ?? 0) &&
    areNumbersClose(left.zoom ?? 0, right.zoom ?? 0) &&
    areNumbersClose(left.fov ?? 0, right.fov ?? 0)
  )
}

function createCameraSnapshot(camera: SceneCamera): CameraSnapshot {
  return {
    position: toVector3Tuple(camera.position.x, camera.position.y, camera.position.z),
    rotation: toVector3Tuple(camera.rotation.x, camera.rotation.y, camera.rotation.z),
    near: typeof camera.near === 'number' ? camera.near : null,
    far: typeof camera.far === 'number' ? camera.far : null,
    zoom: typeof camera.zoom === 'number' ? camera.zoom : null,
    fov: isPerspectiveCamera(camera) && typeof camera.fov === 'number' ? camera.fov : null,
  }
}

function formatVector3Tuple(value: Vector3Tuple | null): string {
  if (!value) {
    return '—'
  }

  return value.map((entry) => entry.toFixed(2)).join(', ')
}

function getPreferredAlignment(
  fixture: VoiceLipSyncFixture | null
): CharacterAlignmentPayload | null {
  if (!fixture) return null
  if (fixture.normalized_alignment) return fixture.normalized_alignment
  return fixture.alignment ?? null
}

function extractFullText(alignment: CharacterAlignmentPayload | null): string {
  if (!alignment?.characters?.length) return ''
  return alignment.characters.join('').trim()
}

function isWordCharacter(character: string): boolean {
  return /[\p{L}\p{N}'’_-]/u.test(character)
}

function deriveWordTimings(alignment: CharacterAlignmentPayload | null): WordTiming[] {
  if (!alignment?.characters?.length) return []

  const characters = alignment.characters
  const starts = alignment.character_start_times_seconds ?? []
  const ends = alignment.character_end_times_seconds ?? []
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

function createEmptyBindingCounts(): Record<RequiredTargetName, number> {
  return {
    mad: 0,
    open_mouth: 0,
    open: 0,
    open_mad: 0,
  }
}

function createEmptyFeatureBindingCounts(): Record<
  ControlledFeatureName,
  Record<RequiredTargetName, number>
> {
  return {
    body: createEmptyBindingCounts(),
    Mouth: createEmptyBindingCounts(),
  }
}

function createEmptyBindingDetails(): Record<RequiredTargetName, BindingDetail[]> {
  return {
    mad: [],
    open_mouth: [],
    open: [],
    open_mad: [],
  }
}

function createEmptyLiveBindingValues(): Record<RequiredTargetName, number[]> {
  return {
    mad: [],
    open_mouth: [],
    open: [],
    open_mad: [],
  }
}

function readLiveBindingValues(
  bindings: Record<RequiredTargetName, MorphBinding[]>
): Record<RequiredTargetName, number[]> {
  return {
    mad: bindings.mad.map((binding) => binding.influences[binding.index] ?? 0),
    open_mouth: bindings.open_mouth.map((binding) => binding.influences[binding.index] ?? 0),
    open: bindings.open.map((binding) => binding.influences[binding.index] ?? 0),
    open_mad: bindings.open_mad.map((binding) => binding.influences[binding.index] ?? 0),
  }
}

function isControlledFeatureName(value: string | undefined): value is ControlledFeatureName {
  return CONTROLLED_FEATURE_NAMES.includes(value as ControlledFeatureName)
}

function isInspectedNodeName(value: string | undefined): value is InspectedNodeName {
  return INSPECTED_NODE_NAMES.includes(value as InspectedNodeName)
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

function normalizeControlledTargetName(targetName: string): RequiredTargetName | null {
  if (targetName === 'open_mouth_mad') {
    return 'open_mad'
  }

  return REQUIRED_TARGETS.includes(targetName as RequiredTargetName)
    ? (targetName as RequiredTargetName)
    : null
}

function getTargetNamesFromDictionary(
  dictionary: Record<string, number> | null | undefined
): string[] {
  if (!dictionary) return []

  return Object.entries(dictionary)
    .sort((left, right) => left[1] - right[1])
    .map(([targetName]) => targetName)
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

function hasMorphInfluences(object: MorphDictionaryHost): object is MorphDictionaryHost &
  Required<Pick<MorphDictionaryHost, 'morphTargetInfluences'>> & {
    name?: string
  } {
  return Array.isArray(object.morphTargetInfluences)
}

function syncMorphState(
  bindings: Record<RequiredTargetName, MorphBinding[]>,
  mood: MoodState,
  mouthOpen: boolean
) {
  const madValue = mood === 'mad' ? 1 : 0
  const bodyMouthValue = mouthOpen ? 1 : 0
  const normalOpenValue = mouthOpen && mood === 'normal' ? 1 : 0
  const madOpenValue = mouthOpen && mood === 'mad' ? 1 : 0

  applyMorphBindings(bindings.mad, madValue)
  applyMorphBindings(bindings.open_mouth, bodyMouthValue)
  applyMorphBindings(bindings.open, normalOpenValue)
  applyMorphBindings(bindings.open_mad, madOpenValue)
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

function getAnimationMorphTrackSummaries(clips: AnimationClip[]): AnimationMorphTrackSummary[] {
  return clips
    .map((clip) => {
      const targetNodeNames = Array.from(
        new Set(
          clip.tracks
            .filter((track) => track.name.includes('.morphTargetInfluences'))
            .map((track) => track.name.split('.morphTargetInfluences')[0] ?? '')
            .filter((targetName) => targetName.length > 0)
        )
      ).sort((left, right) => left.localeCompare(right))

      return {
        clipName: clip.name || 'unnamed-animation',
        targetNodeNames,
      }
    })
    .sort((left, right) => left.clipName.localeCompare(right.clipName))
}

function getExportedNodeSummaries(gltf: GltfAsset): ExportedNodeSummary[] {
  const json = gltf.parser?.json
  const nodes = json?.nodes ?? []
  const meshes = json?.meshes ?? []

  return nodes
    .filter((node) => isInspectedNodeName(node.name))
    .map((node) => {
      const mesh = typeof node.mesh === 'number' ? meshes[node.mesh] : null
      return {
        nodeName: node.name ?? 'unnamed-node',
        meshName: mesh?.name ?? null,
        targetNames: [...(mesh?.extras?.targetNames ?? [])],
      }
    })
    .sort((left, right) => left.nodeName.localeCompare(right.nodeName))
}

function PabloModel({
  modelPath,
  mood,
  mouthOpen,
  playbackMode,
  onDiagnosticsChange,
}: PabloModelProps) {
  const gltf = useGLTF(modelPath) as GltfAsset
  const model = useMemo(() => gltf.scene as ThreeGroup & MorphDictionaryHost, [gltf.scene])
  const exportedNodes = useMemo(() => getExportedNodeSummaries(gltf), [gltf])
  const exportedTargetNamesByNodeName = useMemo(
    () => new Map(exportedNodes.map((node) => [node.nodeName, node.targetNames])),
    [exportedNodes]
  )
  const originalAnimationMorphTracks = useMemo(
    () => getAnimationMorphTrackSummaries(gltf.animations),
    [gltf.animations]
  )
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
  const filteredAnimationMorphTracks = useMemo(
    () => getAnimationMorphTrackSummaries(animationClips),
    [animationClips]
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
    const availableTargets = new Set<string>()
    const discoveredFeatureNames = new Set<ControlledFeatureName>()
    const featureBindingCounts = createEmptyFeatureBindingCounts()
    const bindingDetails = createEmptyBindingDetails()
    const runtimeNodes: RuntimeNodeSummary[] = []

    model.traverse?.((object) => {
      const nextObject = object as Object3D & MorphDictionaryHost

      if (isControlledFeatureName(nextObject.name)) {
        discoveredFeatureNames.add(nextObject.name)
      }

      const exportedTargetNames = nextObject.name
        ? (exportedTargetNamesByNodeName.get(nextObject.name) ?? [])
        : []
      const dictionary = getMorphTargetDictionary(nextObject, exportedTargetNames)
      const runtimeTargetNames = getTargetNamesFromDictionary(dictionary)
      const hasInspectableMorphState =
        runtimeTargetNames.length > 0 ||
        exportedTargetNames.length > 0 ||
        Array.isArray(nextObject.morphTargetInfluences)

      if (isInspectedNodeName(nextObject.name) || hasInspectableMorphState) {
        runtimeNodes.push({
          objectName: nextObject.name ?? 'unnamed-node',
          objectType: nextObject.type ?? 'Object3D',
          parentName: nextObject.parent?.name ?? null,
          childNames:
            nextObject.children
              ?.map((child) => child.name)
              .filter((childName) => childName.length > 0) ?? [],
          morphTargetNames: runtimeTargetNames,
          morphTargetInfluenceCount: Array.isArray(nextObject.morphTargetInfluences)
            ? nextObject.morphTargetInfluences.length
            : 0,
        })
      }

      if (!hasMorphInfluences(nextObject)) return

      const featureName = getControlledFeatureName(nextObject)
      if (!dictionary) return

      for (const [targetName, targetIndex] of Object.entries(dictionary)) {
        availableTargets.add(targetName)
        const normalizedTargetName = normalizeControlledTargetName(targetName)

        if (!normalizedTargetName) {
          continue
        }

        nextBindings[normalizedTargetName].push({
          influences: nextObject.morphTargetInfluences ?? [],
          index: targetIndex,
          meshName: nextObject.name ?? 'unnamed-mesh',
          objectName: nextObject.name ?? 'unnamed-node',
        })
        if (featureName) {
          featureBindingCounts[featureName][normalizedTargetName] += 1
          bindingDetails[normalizedTargetName].push({
            featureName,
            objectName: nextObject.name ?? 'unnamed-node',
            meshName: nextObject.name ?? 'unnamed-mesh',
            index: targetIndex,
          })
        }
      }
    })

    for (const exportedNode of exportedNodes) {
      for (const targetName of exportedNode.targetNames) {
        availableTargets.add(targetName)
      }
    }

    bindingsRef.current = nextBindings
    syncMorphState(nextBindings, mood, mouthOpen)
    const warnings: string[] = []

    for (const featureName of CONTROLLED_FEATURE_NAMES) {
      if (!discoveredFeatureNames.has(featureName)) {
        warnings.push(`Missing control object "${featureName}" in ${modelPath}.`)
        continue
      }

      for (const targetName of CONTROLLED_FEATURE_TARGETS[featureName]) {
        if (featureBindingCounts[featureName][targetName] === 0) {
          warnings.push(`Missing shapekey "${targetName}" on ${featureName} in ${modelPath}.`)
        }
      }
    }

    if (!listenAction) {
      warnings.push(`Missing animation "${LISTEN_ANIMATION_NAME}" in ${modelPath}.`)
    }
    if (!idleAction) {
      warnings.push(`Missing animation "${IDLE_ANIMATION_NAME}" in ${modelPath}.`)
    }

    onDiagnosticsChange({
      warnings,
      bindingCounts: {
        mad: nextBindings.mad.length,
        open_mouth: nextBindings.open_mouth.length,
        open: nextBindings.open.length,
        open_mad: nextBindings.open_mad.length,
      },
      featureBindingCounts,
      bindingDetails,
      liveBindingValues: readLiveBindingValues(nextBindings),
      availableTargets: Array.from(availableTargets).sort((left, right) =>
        left.localeCompare(right)
      ),
      availableAnimations: animationClips
        .map((animation: AnimationClip) => animation.name || 'unnamed-animation')
        .sort((left, right) => left.localeCompare(right)),
      listenAnimationFound: !!listenAction,
      listenAnimationFrames,
      runtimeNodes: runtimeNodes.sort((left, right) =>
        left.objectName.localeCompare(right.objectName)
      ),
      exportedNodes,
      originalAnimationMorphTracks,
      filteredAnimationMorphTracks,
    })
  }, [
    animationClips,
    exportedNodes,
    exportedTargetNamesByNodeName,
    filteredAnimationMorphTracks,
    idleAction,
    listenAction,
    listenAnimationFrames,
    model,
    modelPath,
    mood,
    mouthOpen,
    onDiagnosticsChange,
    originalAnimationMorphTracks,
  ])

  useLayoutEffect(() => {
    syncMorphState(bindingsRef.current, mood, mouthOpen)
  }, [mood, mouthOpen])

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
    syncMorphState(bindingsRef.current, mood, mouthOpen)

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

  return <primitive object={model} />
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
        Loading Pablo.glb...
      </div>
    </Html>
  )
}

function applyEmbeddedCameraProjection(sourceCamera: SceneCamera, targetCamera: SceneCamera) {
  if (isPerspectiveCamera(targetCamera)) {
    if (sourceCamera.isPerspectiveCamera && typeof sourceCamera.fov === 'number') {
      targetCamera.fov = sourceCamera.fov
    }
    if (typeof sourceCamera.near === 'number') {
      targetCamera.near = sourceCamera.near
    }
    if (typeof sourceCamera.far === 'number') {
      targetCamera.far = sourceCamera.far
    }
    if (typeof sourceCamera.zoom === 'number') {
      targetCamera.zoom = sourceCamera.zoom
    }
  }

  if (isOrthographicCamera(targetCamera)) {
    if (sourceCamera.isOrthographicCamera) {
      if (typeof sourceCamera.left === 'number') targetCamera.left = sourceCamera.left
      if (typeof sourceCamera.right === 'number') targetCamera.right = sourceCamera.right
      if (typeof sourceCamera.top === 'number') targetCamera.top = sourceCamera.top
      if (typeof sourceCamera.bottom === 'number') targetCamera.bottom = sourceCamera.bottom
      if (typeof sourceCamera.near === 'number') targetCamera.near = sourceCamera.near
      if (typeof sourceCamera.far === 'number') targetCamera.far = sourceCamera.far
      if (typeof sourceCamera.zoom === 'number') targetCamera.zoom = sourceCamera.zoom
    }
  }
}

function syncLockedCamera(sourceCamera: SceneCamera | null, targetCamera: SceneCamera) {
  if (sourceCamera) {
    sourceCamera.updateWorldMatrix(true, true)
    targetCamera.position.copy(sourceCamera.getWorldPosition(targetCamera.position))
    targetCamera.quaternion.copy(sourceCamera.getWorldQuaternion(new Quaternion()))
    applyEmbeddedCameraProjection(sourceCamera, targetCamera)
    targetCamera.updateMatrixWorld(true)
    updateSceneCameraProjection(targetCamera)
    return
  }

  targetCamera.position.set(...PABLO_CAMERA_POSITION)
  targetCamera.lookAt(...PABLO_CAMERA_TARGET)
  targetCamera.updateMatrixWorld(true)
  updateSceneCameraProjection(targetCamera)
}

function PabloCameraRig({
  modelPath,
  onCameraChange,
}: {
  modelPath: string
  onCameraChange: (snapshot: CameraSnapshot) => void
}) {
  const { camera } = useThree()
  const gltf = useGLTF(modelPath) as GltfAsset
  const embeddedCamera = useMemo(() => getPrimaryEmbeddedCamera(gltf), [gltf])
  const lastCameraSnapshotRef = useRef<CameraSnapshot | null>(null)

  useLayoutEffect(() => {
    syncLockedCamera(embeddedCamera, camera as SceneCamera)
  }, [camera, embeddedCamera])

  useFrame(() => {
    syncLockedCamera(embeddedCamera, camera as SceneCamera)

    const nextSnapshot = createCameraSnapshot(camera as SceneCamera)
    if (areCameraSnapshotsEqual(lastCameraSnapshotRef.current, nextSnapshot)) {
      return
    }

    lastCameraSnapshotRef.current = nextSnapshot
    onCameraChange(nextSnapshot)
  })

  return null
}

export default function VoiceLipSyncTest({
  fixture,
  fixtureSourcePath,
  loadError,
  audioMimeType,
  modelPath,
}: VoiceLipSyncTestProps) {
  const alignment = useMemo(() => getPreferredAlignment(fixture), [fixture])
  const fullText = useMemo(() => extractFullText(alignment), [alignment])
  const words = useMemo(() => deriveWordTimings(alignment), [alignment])
  const canvasCamera = useMemo(
    () => ({
      position: [...PABLO_CAMERA_POSITION] as Vector3Tuple,
      fov: PABLO_CAMERA_FOV,
    }),
    []
  )
  const canvasDpr = useMemo(() => [1, 2] as const, [])
  const canvasGl = useMemo(() => ({ alpha: true, antialias: true }), [])

  const [mood, setMood] = useState<MoodState>('normal')
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('idle')
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [cameraSnapshot, setCameraSnapshot] = useState<CameraSnapshot | null>(null)
  const [morphDiagnostics, setMorphDiagnostics] = useState<MorphDiagnostics>({
    warnings: [],
    bindingCounts: createEmptyBindingCounts(),
    featureBindingCounts: createEmptyFeatureBindingCounts(),
    bindingDetails: createEmptyBindingDetails(),
    liveBindingValues: createEmptyLiveBindingValues(),
    availableTargets: [],
    availableAnimations: [],
    listenAnimationFound: false,
    listenAnimationFrames: 0,
    runtimeNodes: [],
    exportedNodes: [],
    originalAnimationMorphTracks: [],
    filteredAnimationMorphTracks: [],
  })

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const frameRef = useRef<number | null>(null)
  const playbackModeRef = useRef<PlaybackMode>('idle')

  const activeWordIndex = useMemo(
    () => findActiveWordIndex(words, currentTime),
    [words, currentTime]
  )
  const activeWord = activeWordIndex >= 0 ? words[activeWordIndex] : null
  const mouthOpen = playbackMode === 'speaking' && isAudioPlaying && activeWordIndex >= 0
  const diagnosticsSnapshot = useMemo(
    () =>
      JSON.stringify(
        {
          warnings: morphDiagnostics.warnings,
          bindingCounts: morphDiagnostics.bindingCounts,
          featureBindingCounts: morphDiagnostics.featureBindingCounts,
          bindingDetails: morphDiagnostics.bindingDetails,
          liveBindingValues: morphDiagnostics.liveBindingValues,
          exportedNodes: morphDiagnostics.exportedNodes,
          runtimeNodes: morphDiagnostics.runtimeNodes,
          originalAnimationMorphTracks: morphDiagnostics.originalAnimationMorphTracks,
          filteredAnimationMorphTracks: morphDiagnostics.filteredAnimationMorphTracks,
        },
        null,
        2
      ),
    [morphDiagnostics]
  )
  const handleCameraChange = useCallback((nextSnapshot: CameraSnapshot) => {
    setCameraSnapshot((previousSnapshot) =>
      areCameraSnapshotsEqual(previousSnapshot, nextSnapshot) ? previousSnapshot : nextSnapshot
    )
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    ;(
      window as Window & {
        __PABLO_LIPSYNC_DIAGNOSTICS__?: MorphDiagnostics
      }
    ).__PABLO_LIPSYNC_DIAGNOSTICS__ = morphDiagnostics
  }, [morphDiagnostics])

  useEffect(() => {
    if (!fixture?.audio_base64) {
      return undefined
    }

    const binary = atob(fixture.audio_base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    const blob = new Blob([bytes], { type: audioMimeType })
    const audioUrl = URL.createObjectURL(blob)
    const audio = new Audio(audioUrl)
    audio.preload = 'auto'

    audioUrlRef.current = audioUrl
    audioRef.current = audio
    playbackModeRef.current = 'idle'
    setPlaybackMode('idle')
    setCurrentTime(0)
    setDuration(0)
    setIsAudioPlaying(false)
    setPlaybackError(null)

    const updateFrame = () => {
      const currentAudio = audioRef.current
      if (!currentAudio) return

      setCurrentTime(currentAudio.currentTime)
      if (!currentAudio.paused && !currentAudio.ended) {
        frameRef.current = window.requestAnimationFrame(updateFrame)
      }
    }

    const cancelFrame = () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }

    audio.onloadedmetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    audio.onplay = () => {
      playbackModeRef.current = 'speaking'
      setPlaybackMode('speaking')
      setIsAudioPlaying(true)
      cancelFrame()
      frameRef.current = window.requestAnimationFrame(updateFrame)
    }
    audio.onpause = () => {
      setIsAudioPlaying(false)
      cancelFrame()
      setCurrentTime(audio.currentTime)

      if (playbackModeRef.current !== 'listening') {
        playbackModeRef.current = 'idle'
        setPlaybackMode('idle')
      }
    }
    audio.onended = () => {
      setIsAudioPlaying(false)
      cancelFrame()
      setCurrentTime(Number.isFinite(audio.duration) ? audio.duration : 0)
      playbackModeRef.current = 'idle'
      setPlaybackMode('idle')
    }
    audio.onerror = () => {
      setIsAudioPlaying(false)
      cancelFrame()
      playbackModeRef.current = 'idle'
      setPlaybackMode('idle')
      setPlaybackError('Failed to play the saved ElevenLabs audio fixture.')
    }

    return () => {
      cancelFrame()
      audio.pause()
      audio.src = ''
      audio.onloadedmetadata = null
      audio.onplay = null
      audio.onpause = null
      audio.onended = null
      audio.onerror = null
      audioRef.current = null

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }
    }
  }, [audioMimeType, fixture?.audio_base64])

  const handlePlayPause = async () => {
    const audio = audioRef.current
    if (!audio) return

    try {
      setPlaybackError(null)

      if (audio.paused) {
        if (playbackModeRef.current === 'listening') {
          playbackModeRef.current = 'idle'
          setPlaybackMode('idle')
        }
        await audio.play()
        return
      }

      playbackModeRef.current = 'idle'
      setPlaybackMode('idle')
      audio.pause()
    } catch (error) {
      setPlaybackError(
        error instanceof Error ? `Playback failed: ${error.message}` : 'Playback failed.'
      )
    }
  }

  const handleRestart = async () => {
    const audio = audioRef.current
    if (!audio) return

    try {
      setPlaybackError(null)
      playbackModeRef.current = 'idle'
      setPlaybackMode('idle')
      audio.pause()
      audio.currentTime = 0
      setCurrentTime(0)
      await audio.play()
    } catch (error) {
      setPlaybackError(
        error instanceof Error ? `Restart failed: ${error.message}` : 'Restart failed.'
      )
    }
  }

  const handleListen = () => {
    const audio = audioRef.current

    setPlaybackError(null)
    playbackModeRef.current = 'listening'
    setPlaybackMode('listening')
    setIsAudioPlaying(false)
    setCurrentTime(0)

    if (!audio) return

    audio.pause()
    audio.currentTime = 0
  }

  const hasFixture = !!fixture?.audio_base64 && !!alignment

  return (
    <Container fluid py="xl" px="xl">
      <Stack gap="xl" maw={1680} mx="auto">
        <Stack gap={4}>
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <div>
              <Title order={2}>Lip Sync Test Lab</Title>
              <Text c="dimmed" size="sm">
                Frontend-only prototype driven by the saved ElevenLabs fixture and Pablo&apos;s
                updated mouth rig.
              </Text>
            </div>
            <Group gap="xs">
              <Badge variant="light" color="cyan">
                /studio/test
              </Badge>
              <Badge variant="light" color={hasFixture ? 'teal' : 'red'}>
                {hasFixture ? 'Fixture Loaded' : 'Fixture Missing'}
              </Badge>
            </Group>
          </Group>
          {fixtureSourcePath ? (
            <Text size="xs" c="dimmed">
              Source fixture: <Code>{fixtureSourcePath}</Code>
            </Text>
          ) : null}
        </Stack>

        {loadError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="Fixture Load Error">
            {loadError}
          </Alert>
        ) : null}

        {playbackError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="Audio Error">
            {playbackError}
          </Alert>
        ) : null}

        {morphDiagnostics.warnings.length > 0 ? (
          <Alert
            color="yellow"
            icon={<IconAlertCircle size={16} />}
            title="Model Diagnostics"
            data-testid="voice-lipsync-diagnostics-alert"
          >
            <Stack gap={4}>
              {morphDiagnostics.warnings.map((warning) => (
                <Text key={warning} size="sm">
                  {warning}
                </Text>
              ))}
            </Stack>
          </Alert>
        ) : null}

        <Paper
          radius={32}
          p="lg"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.68))',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: '0 32px 80px rgba(15, 23, 42, 0.16)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <Group gap="xs">
                <Button
                  data-testid="voice-lipsync-play"
                  leftSection={
                    isAudioPlaying ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />
                  }
                  onClick={() => {
                    void handlePlayPause()
                  }}
                  disabled={!hasFixture}
                >
                  {isAudioPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button
                  data-testid="voice-lipsync-restart"
                  variant="light"
                  leftSection={<IconRotateClockwise size={16} />}
                  onClick={() => {
                    void handleRestart()
                  }}
                  disabled={!hasFixture}
                >
                  Restart
                </Button>
                <Button
                  data-testid="voice-lipsync-listen"
                  color="orange"
                  variant={playbackMode === 'listening' ? 'filled' : 'light'}
                  onClick={handleListen}
                >
                  Listen
                </Button>
              </Group>

              <Group gap="sm" wrap="wrap">
                <SegmentedControl
                  value={mood}
                  onChange={(value) => setMood(value as MoodState)}
                  data={[
                    { label: 'Normal', value: 'normal' },
                    { label: 'Mad', value: 'mad' },
                  ]}
                />
              </Group>
            </Group>

            <Box
              style={{
                position: 'relative',
                width: '100%',
                minHeight: 'clamp(420px, 72vh, 860px)',
                aspectRatio: '16 / 9',
                borderRadius: 32,
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.45)',
                backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.14), rgba(15, 23, 42, 0.3)), url("${PABLO_BACKGROUND_IMAGE}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
            >
              <Box
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
                shadows="percentage"
                dpr={canvasDpr}
                gl={canvasGl}
                style={{
                  pointerEvents: 'none',
                  position: 'relative',
                  zIndex: 1,
                }}
                camera={canvasCamera}
              >
                <PabloCameraRig modelPath={modelPath} onCameraChange={handleCameraChange} />
                <ambientLight intensity={0.72} />
                <hemisphereLight args={['#edf7ff', '#0f172a', 1.2]} />
                <directionalLight
                  position={[4.8, 5.4, 5.8]}
                  intensity={2.1}
                  color="#fff2d9"
                  castShadow
                />
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
                  <PabloModel
                    modelPath={modelPath}
                    mood={mood}
                    mouthOpen={mouthOpen}
                    playbackMode={playbackMode}
                    onDiagnosticsChange={setMorphDiagnostics}
                  />
                </Suspense>
              </Canvas>
              <Box
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
            </Box>
          </Stack>
        </Paper>

        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
          <Stack gap="lg">
            <Paper radius="xl" p="lg" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" wrap="wrap">
                  <Title order={4}>Live Debug</Title>
                  <Badge
                    variant="light"
                    color={playbackMode === 'listening' ? 'orange' : mouthOpen ? 'teal' : 'gray'}
                  >
                    {playbackMode === 'listening'
                      ? 'Listening Loop'
                      : mouthOpen
                        ? 'Mouth Open'
                        : 'Mouth Closed'}
                  </Badge>
                </Group>
                <SimpleGrid cols={{ base: 2, md: 4, xl: 8 }} spacing="sm">
                  <Paper radius="md" p="sm" bg="var(--mantine-color-dark-8)">
                    <Text size="xs" c="dimmed">
                      Mode
                    </Text>
                    <Text fw={600}>{playbackMode}</Text>
                  </Paper>
                  <Paper radius="md" p="sm" bg="var(--mantine-color-dark-8)">
                    <Text size="xs" c="dimmed">
                      Mood
                    </Text>
                    <Text fw={600}>{mood}</Text>
                  </Paper>
                  <Paper radius="md" p="sm" bg="var(--mantine-color-dark-8)">
                    <Text size="xs" c="dimmed">
                      Current Word
                    </Text>
                    <Text fw={600}>{activeWord?.text ?? '—'}</Text>
                  </Paper>
                  <Paper radius="md" p="sm" bg="var(--mantine-color-dark-8)">
                    <Text size="xs" c="dimmed">
                      Audio Time
                    </Text>
                    <Text fw={600}>
                      {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
                    </Text>
                  </Paper>
                  <Paper radius="md" p="sm" bg="var(--mantine-color-dark-8)">
                    <Text size="xs" c="dimmed">
                      Derived Words
                    </Text>
                    <Text fw={600}>{words.length}</Text>
                  </Paper>
                  <Paper radius="md" p="sm" bg="var(--mantine-color-dark-8)">
                    <Text size="xs" c="dimmed">
                      Camera Position
                    </Text>
                    <Text fw={600} size="sm">
                      {formatVector3Tuple(cameraSnapshot?.position ?? null)}
                    </Text>
                  </Paper>
                </SimpleGrid>
                <Text size="xs" c="dimmed">
                  Camera rotation: {formatVector3Tuple(cameraSnapshot?.rotation ?? null)}
                </Text>
              </Stack>
            </Paper>

            <Paper radius="xl" p="lg" withBorder data-testid="voice-lipsync-model-diagnostics">
              <Stack gap="sm">
                <Title order={4}>Model Diagnostics</Title>
                <Text size="sm" c="dimmed">
                  Exact morph target and animation matches found in <Code>{modelPath}</Code>.
                </Text>
                <Group gap="xs" wrap="wrap">
                  <Badge
                    variant="light"
                    color={morphDiagnostics.bindingCounts.open_mouth > 0 ? 'teal' : 'red'}
                  >
                    open_mouth: {morphDiagnostics.bindingCounts.open_mouth}
                  </Badge>
                  <Badge
                    variant="light"
                    color={morphDiagnostics.bindingCounts.open > 0 ? 'teal' : 'red'}
                  >
                    open: {morphDiagnostics.bindingCounts.open}
                  </Badge>
                  <Badge
                    variant="light"
                    color={morphDiagnostics.bindingCounts.open_mad > 0 ? 'teal' : 'red'}
                  >
                    open_mad: {morphDiagnostics.bindingCounts.open_mad}
                  </Badge>
                  <Badge
                    variant="light"
                    color={morphDiagnostics.bindingCounts.mad > 0 ? 'teal' : 'red'}
                  >
                    mad: {morphDiagnostics.bindingCounts.mad}
                  </Badge>
                  <Badge
                    variant="light"
                    color={morphDiagnostics.listenAnimationFound ? 'teal' : 'red'}
                  >
                    Action: {morphDiagnostics.listenAnimationFrames || 0} frames
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Available targets: {morphDiagnostics.availableTargets.join(', ') || 'Loading…'}
                </Text>
                {CONTROLLED_FEATURE_NAMES.map((featureName) => (
                  <Text key={featureName} size="xs" c="dimmed">
                    {featureName}:{' '}
                    {CONTROLLED_FEATURE_TARGETS[featureName]
                      .map(
                        (targetName) =>
                          `${targetName} ${morphDiagnostics.featureBindingCounts[featureName][targetName]}`
                      )
                      .join(' · ')}
                  </Text>
                ))}
                <Text size="xs" c="dimmed">
                  Available animations:{' '}
                  {morphDiagnostics.availableAnimations.join(', ') || 'Loading…'}
                </Text>
                <Paper radius="md" p="sm" bg="var(--mantine-color-dark-8)" withBorder>
                  <Text size="xs" c="dimmed" mb={6}>
                    Runtime Snapshot
                  </Text>
                  <Box
                    component="pre"
                    data-testid="voice-lipsync-runtime-snapshot"
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 12,
                      lineHeight: 1.45,
                      maxHeight: 320,
                      overflow: 'auto',
                    }}
                  >
                    {diagnosticsSnapshot}
                  </Box>
                </Paper>
              </Stack>
            </Paper>

            <Paper radius="xl" p="lg" withBorder>
              <Stack gap="sm">
                <Title order={4}>Source Text</Title>
                <Text size="sm" c="dimmed">
                  Reconstructed from the saved ElevenLabs alignment payload.
                </Text>
                <Paper radius="md" p="md" bg="var(--mantine-color-dark-8)">
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {fullText || 'No text reconstructed from the fixture.'}
                  </Text>
                </Paper>
              </Stack>
            </Paper>
          </Stack>
        </SimpleGrid>
      </Stack>
    </Container>
  )
}

useGLTF.preload('/models/Pablo.glb')
