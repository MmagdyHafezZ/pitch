'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Paper, Group, Text, TextInput, ScrollArea, Box, ActionIcon, Stack } from '@mantine/core'
import { IconX, IconSend } from '@tabler/icons-react'
import { API_CONFIG, getAccessToken } from '@/lib/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoachChatWidgetProps {
  context?: {
    page?: string
    sessionId?: string
    recentTurns?: Array<{ role: string; text: string }>
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Pos {
  x: number // px from viewport left
  y: number // px from viewport top
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_W = 380
const PANEL_H = 520

/** Diameter of the circular button */
const BTN = 68
/** Rendered size of the mascot image — larger than BTN so it overflows the circle */
const IMG = 84

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi! I'm your PITCH Coach. Ask me anything about your session or the app — I'm here to help.",
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CoachChatWidget({ context }: CoachChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  // null until client mount — avoids SSR/hydration mismatch
  const [pos, setPos] = useState<Pos | null>(null)

  const viewportRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Drag state in refs — avoids re-renders on every pointer move
  const isDragging = useRef(false)
  const hasMoved = useRef(false)
  const dragOrigin = useRef({ px: 0, py: 0, wx: 0, wy: 0 })

  // ─── Init position (client only) ─────────────────────────────────────────

  useEffect(() => {
    setPos({
      x: window.innerWidth - BTN - 28,
      y: window.innerHeight - BTN - 28,
    })
  }, [])

  // ─── Auto-scroll ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' })
      }, 80)
    }
  }, [messages, open])

  // ─── Drag ────────────────────────────────────────────────────────────────

  const clampPos = useCallback(
    (x: number, y: number): Pos => ({
      // Extra top padding (16px) so the leaf overflow never clips at viewport edge
      x: Math.max(4, Math.min(x, window.innerWidth - BTN - 4)),
      y: Math.max(16, Math.min(y, window.innerHeight - BTN - 4)),
    }),
    []
  )

  const startDrag = useCallback((e: React.PointerEvent, currentPos: Pos) => {
    e.preventDefault()
    isDragging.current = true
    hasMoved.current = false
    dragOrigin.current = { px: e.clientX, py: e.clientY, wx: currentPos.x, wy: currentPos.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - dragOrigin.current.px
      const dy = e.clientY - dragOrigin.current.py
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved.current = true
      if (hasMoved.current) setPos(clampPos(dragOrigin.current.wx + dx, dragOrigin.current.wy + dy))
    },
    [clampPos]
  )

  /** Mascot click (no drag) → toggle open */
  const onMascotPointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    if (!hasMoved.current) setOpen((v) => !v)
  }, [])

  /** Header click (no drag) → do nothing; dragging header only moves, doesn't close */
  const onHeaderPointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
  }, [])

  // ─── Panel position derived from mascot button pos ────────────────────────

  const getPanelStyle = (p: Pos): React.CSSProperties => {
    // Open above the mascot; fall back below if insufficient space
    let top = p.y - PANEL_H - 12
    let left = p.x - PANEL_W + BTN

    if (top < 8) top = p.y + BTN + 12
    if (left < 8) left = 8
    if (left + PANEL_W > window.innerWidth - 8) left = window.innerWidth - PANEL_W - 8

    return { position: 'fixed', top, left, zIndex: 9998 }
  }

  // ─── Streaming chat ───────────────────────────────────────────────────────

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const response = await fetch(`${API_CONFIG.baseURL}/support/chat/stream`, {
        method: 'POST',
        signal: abort.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ messages: nextMessages, context }),
      })

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data) as { delta?: string }
              if (parsed.delta) {
                content += parsed.delta
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content }
                  return updated
                })
              }
            } catch {
              /* malformed chunk — skip */
            }
          }
        }
      }

      if (!content) {
        setMessages((prev) => {
          const u = [...prev]
          u[u.length - 1] = {
            role: 'assistant',
            content: 'Sorry, I could not generate a response.',
          }
          return u
        })
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages((prev) => {
        const u = [...prev]
        u[u.length - 1] = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        }
        return u
      })
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleClose = () => {
    abortRef.current?.abort()
    setOpen(false)
  }

  // ─── Derived ─────────────────────────────────────────────────────────────

  const lastMsg = messages[messages.length - 1]
  const isLastStreaming = streaming && lastMsg?.role === 'assistant'

  // Don't render until client-side position is ready (avoids hydration mismatch)
  if (!pos) return null

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Chat Panel ─────────────────────────────────────────────────── */}
      {open && (
        <Paper
          radius="lg"
          shadow="xl"
          style={{
            ...getPanelStyle(pos),
            width: PANEL_W,
            height: PANEL_H,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--mantine-color-dark-4)',
            backgroundColor: 'var(--mantine-color-dark-7)',
          }}
        >
          {/* Header — drag handle when panel is open */}
          <Group
            px="md"
            py="sm"
            justify="space-between"
            onPointerDown={(e) => startDrag(e, pos)}
            onPointerMove={onPointerMove}
            onPointerUp={onHeaderPointerUp}
            style={{
              borderBottom: '1px solid var(--mantine-color-dark-5)',
              flexShrink: 0,
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            <Group gap="xs">
              {/* Small mascot avatar in the header */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'radial-gradient(circle at 50% 60%, #1a3a5c 0%, #0d1628 100%)',
                  border: '1.5px solid rgba(34,139,230,0.6)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image
                  src="/pitchMascotMobile.png"
                  alt="PITCH Coach"
                  width={32}
                  height={32}
                  style={{ objectFit: 'contain', marginTop: -2 }}
                />
              </div>
              <Text fw={700} size="sm" c="white">
                PITCH Coach
              </Text>
            </Group>

            {/* Stop propagation so clicking X doesn't start a drag */}
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClose}
              aria-label="Close coach chat"
            >
              <IconX size={14} />
            </ActionIcon>
          </Group>

          {/* Messages */}
          <ScrollArea flex={1} viewportRef={viewportRef} style={{ flexGrow: 1 }} scrollbarSize={4}>
            <Stack gap="xs" p="md">
              {messages.map((msg, i) => {
                const thisIsStreaming = isLastStreaming && i === messages.length - 1
                return (
                  <Box
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Box
                      style={{
                        maxWidth: '80%',
                        borderRadius: 12,
                        padding: '8px 12px',
                        backgroundColor:
                          msg.role === 'user'
                            ? 'var(--mantine-color-blue-7)'
                            : 'var(--mantine-color-dark-5)',
                        minHeight: thisIsStreaming && !msg.content ? 36 : undefined,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Text size="sm" c="white" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {msg.content}
                        {thisIsStreaming && (
                          <span
                            style={{
                              display: 'inline-block',
                              width: 2,
                              height: '1em',
                              backgroundColor: 'currentColor',
                              marginLeft: 2,
                              verticalAlign: 'text-bottom',
                              animation: 'coach-blink 0.8s step-end infinite',
                            }}
                          />
                        )}
                      </Text>
                    </Box>
                  </Box>
                )
              })}
            </Stack>
          </ScrollArea>

          {/* Footer */}
          <Group
            px="md"
            py="sm"
            gap="xs"
            style={{ borderTop: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}
          >
            <TextInput
              flex={1}
              size="sm"
              placeholder="Ask the coach..."
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              styles={{
                input: {
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  border: '1px solid var(--mantine-color-dark-4)',
                  color: 'white',
                },
              }}
            />
            <ActionIcon
              variant="filled"
              color="blue"
              size="md"
              onClick={send}
              disabled={!input.trim() || streaming}
              aria-label="Send message"
            >
              <IconSend size={14} />
            </ActionIcon>
          </Group>
        </Paper>
      )}

      {/* ── Mascot Button — draggable ───────────────────────────────────── */}
      <div
        onPointerDown={(e) => startDrag(e, pos)}
        onPointerMove={onPointerMove}
        onPointerUp={onMascotPointerUp}
        role="button"
        tabIndex={0}
        aria-label={open ? 'Close PITCH Coach' : 'Open PITCH Coach'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v)
        }}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          // Contain both the circle and the mascot overflow
          width: BTN,
          height: BTN,
          zIndex: 9999,
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
          // Float animation on the outer wrapper
          animation: open ? 'none' : 'coach-float 3s cubic-bezier(0.45,0,0.55,1) infinite',
        }}
      >
        {/* ── Circle ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 65%, #1e3f6e 0%, #0c1b34 100%)',
            // Layered rings: inner solid border + outer glow ring
            boxShadow: open
              ? `0 0 0 3px rgba(34,139,230,0.9),
                 0 0 0 6px rgba(34,139,230,0.25),
                 0 8px 28px rgba(34,139,230,0.8)`
              : `0 0 0 2.5px rgba(34,139,230,0.7),
                 0 0 0 5px rgba(34,139,230,0.15),
                 0 6px 20px rgba(34,139,230,0.45),
                 0 4px 12px rgba(0,0,0,0.6)`,
            transition: 'box-shadow 0.3s ease',
          }}
        />

        {/* ── Mascot image — oversized so it "pops" out of the circle ── */}
        <Image
          src="/pitchMascotMobile.png"
          alt="PITCH Coach"
          width={IMG}
          height={IMG}
          draggable={false}
          priority
          style={{
            position: 'absolute',
            // Centre horizontally, shift up so the face is in the circle
            // and the green leaf peeks above
            left: (BTN - IMG) / 2,
            top: (BTN - IMG) / 2 - 6,
            objectFit: 'contain',
            pointerEvents: 'none',
            filter: open
              ? 'drop-shadow(0 2px 8px rgba(34,139,230,0.5))'
              : 'drop-shadow(0 2px 6px rgba(34,139,230,0.3))',
            transition: 'filter 0.3s ease',
          }}
        />

        {/* ── Online indicator dot (closed state only) ── */}
        {!open && (
          <div
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 11,
              height: 11,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              border: '2px solid #0c1b34',
              animation: 'coach-pulse 2.2s ease-in-out infinite',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
      </div>

      {/* ── Keyframes ───────────────────────────────────────────────────── */}
      <style>{`
        @keyframes coach-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes coach-pulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%       { transform: scale(1.4); opacity: 0.6; }
        }
        @keyframes coach-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </>
  )
}
