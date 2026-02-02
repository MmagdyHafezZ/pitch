'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Group,
  Stack,
  Title,
  Text,
  Paper,
  Avatar,
  ActionIcon,
  Badge,
  TextInput,
  ScrollArea,
  Loader,
} from '@mantine/core'
import {
  IconPhone,
  IconPlayerPause,
  IconMicrophone,
  IconArrowRight,
  IconSend,
} from '@tabler/icons-react'
import { useRouter, useParams } from 'next/navigation'
import { useConversation } from '@/features/conversation'
import { useSpeechToText } from '@/features/stt'
import { api } from '@/lib/client'

export default function LiveSessionPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string
  const [time, setTime] = useState(615)
  const [textInput, setTextInput] = useState('')
  const [hints, setHints] = useState<string[]>([])
  const [timelineStages, setTimelineStages] = useState<
    Array<{
      order: number
      label: string
      description?: string
      active: boolean
      completed: boolean
    }>
  >([])
  const [currentProgress, setCurrentProgress] = useState(0)
  const [hintsError, setHintsError] = useState<string | null>(null)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isMultiTurn, setIsMultiTurn] = useState(false)
  const assistantStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleIdleHints = () => {
    if (!sessionId) return
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = setTimeout(async () => {
      try {
        const generated = await api.hints.generate({
          sessionId,
          strategy: 'contextual',
          maxHints: 3,
          includeObjectives: true,
        })
        const nextHints = generated?.hints?.map((hint: { content: string }) => hint.content) ?? []
        setHints(nextHints)
        setHintsError(null)
      } catch (err) {
        setHintsError('Unable to load hints')
      }
    }, 20000)
  }

  const {
    isConnected,
    isConnecting,
    isProcessing,
    messages,
    error: conversationError,
    sendMessage,
    startAssistantTurn,
    currentAudioUrl,
    isAudioPlaying,
    hangUp,
    interrupt,
    stopAudio,
  } = useConversation({
    sessionId,
    autoConnect: true,
    onError: (error) => {},
  })

  const {
    isListening,
    transcript,
    interimTranscript,
    error: sttError,
    isSupported: isSttSupported,
    toggleListening,
    resetTranscript,
  } = useSpeechToText({
    continuous: true,
    interimResults: true,
    onResult: (text, isFinal) => {
      if (isFinal && text.trim()) {
        sendMessage(text.trim())
        resetTranscript()
        scheduleIdleHints()
      }
    },
    onError: (error) => {},
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!sessionId) return

    const loadSession = async () => {
      try {
        const session = await api.sessions.getById(sessionId)
        const config = (session?.sessionConfig as Record<string, any>) ?? {}
        setIsMultiTurn(Boolean(config.multiTurnEnabled))
      } catch {
        setIsMultiTurn(false)
      }
    }

    void loadSession()
  }, [sessionId])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSendText = () => {
    if (textInput.trim() && isConnected) {
      sendMessage(textInput.trim())
      setTextInput('')
      scheduleIdleHints()
    }
  }

  useEffect(() => {
    if (!sessionId) return

    const loadHints = async () => {
      try {
        const response = await api.hints.history(sessionId, 1)
        const latest = response?.history?.[0]
        const nextHints = latest?.hints?.map((hint: { content: string }) => hint.content) ?? []
        setHints(nextHints)
        setHintsError(null)
      } catch (err) {
        setHintsError('Unable to load hints')
      }
    }

    const loadTimeline = async () => {
      try {
        const response = await api.sessions.timeline(sessionId, 50)
        const plannedStages = response?.plannedStages ?? []
        const progress = response?.currentProgress ?? 0
        const totalTurns = response?.total ?? 0

        if (plannedStages.length === 0) {
          setTimelineStages([])
          setCurrentProgress(0)
          setTimelineError(null)
          return
        }

        // Calculate which stage is currently active based on progress
        const currentStageIndex = Math.min(
          plannedStages.length - 1,
          Math.floor((progress / 100) * plannedStages.length)
        )

        const stages = plannedStages.map((stage: any, index: number) => ({
          order: stage.order,
          label: stage.label,
          description: stage.description,
          active: index === currentStageIndex && totalTurns > 0,
          completed: index < currentStageIndex,
        }))

        setTimelineStages(stages)
        setCurrentProgress(progress)
        setTimelineError(null)
      } catch (err) {
        setTimelineError('Unable to load timeline')
      }
    }

    void loadHints()
    void loadTimeline()
    scheduleIdleHints()

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      if (assistantStartTimerRef.current) {
        clearTimeout(assistantStartTimerRef.current)
      }
    }
  }, [sessionId])

  useEffect(() => {
    if (!isMultiTurn || !isConnected) return
    if (messages.length > 0) return

    if (assistantStartTimerRef.current) {
      clearTimeout(assistantStartTimerRef.current)
    }
    assistantStartTimerRef.current = setTimeout(() => {
      startAssistantTurn()
    }, 1500)
  }, [isMultiTurn, isConnected, messages.length, startAssistantTurn])

  useEffect(() => {
    if (currentAudioUrl && isListening) {
      toggleListening()
    }
  }, [currentAudioUrl, isListening, toggleListening])

  // Refresh timeline when messages change (conversation progresses)
  useEffect(() => {
    if (messages.length > 0 && sessionId) {
      const loadTimeline = async () => {
        try {
          const response = await api.sessions.timeline(sessionId, 50)
          const plannedStages = response?.plannedStages ?? []
          const progress = response?.currentProgress ?? 0
          const totalTurns = response?.total ?? 0

          if (plannedStages.length === 0) return

          const currentStageIndex = Math.min(
            plannedStages.length - 1,
            Math.floor((progress / 100) * plannedStages.length)
          )

          const stages = plannedStages.map((stage: any, index: number) => ({
            order: stage.order,
            label: stage.label,
            description: stage.description,
            active: index === currentStageIndex && totalTurns > 0,
            completed: index < currentStageIndex,
          }))

          setTimelineStages(stages)
          setCurrentProgress(progress)
        } catch {
          // Silently fail on updates
        }
      }

      void loadTimeline()
    }
  }, [messages.length, sessionId])

  return (
    <Box
      style={{
        height: '100vh',
        backgroundColor: 'var(--mantine-color-dark-9)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar */}
      <Box
        style={{
          backgroundColor: 'var(--mantine-color-dark-8)',
          padding: '16px 32px',
          borderBottom: '1px solid var(--mantine-color-dark-6)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between">
          <Text fw={600} size="lg" c="white">
            Goal: Improve product pitch
          </Text>
          <Group gap="xl">
            <Text size="xl" fw={700} c="white">
              {formatTime(time)}
            </Text>
            <Group gap="xs">
              <Box
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'red',
                  animation: 'pulse 2s infinite',
                }}
              />
              <Text c="red" fw={600}>
                Recording
              </Text>
            </Group>
            <Text c="dimmed">Wednesday</Text>
            <Text c="dimmed">Oct 8, 2025</Text>
            <Group gap="xs">
              {isConnecting && <Loader size="sm" color="white" />}
              {conversationError && (
                <Text size="xs" c="red">
                  {conversationError}
                </Text>
              )}
              {isConnected && !isConnecting && (
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'green',
                  }}
                />
              )}
              <ActionIcon size="lg" variant="subtle" color="white">
                <IconPhone size={20} />
              </ActionIcon>
              <ActionIcon size="lg" variant="subtle" color="white">
                <Avatar size="sm" />
              </ActionIcon>
            </Group>
          </Group>
        </Group>
      </Box>

      {/* Main Content */}
      <Box p="xl" style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>
        {/* Left Panel - Hints */}
        <Paper
          withBorder
          radius="lg"
          p="lg"
          style={{
            width: 200,
            backgroundColor: 'white',
            height: 'fit-content',
            flexShrink: 0,
          }}
        >
          <Title order={4} mb="md" ta="center">
            Hints
          </Title>
          <Stack gap="md">
            {hintsError && (
              <Text size="xs" c="red">
                {hintsError}
              </Text>
            )}
            {!hintsError && hints.length === 0 && (
              <Text size="xs" c="dimmed">
                No hints yet.
              </Text>
            )}
            {hints.map((hint, i) => (
              <Group key={i} gap="xs" align="start">
                <IconArrowRight size={16} style={{ marginTop: 4, flexShrink: 0 }} />
                <Text size="sm">{hint}</Text>
              </Group>
            ))}
          </Stack>
        </Paper>

        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Paper
            withBorder
            radius="lg"
            p="xl"
            style={{
              backgroundColor: 'white',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
            }}
          >
            <Box style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Avatar size={120} radius="md" />
            </Box>

            <Box
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}
            >
              <Box
                style={{
                  width: 400,
                  height: 400,
                  borderRadius: '50%',
                  border: '2px solid var(--mantine-color-gray-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: 60,
                }}
              >
                {isListening || isProcessing ? (
                  [...Array(15)].map((_, i) => (
                    <Box
                      key={i}
                      style={{
                        width: 6,
                        height: `${Math.random() * 100 + 20}%`,
                        backgroundColor: 'var(--pitch-accent-strong)',
                        borderRadius: 3,
                        animation: isProcessing ? 'pulse 1s infinite' : 'none',
                      }}
                    />
                  ))
                ) : (
                  <Text c="dimmed" size="sm" ta="center">
                    {isSttSupported
                      ? 'Click microphone or type to start conversation'
                      : 'Type to start conversation'}
                  </Text>
                )}
              </Box>
            </Box>

            {/* Control Buttons */}
            <Group justify="center" gap="xl">
              <ActionIcon
                size={80}
                radius="xl"
                variant="filled"
                color="red"
                style={{
                  border: '4px solid white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  hangUp()
                  router.push('/studio/sessions')
                }}
                title="End call and return to sessions"
              >
                <IconPhone size={32} />
              </ActionIcon>
              <ActionIcon
                size={80}
                radius="xl"
                variant="filled"
                color={isAudioPlaying ? 'orange' : 'dark'}
                style={{
                  border: '4px solid white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  cursor: isAudioPlaying ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (isAudioPlaying) {
                    stopAudio()
                  } else if (isProcessing) {
                    interrupt()
                  }
                }}
                title={
                  isAudioPlaying
                    ? 'Stop audio'
                    : isProcessing
                      ? 'Interrupt conversation'
                      : 'Pause (not active)'
                }
              >
                <IconPlayerPause size={32} />
              </ActionIcon>
              <ActionIcon
                size={80}
                radius="xl"
                variant="filled"
                color={isListening ? 'red' : 'dark'}
                style={{ border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={toggleListening}
                disabled={!isSttSupported || !isConnected}
                title={
                  !isSttSupported
                    ? 'Speech recognition not supported'
                    : !isConnected
                      ? 'Connecting...'
                      : isListening
                        ? 'Stop listening'
                        : 'Start listening'
                }
              >
                <IconMicrophone size={32} />
              </ActionIcon>
            </Group>
          </Paper>

          {/* Text Input */}
          <Paper
            withBorder
            radius="lg"
            p="md"
            style={{ backgroundColor: 'var(--pitch-surface-bg)' }}
          >
            <Group gap="xs" align="flex-end">
              <TextInput
                placeholder="Type your message..."
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value)
                  scheduleIdleHints()
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
                style={{ flex: 1 }}
                disabled={!isConnected}
              />
              <ActionIcon
                size="lg"
                variant="filled"
                color="brand"
                onClick={handleSendText}
                disabled={!textInput.trim() || !isConnected}
              >
                <IconSend size={20} />
              </ActionIcon>
            </Group>
            {(interimTranscript || transcript) && (
              <Text size="sm" c="dimmed" mt="xs">
                Listening: {interimTranscript || transcript}
              </Text>
            )}
          </Paper>

          {/* Transcript */}
          <Paper
            withBorder
            radius="lg"
            p="lg"
            style={{ backgroundColor: 'var(--pitch-surface-bg)', maxHeight: 300 }}
          >
            <Box
              mb="md"
              px="md"
              py="xs"
              style={{
                backgroundColor: 'black',
                borderRadius: 8,
                display: 'inline-block',
              }}
            >
              <Text c="white" fw={600}>
                Transcript ({messages.length} messages)
              </Text>
            </Box>
            <ScrollArea style={{ height: 200 }}>
              <Stack gap="md">
                {messages.length === 0 ? (
                  <Text c="dimmed" size="sm" ta="center">
                    No messages yet. Start the conversation!
                  </Text>
                ) : (
                  messages.map((msg) => (
                    <Box
                      key={msg.id}
                      p="sm"
                      style={{
                        backgroundColor:
                          msg.role === 'user'
                            ? 'var(--pitch-accent-soft)'
                            : 'var(--mantine-color-gray-1)',
                        borderRadius: 8,
                        borderLeft: `4px solid ${msg.role === 'user' ? 'var(--pitch-accent-strong)' : 'var(--mantine-color-gray-6)'}`,
                      }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Badge color={msg.role === 'user' ? 'brand' : 'gray'}>
                          {msg.role === 'user' ? 'You' : 'AI'}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {msg.timestamp.toLocaleTimeString()}
                        </Text>
                      </Group>
                      <Text size="sm">{msg.text}</Text>
                      {msg.usage && (
                        <Text size="xs" c="dimmed" mt="xs">
                          Tokens: {msg.usage.totalTokens}
                          {msg.usage.costUsd && ` ($${msg.usage.costUsd.toFixed(4)})`}
                        </Text>
                      )}
                    </Box>
                  ))
                )}
              </Stack>
            </ScrollArea>
          </Paper>
        </Box>

        {/* Right Panel - Timeline */}
        <Paper
          withBorder
          radius="lg"
          p="lg"
          style={{
            width: 180,
            backgroundColor: 'var(--pitch-surface-bg)',
            height: 'fit-content',
            flexShrink: 0,
          }}
        >
          <Title order={4} mb="xl" ta="center">
            Timeline
          </Title>
          <Box style={{ position: 'relative', paddingLeft: 40 }}>
            {/* Timeline line */}
            <Box
              style={{
                position: 'absolute',
                left: 20,
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: 'var(--mantine-color-gray-4)',
              }}
            />

            <Stack gap={60}>
              {timelineError && (
                <Text size="xs" c="red">
                  {timelineError}
                </Text>
              )}
              {!timelineError && currentProgress > 0 && (
                <Box mb="md">
                  <Badge variant="filled" color="blue" size="lg">
                    {currentProgress}% Complete
                  </Badge>
                </Box>
              )}
              {!timelineError && timelineStages.length === 0 && (
                <Text size="xs" c="dimmed">
                  Loading session plan...
                </Text>
              )}
              {timelineStages.map((stage, i) => (
                <Box key={i} style={{ position: 'relative' }}>
                  {/* Timeline dot */}
                  <Box
                    style={{
                      position: 'absolute',
                      left: -28,
                      top: -4,
                      width: stage.active ? 16 : 8,
                      height: stage.active ? 16 : 8,
                      borderRadius: '50%',
                      backgroundColor: stage.completed
                        ? 'var(--mantine-color-green-6)'
                        : stage.active
                          ? 'var(--mantine-color-blue-6)'
                          : 'var(--mantine-color-gray-5)',
                      border: stage.active ? '2px solid var(--mantine-color-blue-2)' : 'none',
                    }}
                  />
                  <Box>
                    <Text
                      size="sm"
                      fw={stage.active ? 600 : 400}
                      c={stage.active ? 'blue' : stage.completed ? 'green' : 'dimmed'}
                    >
                      {stage.label}
                    </Text>
                    {stage.description && (
                      <Text size="xs" c="dimmed" mt={4} style={{ lineHeight: 1.3 }}>
                        {stage.description}
                      </Text>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        </Paper>
      </Box>

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </Box>
  )
}
