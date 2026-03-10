'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import {
  Paper,
  Group,
  Text,
  TextInput,
  ScrollArea,
  Box,
  ActionIcon,
  Stack,
  Button,
  Divider,
  Loader,
  Badge,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconX,
  IconSend,
  IconArrowRight,
  IconShieldCheck,
  IconShieldOff,
  IconAlertTriangle,
  IconTrash,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconPaperclip,
  IconFileText,
  IconDownload,
  IconCheck,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { API_CONFIG, getAccessToken } from '@/lib/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoachChatWidgetProps {
  context?: {
    page?: string
    sessionId?: string
    recentTurns?: Array<{ role: string; text: string }>
  }
}

export interface Attachment {
  name: string
  /** text content OR data URL for images. Empty string for S3 uploads. */
  content: string
  mimeType: string
  size: number
  /** Presigned S3 URL — set for files uploaded to S3 instead of sent inline. */
  s3Url?: string
  /** True while the S3 upload is in flight. */
  uploading?: boolean
}

interface UIAction {
  type: string
  label: string
  path?: string
  target?: string
  screen?: string
  selector?: string
  reason?: string
  value?: string
  steps?: UIAction[]
  /** For generate_document — full document body */
  docContent?: string
  /** For generate_document — output format */
  format?: 'pdf' | 'txt' | 'markdown'
}

type ActionState = 'pending' | 'permitted' | 'denied'

interface Message {
  role: 'user' | 'assistant'
  content: string
  action?: UIAction
  actionState?: ActionState
  attachments?: Attachment[]
  /** Indices of sequence steps that have been successfully completed */
  completedStepIndices?: number[]
}

interface Pos {
  x: number
  y: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_W = 430
const PANEL_H = 600
const BTN = 68
const IMG = 84

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi! I'm your PITCH Coach. Ask me anything about your session or the app — I'm here to help.",
}

const ACCEPTED_FILE_TYPES = '.txt,.md,.csv,.pdf,.png,.jpg,.jpeg,.webp'

// ─── Component ───────────────────────────────────────────────────────────────

export function CoachChatWidget({ context }: CoachChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  /** Live status text shown while a sequence step is executing (e.g. "Clicking Create Session button…") */
  const [executionStatus, setExecutionStatus] = useState<string | null>(null)

  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const requiresPermission = (action: UIAction): boolean => {
    if (action.type === 'generate_document') return false
    if (action.steps?.length) return action.steps.some(requiresPermission)
    return Boolean(action.selector) || action.type === 'fill'
  }

  const waitForElement = useCallback(
    (selector: string, timeout = 20000): Promise<HTMLElement | null> =>
      new Promise((resolve) => {
        const existing = document.querySelector<HTMLElement>(selector)
        if (existing) return resolve(existing)
        const observer = new MutationObserver(() => {
          const el = document.querySelector<HTMLElement>(selector)
          if (el) {
            observer.disconnect()
            clearTimeout(timer)
            resolve(el)
          }
        })
        observer.observe(document.body, { childList: true, subtree: true })
        const timer = setTimeout(() => {
          observer.disconnect()
          resolve(null)
        }, timeout)
      }),
    []
  )

  const fillElement = useCallback((el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    nativeSetter?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, [])

  const highlightElement = useCallback((el: Element) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('coach-action-highlight')
    setTimeout(() => el.classList.remove('coach-action-highlight'), 2500)
  }, [])

  const resolveElement = useCallback((action: UIAction): Element | null => {
    const el = action.target
      ? document.querySelector(`[data-tour-id="${action.target}"]`)
      : action.selector
        ? document.querySelector(action.selector)
        : null
    if (!el) {
      notifications.show({
        message: "Couldn't find that element on the current page.",
        color: 'orange',
        autoClose: 3000,
      })
    }
    return el
  }, [])

  const executeAction = useCallback(
    (action: UIAction | undefined) => {
      if (!action) return
      switch (action.type) {
        case 'navigate':
          if (action.path) router.push(action.path)
          break
        case 'open_settings':
          setOpen(false)
          window.dispatchEvent(new CustomEvent('pitch:open-settings'))
          break
        case 'scroll_to': {
          const el = resolveElement(action)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          break
        }
        case 'highlight': {
          const el = resolveElement(action)
          if (el) highlightElement(el)
          break
        }
        case 'click': {
          const el = resolveElement(action) as HTMLElement | null
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => el.click(), 400)
          }
          break
        }
        case 'fill': {
          let el = resolveElement(action) as HTMLElement | null
          if (el && !(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
            el = el.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
          }
          if (el) fillElement(el as HTMLInputElement | HTMLTextAreaElement, action.value ?? '')
          break
        }
        case 'start_tour':
          window.dispatchEvent(
            new CustomEvent('pitch:start-tour', { detail: { screen: action.screen } })
          )
          break
      }
    },
    [router, highlightElement, resolveElement, fillElement]
  )

  const executeSteps = useCallback(
    async (steps: UIAction[], msgIndex?: number) => {
      const markDone = (idx: number) => {
        if (msgIndex === undefined) return
        setMessages((prev) => {
          const updated = [...prev]
          const m = updated[msgIndex]
          if (!m) return prev
          updated[msgIndex] = {
            ...m,
            completedStepIndices: [...(m.completedStepIndices ?? []), idx],
          }
          return updated
        })
      }

      let justNavigated = false
      for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
        const step = steps[stepIdx]
        // Update live status display
        setExecutionStatus(`${step.label}…`)

        if (step.type === 'navigate' && step.path) {
          router.push(step.path)
          justNavigated = true
          markDone(stepIdx)
          continue
        }

        const selector = step.target ? `[data-tour-id="${step.target}"]` : (step.selector ?? null)

        if (selector) {
          // After a navigation/click the target wizard step may not have committed yet
          // → wait up to 20 s.  Otherwise give it 5 s so bad selectors fail fast.
          let el = await waitForElement(selector, justNavigated ? 20000 : 5000)

          // Auto-recovery: if the target is a wizard-step element and it isn't found,
          // the wizard is likely still on the previous step.  Click Next to advance it,
          // then try once more.
          if (!el && step.target) {
            const wizardOnlyTargets = [
              'create-session-topic',
              'create-session-objective',
              'create-session-context',
              'create-session-ai-role',
              'create-session-user-role',
              'create-session-generate',
              'create-session-scenario-item',
              'create-session-persona-item',
              'create-session-model-item',
              'style-tone-formal',
              'style-tone-professional',
              'style-tone-friendly',
              'style-tone-casual',
              'style-pace-measured',
              'style-pace-conversational',
              'style-pace-fast',
              'style-length-concise',
              'style-length-balanced',
              'style-length-detailed',
              'style-patience-low',
              'style-patience-medium',
              'style-patience-high',
              'style-initiative-reactive',
              'style-initiative-balanced',
              'style-initiative-proactive',
              'style-difficulty-warm-up',
              'style-difficulty-focused',
              'style-difficulty-challenging',
              'style-difficulty-elite',
            ]
            if (wizardOnlyTargets.includes(step.target)) {
              const nextBtn = document.querySelector<HTMLElement>(
                '[data-tour-id="create-session-next"]'
              )
              if (nextBtn) {
                nextBtn.click()
                await new Promise((r) => setTimeout(r, 600))
                el = await waitForElement(selector, 10000)
              }
            }
          }

          justNavigated = false

          if (!el) {
            notifications.show({
              message: `Step "${step.label}" — element not found.`,
              color: 'orange',
              autoClose: 3000,
            })
            continue
          }

          if (step.type === 'fill') {
            let fillEl: HTMLElement = el
            if (!(fillEl instanceof HTMLInputElement) && !(fillEl instanceof HTMLTextAreaElement)) {
              fillEl =
                fillEl.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea') ??
                fillEl
            }
            fillElement(fillEl as HTMLInputElement | HTMLTextAreaElement, step.value ?? '')
            markDone(stepIdx)
          } else if (step.type === 'click') {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            await new Promise((r) => setTimeout(r, 350))
            el.click()
            await new Promise((r) => setTimeout(r, 600))
            justNavigated = true
            markDone(stepIdx)
          } else {
            executeAction(step)
            markDone(stepIdx)
          }
        } else {
          executeAction(step)
          justNavigated = false
          markDone(stepIdx)
        }
      }
      setExecutionStatus(null)
    },
    [router, waitForElement, fillElement, executeAction]
  )

  const permitAction = useCallback(
    (msgIndex: number) => {
      let actionToRun: UIAction | undefined
      setMessages((prev) => {
        const updated = [...prev]
        const msg = updated[msgIndex]
        if (!msg?.action) return prev
        actionToRun = msg.action
        updated[msgIndex] = { ...msg, actionState: 'permitted' }
        return updated
      })
      setTimeout(() => {
        if (!actionToRun) return
        if (actionToRun.steps?.length) {
          void executeSteps(actionToRun.steps, msgIndex)
        } else {
          executeAction(actionToRun)
        }
      }, 0)
    },
    [executeAction, executeSteps]
  )

  const denyAction = useCallback((msgIndex: number) => {
    setMessages((prev) => {
      const updated = [...prev]
      const msg = updated[msgIndex]
      if (!msg?.action) return prev
      updated[msgIndex] = { ...msg, actionState: 'denied' }
      return updated
    })
  }, [])

  // ─── Document download ───────────────────────────────────────────────────

  const downloadDocument = useCallback(async (action: UIAction) => {
    const content = action.docContent ?? ''
    const format = action.format ?? 'pdf'
    const title = action.label ?? 'document'

    if (format === 'pdf') {
      try {
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF({ unit: 'mm', format: 'a4' })
        const pageWidth = doc.internal.pageSize.getWidth()
        const margin = 16
        const lineWidth = pageWidth - margin * 2
        const lineHeight = 7

        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text(title, margin, margin + 6)

        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        let y = margin + 18

        const lines = doc.splitTextToSize(content, lineWidth) as string[]
        for (const line of lines) {
          if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage()
            y = margin
          }
          doc.text(line, margin, y)
          y += lineHeight
        }

        doc.save(`${title}.pdf`)
      } catch {
        notifications.show({ message: 'Failed to generate PDF.', color: 'red', autoClose: 3000 })
      }
    } else {
      const ext = format === 'markdown' ? 'md' : 'txt'
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [])

  // ─── File handling ───────────────────────────────────────────────────────

  /**
   * Upload a file to the coach-attachments S3 endpoint and return its
   * presigned URL + metadata.  Called for PDFs and large (>50 KB) non-image files.
   */
  const uploadToS3 = useCallback(async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const token = getAccessToken()
    const response = await fetch(`${API_CONFIG.baseURL}/support/attachments/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      body: formData,
    })
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`)
    return response.json() as Promise<{ url: string; name: string; mimeType: string; size: number }>
  }, [])

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return
      Array.from(files).forEach(async (file) => {
        const isPdf = file.type === 'application/pdf'
        // Route PDFs or large non-image files through S3 to avoid the 5 MB JSON limit
        const isLargeText = file.size > 50 * 1024 && !file.type.startsWith('image/')

        if (isPdf || isLargeText) {
          // Add a placeholder badge with uploading state
          const placeholderId = `${file.name}_${Date.now()}`
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              content: '',
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              uploading: true,
              s3Url: placeholderId,
            },
          ])
          try {
            const result = await uploadToS3(file)
            // Replace placeholder with real S3 URL
            setAttachments((prev) =>
              prev.map((att) =>
                att.s3Url === placeholderId
                  ? {
                      name: result.name,
                      content: '',
                      mimeType: result.mimeType,
                      size: result.size,
                      s3Url: result.url,
                      uploading: false,
                    }
                  : att
              )
            )
          } catch {
            // Remove placeholder on failure
            setAttachments((prev) => prev.filter((att) => att.s3Url !== placeholderId))
            notifications.show({
              message: `Failed to upload ${file.name}`,
              color: 'red',
              autoClose: 4000,
            })
          }
        } else {
          const isImage = file.type.startsWith('image/')
          const reader = new FileReader()
          reader.onload = (e) => {
            const content = (e.target?.result as string) ?? ''
            setAttachments((prev) => [
              ...prev,
              { name: file.name, content, mimeType: file.type || 'text/plain', size: file.size },
            ])
          }
          if (isImage) {
            reader.readAsDataURL(file)
          } else {
            reader.readAsText(file)
          }
        }
      })
      // Reset so the same file can be re-selected after removal
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [uploadToS3]
  )

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ─── Refs ────────────────────────────────────────────────────────────────

  const viewportRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const isDragging = useRef(false)
  const hasMoved = useRef(false)
  const dragOrigin = useRef({ px: 0, py: 0, wx: 0, wy: 0 })

  // ─── Init position ───────────────────────────────────────────────────────

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

  const onMascotPointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    if (!hasMoved.current) setOpen((v) => !v)
  }, [])

  const onHeaderPointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
  }, [])

  // ─── Panel style ─────────────────────────────────────────────────────────

  const getPanelSize = useCallback(() => {
    const width = Math.min(PANEL_W, Math.max(320, window.innerWidth - 20))
    const height = Math.min(PANEL_H, Math.max(430, window.innerHeight - 90))
    return { width, height }
  }, [])

  const getPanelStyle = useCallback(
    (p: Pos): React.CSSProperties => {
      const { width, height } = getPanelSize()
      let top = p.y - height - 14
      let left = p.x - width + BTN
      if (top < 8) top = p.y + BTN + 14
      if (left < 8) left = 8
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
      return { position: 'fixed', top, left, zIndex: 9998, width, height }
    },
    [getPanelSize]
  )

  const panelStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
        width: 'auto',
        height: 'auto',
        zIndex: 9998,
      }
    : getPanelStyle(pos ?? { x: 0, y: 0 })

  // ─── Streaming chat ───────────────────────────────────────────────────────

  const hasUploading = attachments.some((a) => a.uploading)

  const send = async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || streaming || hasUploading) return

    const userMsg: Message = {
      role: 'user',
      content: text,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    }
    const nextMessages = [...messages, userMsg]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    setAttachments([])
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
      let hasAction = false

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
              const parsed = JSON.parse(data) as { delta?: string; action?: UIAction }
              if (parsed.delta) {
                content += parsed.delta
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content }
                  return updated
                })
              }
              if (parsed.action) {
                hasAction = true
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  updated[updated.length - 1] = {
                    ...last,
                    action: parsed.action,
                    actionState: parsed.action?.selector ? 'pending' : undefined,
                  }
                  return updated
                })
              }
            } catch {
              /* malformed chunk — skip */
            }
          }
        }
      }

      if (!content && !hasAction) {
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
      void send()
    }
  }

  const handleClose = () => {
    abortRef.current?.abort()
    setOpen(false)
    setIsFullscreen(false)
  }

  const handleClear = () => {
    abortRef.current?.abort()
    setStreaming(false)
    setMessages([WELCOME])
    setAttachments([])
    setExecutionStatus(null)
  }

  // ─── Derived ─────────────────────────────────────────────────────────────

  const lastMsg = messages[messages.length - 1]
  const isLastStreaming = streaming && lastMsg?.role === 'assistant'

  if (!pos) return null

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Chat Panel ─────────────────────────────────────────────────── */}
      {open && (
        <Box style={panelStyle} className={`coach-shell ${isFullscreen ? 'is-fullscreen' : ''}`}>
          <Paper
            radius={20}
            shadow="xl"
            className="coach-panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              height: '100%',
              width: '100%',
              border: '1px solid rgba(90, 127, 201, 0.2)',
              backgroundColor: 'rgba(8, 13, 27, 0.85)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            {/* Header */}
            <Group
              px="md"
              py={10}
              justify="space-between"
              className="coach-header"
              onPointerDown={isFullscreen ? undefined : (e) => startDrag(e, pos)}
              onPointerMove={isFullscreen ? undefined : onPointerMove}
              onPointerUp={isFullscreen ? undefined : onHeaderPointerUp}
              style={{
                borderBottom: '1px solid rgba(123, 158, 224, 0.2)',
                flexShrink: 0,
                cursor: isFullscreen ? 'default' : 'grab',
                userSelect: 'none',
              }}
            >
              <Group gap={10}>
                <div className="coach-header-avatar">
                  <Image
                    src="/pitchMascotMobile.png"
                    alt="PITCH Coach"
                    width={32}
                    height={32}
                    style={{ objectFit: 'contain', marginTop: -2 }}
                  />
                </div>
                <Stack gap={0}>
                  <Text fw={800} size="sm" c="white" style={{ letterSpacing: 0.3 }}>
                    Pablo - Your PITCH Coach
                  </Text>
                </Stack>
              </Group>

              <Group gap={4} onPointerDown={(e) => e.stopPropagation()}>
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  size="sm"
                  className="coach-header-btn"
                  onClick={() => setIsFullscreen((v) => !v)}
                  aria-label={isFullscreen ? 'Restore panel' : 'Expand to fullscreen'}
                  title={isFullscreen ? 'Restore panel' : 'Expand to fullscreen'}
                >
                  {isFullscreen ? (
                    <IconArrowsMinimize size={14} />
                  ) : (
                    <IconArrowsMaximize size={14} />
                  )}
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  size="sm"
                  className="coach-header-btn"
                  onClick={handleClear}
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <IconTrash size={14} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  size="sm"
                  className="coach-header-btn"
                  onClick={handleClose}
                  aria-label="Close coach chat"
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            </Group>

            {/* Messages */}
            <ScrollArea
              flex={1}
              viewportRef={viewportRef}
              style={{ flexGrow: 1 }}
              scrollbarSize={4}
              className="coach-scroll"
            >
              <Stack gap="sm" p="md">
                {messages.map((msg, i) => {
                  const thisIsStreaming = isLastStreaming && i === messages.length - 1
                  const hideBubble = !msg.content && !thisIsStreaming && msg.role === 'assistant'
                  return (
                    <Box
                      key={i}
                      style={{
                        animation: 'coach-msg-in 420ms cubic-bezier(0.19, 1, 0.22, 1) both',
                        animationDelay: `${Math.min(i * 0.03, 0.24)}s`,
                      }}
                    >
                      <Box
                        className={`coach-message-row ${msg.role === 'user' ? 'coach-message-row-user' : 'coach-message-row-assistant'}`}
                        style={{
                          display: hideBubble ? 'none' : 'flex',
                          justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <Box
                          className={`coach-bubble ${msg.role === 'user' ? 'coach-bubble-user' : 'coach-bubble-assistant'}`}
                          style={{
                            maxWidth: '80%',
                            borderRadius: 14,
                            padding: '10px 12px',
                            minHeight: thisIsStreaming && !msg.content ? 36 : undefined,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                          }}
                        >
                          {msg.role === 'assistant' ? (
                            <div
                              style={{ fontSize: 14, color: 'white', lineHeight: 1.6 }}
                              className="coach-md"
                            >
                              {thisIsStreaming && !msg.content ? (
                                <div className="coach-typing" aria-label="Coach is typing">
                                  <span />
                                  <span />
                                  <span />
                                </div>
                              ) : (
                                <>
                                  <ReactMarkdown
                                    components={{
                                      p: ({ children }) => (
                                        <p style={{ margin: '0 0 6px 0' }}>{children}</p>
                                      ),
                                      strong: ({ children }) => (
                                        <strong style={{ fontWeight: 700, color: 'white' }}>
                                          {children}
                                        </strong>
                                      ),
                                      em: ({ children }) => (
                                        <em style={{ fontStyle: 'italic' }}>{children}</em>
                                      ),
                                      ul: ({ children }) => (
                                        <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
                                          {children}
                                        </ul>
                                      ),
                                      ol: ({ children }) => (
                                        <ol style={{ margin: '4px 0', paddingLeft: 18 }}>
                                          {children}
                                        </ol>
                                      ),
                                      li: ({ children }) => (
                                        <li style={{ marginBottom: 2 }}>{children}</li>
                                      ),
                                      code: ({ children }) => (
                                        <code
                                          style={{
                                            background: 'rgba(255,255,255,0.12)',
                                            borderRadius: 3,
                                            padding: '1px 4px',
                                            fontSize: 12,
                                          }}
                                        >
                                          {children}
                                        </code>
                                      ),
                                      a: ({ href, children }) => (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            color: 'var(--mantine-color-blue-3)',
                                            textDecoration: 'underline',
                                          }}
                                        >
                                          {children}
                                        </a>
                                      ),
                                    }}
                                  >
                                    {msg.content}
                                  </ReactMarkdown>
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
                                </>
                              )}
                            </div>
                          ) : (
                            <Text
                              size="sm"
                              c="white"
                              style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
                            >
                              {msg.content}
                            </Text>
                          )}
                          {/* Attachment chips on user messages */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <Group gap={4} mt={2}>
                              {msg.attachments.map((att, ai) => (
                                <Badge
                                  key={ai}
                                  size="xs"
                                  variant="light"
                                  color="gray"
                                  leftSection={<IconPaperclip size={9} />}
                                >
                                  {att.name}
                                </Badge>
                              ))}
                            </Group>
                          )}
                        </Box>
                      </Box>

                      {msg.action && (
                        <Box style={{ marginTop: 6 }}>
                          {/* ── Document generation card ── */}
                          {msg.action.type === 'generate_document' ? (
                            <Paper
                              radius="md"
                              p="sm"
                              style={{
                                background: 'var(--mantine-color-dark-6)',
                                border: '1px solid var(--mantine-color-blue-8)',
                                maxWidth: '85%',
                              }}
                            >
                              <Group gap={8} mb={6} align="center">
                                <IconFileText size={14} color="var(--mantine-color-blue-4)" />
                                <Text size="xs" fw={600} c="blue.4" style={{ lineHeight: 1.3 }}>
                                  {msg.action.label}
                                </Text>
                                <Badge size="xs" variant="light" color="blue">
                                  {msg.action.format ?? 'pdf'}
                                </Badge>
                              </Group>
                              <Button
                                size="xs"
                                variant="light"
                                color="blue"
                                leftSection={<IconDownload size={11} />}
                                onClick={() => void downloadDocument(msg.action!)}
                              >
                                Download
                              </Button>
                            </Paper>
                          ) : (
                            <>
                              {/* Step list preview for sequences */}
                              {msg.action.steps && msg.action.steps.length > 0 && (
                                <Stack gap={2} mb={6}>
                                  {msg.action.steps.map((step, si) => {
                                    const done = msg.completedStepIndices?.includes(si) ?? false
                                    return (
                                      <Group key={si} gap={6} align="center">
                                        {done ? (
                                          <IconCheck
                                            size={10}
                                            color="var(--mantine-color-teal-5)"
                                            style={{ flexShrink: 0 }}
                                          />
                                        ) : (
                                          <Text
                                            size="xs"
                                            c="dimmed"
                                            w={14}
                                            ta="right"
                                            style={{ flexShrink: 0 }}
                                          >
                                            {si + 1}.
                                          </Text>
                                        )}
                                        <Text
                                          size="xs"
                                          c={done ? 'dimmed' : 'gray.4'}
                                          style={
                                            done
                                              ? { textDecoration: 'line-through', opacity: 0.5 }
                                              : undefined
                                          }
                                        >
                                          {step.label}
                                        </Text>
                                      </Group>
                                    )
                                  })}
                                </Stack>
                              )}

                              {/* Permission-gated action */}
                              {requiresPermission(msg.action) ? (
                                msg.actionState === 'permitted' ? (
                                  <Group gap={6} align="center">
                                    <IconShieldCheck
                                      size={13}
                                      color="var(--mantine-color-teal-5)"
                                    />
                                    <Text size="xs" c="teal.4">
                                      Action allowed — {msg.action.label}
                                    </Text>
                                  </Group>
                                ) : msg.actionState === 'denied' ? (
                                  <Group gap={6} align="center">
                                    <IconShieldOff size={13} color="var(--mantine-color-red-5)" />
                                    <Text size="xs" c="red.4">
                                      Action declined
                                    </Text>
                                  </Group>
                                ) : (
                                  <Paper
                                    radius="md"
                                    p="sm"
                                    style={{
                                      background: 'var(--mantine-color-dark-6)',
                                      border: '1px solid var(--mantine-color-yellow-9)',
                                      maxWidth: '85%',
                                    }}
                                  >
                                    <Group gap={6} mb={6} align="flex-start">
                                      <IconAlertTriangle
                                        size={13}
                                        color="var(--mantine-color-yellow-4)"
                                        style={{ marginTop: 1, flexShrink: 0 }}
                                      />
                                      <Text
                                        size="xs"
                                        fw={600}
                                        c="yellow.4"
                                        style={{ lineHeight: 1.4 }}
                                      >
                                        Permission required
                                      </Text>
                                    </Group>
                                    <Text
                                      size="xs"
                                      c="dimmed"
                                      style={{ lineHeight: 1.5, marginBottom: 8 }}
                                    >
                                      {msg.action.reason ?? msg.action.label}
                                    </Text>
                                    <Divider mb={8} color="dark.4" />
                                    <Group gap={8}>
                                      <Button
                                        size="xs"
                                        variant="light"
                                        color="teal"
                                        leftSection={<IconShieldCheck size={11} />}
                                        onClick={() => permitAction(i)}
                                      >
                                        Allow
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="subtle"
                                        color="red"
                                        leftSection={<IconShieldOff size={11} />}
                                        onClick={() => denyAction(i)}
                                      >
                                        Deny
                                      </Button>
                                    </Group>
                                  </Paper>
                                )
                              ) : (
                                /* Trusted action — executes immediately */
                                <Box style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                  <Button
                                    size="xs"
                                    variant="light"
                                    color="blue"
                                    leftSection={<IconArrowRight size={12} />}
                                    onClick={() =>
                                      msg.action?.steps?.length
                                        ? void executeSteps(msg.action.steps, i)
                                        : executeAction(msg.action)
                                    }
                                  >
                                    {msg.action.label}
                                  </Button>
                                </Box>
                              )}
                            </>
                          )}
                        </Box>
                      )}
                    </Box>
                  )
                })}
              </Stack>
            </ScrollArea>

            {/* Execution status bar */}
            {executionStatus && (
              <Group
                px="md"
                py={6}
                gap="xs"
                className="coach-status-bar"
                style={{ borderTop: '1px solid rgba(108, 146, 218, 0.2)', flexShrink: 0 }}
              >
                <Loader size="xs" color="blue" />
                <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                  {executionStatus}
                </Text>
              </Group>
            )}

            {/* Attachment chips */}
            {attachments.length > 0 && (
              <Group px="md" pt={6} pb={2} gap="xs" wrap="wrap" style={{ flexShrink: 0 }}>
                {attachments.map((att, i) => (
                  <Badge
                    key={i}
                    size="sm"
                    variant="light"
                    color={att.uploading ? 'gray' : 'blue'}
                    leftSection={att.uploading ? <Loader size={10} color="gray" /> : undefined}
                    rightSection={
                      !att.uploading ? (
                        <ActionIcon
                          size="xs"
                          variant="transparent"
                          color="blue"
                          onClick={() => removeAttachment(i)}
                          aria-label={`Remove ${att.name}`}
                        >
                          <IconX size={10} />
                        </ActionIcon>
                      ) : undefined
                    }
                  >
                    {att.uploading ? `${att.name} (uploading…)` : att.name}
                  </Badge>
                ))}
              </Group>
            )}

            {/* Footer */}
            <Group
              px="md"
              py="sm"
              gap="xs"
              className="coach-footer"
              style={{ borderTop: '1px solid rgba(108, 146, 218, 0.2)', flexShrink: 0 }}
            >
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelect(e.currentTarget.files)}
              />
              <ActionIcon
                variant="subtle"
                color="blue"
                size="md"
                className="coach-footer-icon"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
                title="Attach a file"
                disabled={streaming}
              >
                <IconPaperclip size={16} />
              </ActionIcon>
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
                    backgroundColor: 'rgba(13, 20, 39, 0.92)',
                    border: '1px solid rgba(94, 132, 201, 0.35)',
                    color: 'white',
                    borderRadius: 14,
                    height: 38,
                    transition: 'all 180ms ease',
                  },
                }}
              />
              <ActionIcon
                variant="filled"
                color="blue"
                size="md"
                className="coach-send-btn"
                onClick={() => void send()}
                disabled={(!input.trim() && attachments.length === 0) || streaming || hasUploading}
                aria-label="Send message"
              >
                <IconSend size={14} />
              </ActionIcon>
            </Group>
          </Paper>
        </Box>
      )}

      {/* ── Screen lock overlay — blocks page interaction while AI executes ─ */}
      {executionStatus &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9997,
              cursor: 'not-allowed',
              background: 'rgba(0,0,0,0.22)',
              backdropFilter: 'blur(1.5px)',
              WebkitBackdropFilter: 'blur(1.5px)',
            }}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          />,
          document.body
        )}

      {/* ── Mascot Button ─────────────────────────────────────────────── */}
      <div
        data-tour-id="coach-chat-trigger"
        onPointerDown={(e) => startDrag(e, pos)}
        onPointerMove={onPointerMove}
        onPointerUp={onMascotPointerUp}
        className={`coach-trigger ${open ? 'is-open' : ''}`}
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
          width: BTN,
          height: BTN,
          zIndex: 9999,
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
          animation: open ? 'none' : 'coach-float 2.8s cubic-bezier(0.45,0,0.55,1) infinite',
        }}
      >
        <div className="coach-trigger-orbit" />
        <div
          className="coach-trigger-core"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 45% 30%, #2f7df2 0%, #1e3f6e 38%, #0c1b34 100%)',
            boxShadow: open
              ? `0 0 0 3px rgba(75,177,255,0.92), 0 0 0 8px rgba(76,145,255,0.26), 0 14px 44px rgba(48,122,255,0.78)`
              : `0 0 0 2.5px rgba(75,177,255,0.7), 0 0 0 6px rgba(76,145,255,0.16), 0 10px 28px rgba(43,105,255,0.52), 0 6px 16px rgba(0,0,0,0.65)`,
            transition: 'box-shadow 0.3s ease',
          }}
        />
        <Image
          src="/pitchMascotMobile.png"
          alt="PITCH Coach"
          width={IMG}
          height={IMG}
          draggable={false}
          priority
          style={{
            position: 'absolute',
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

      {/* ── Keyframes ────────────────────────────────────────────────── */}
      <style>{`
        .coach-shell {
          position: relative;
          padding: 1px;
          border-radius: 22px;
          overflow: hidden;
          box-shadow:
            0 24px 60px rgba(2, 6, 16, 0.68),
            0 0 0 1px rgba(120, 160, 240, 0.2),
            inset 0 0 0 1px rgba(140, 184, 255, 0.22);
          isolation: isolate;
        }
        .coach-shell::before {
          content: '';
          position: absolute;
          inset: -45%;
          background: conic-gradient(
            from 0deg,
            rgba(80, 177, 255, 0.15),
            rgba(42, 95, 255, 0.34),
            rgba(82, 234, 255, 0.18),
            rgba(80, 177, 255, 0.15)
          );
          animation: coach-border-spin 12s linear infinite;
          filter: blur(28px);
          z-index: 0;
          pointer-events: none;
        }
        .coach-shell.is-fullscreen {
          border-radius: 20px;
        }
        .coach-panel {
          position: relative;
          z-index: 1;
          border-radius: 20px;
          background:
            radial-gradient(circle at 0% -20%, rgba(94, 155, 255, 0.24), rgba(7, 11, 25, 0) 42%),
            radial-gradient(circle at 120% 100%, rgba(0, 186, 255, 0.18), rgba(7, 11, 25, 0) 40%),
            linear-gradient(180deg, rgba(8, 13, 27, 0.95) 0%, rgba(8, 12, 23, 0.92) 100%);
        }
        .coach-panel::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 30px 30px, 30px 30px;
          opacity: 0.28;
        }
        .coach-header {
          background: linear-gradient(120deg, rgba(45, 97, 196, 0.28), rgba(16, 34, 78, 0.16), rgba(15, 90, 160, 0.28));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .coach-header-avatar {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          overflow: hidden;
          background: radial-gradient(circle at 40% 30%, #2e7ef4 0%, #153060 56%, #0a1226 100%);
          border: 1.5px solid rgba(95, 174, 255, 0.85);
          box-shadow: 0 0 18px rgba(72, 158, 255, 0.35);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .coach-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #34e4c3;
          box-shadow: 0 0 0 rgba(52, 228, 195, 0.75);
          animation: coach-live-ping 2.2s ease-in-out infinite;
        }
        .coach-header-btn {
          transition: transform 160ms ease, background-color 180ms ease;
        }
        .coach-header-btn:hover {
          transform: translateY(-1px);
          background: rgba(80, 126, 220, 0.26);
        }
        .coach-scroll {
          position: relative;
        }
        .coach-message-row-user {
          padding-left: 28px;
        }
        .coach-message-row-assistant {
          padding-right: 28px;
        }
        .coach-bubble {
          position: relative;
          border: 1px solid transparent;
          box-shadow: 0 8px 20px rgba(2, 8, 18, 0.45);
        }
        .coach-bubble-assistant {
          background: linear-gradient(145deg, rgba(20, 37, 73, 0.92), rgba(14, 24, 48, 0.92));
          border-color: rgba(108, 153, 238, 0.25);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        .coach-bubble-user {
          background: linear-gradient(145deg, rgba(39, 112, 226, 0.95), rgba(23, 72, 170, 0.95));
          border-color: rgba(111, 187, 255, 0.5);
          box-shadow:
            0 10px 28px rgba(32, 90, 212, 0.34),
            inset 0 0 0 1px rgba(194, 227, 255, 0.15);
        }
        .coach-typing {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          min-height: 16px;
        }
        .coach-typing span {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(208, 229, 255, 0.95);
          animation: coach-typing-bounce 900ms ease-in-out infinite;
        }
        .coach-typing span:nth-child(2) {
          animation-delay: 120ms;
        }
        .coach-typing span:nth-child(3) {
          animation-delay: 240ms;
        }
        .coach-status-bar {
          background: linear-gradient(90deg, rgba(45, 97, 196, 0.12), rgba(14, 22, 45, 0.06));
        }
        .coach-footer {
          background: linear-gradient(180deg, rgba(11, 18, 36, 0.74), rgba(9, 16, 31, 0.92));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .coach-footer-icon {
          transition: transform 160ms ease, background-color 180ms ease;
        }
        .coach-footer-icon:hover {
          transform: translateY(-1px);
          background: rgba(84, 133, 232, 0.2);
        }
        .coach-send-btn {
          background: linear-gradient(140deg, #3b8bff, #1c60d8);
          box-shadow:
            0 8px 16px rgba(43, 106, 219, 0.4),
            inset 0 -1px 0 rgba(13, 45, 104, 0.45);
          transition: transform 180ms ease, box-shadow 220ms ease, filter 220ms ease;
        }
        .coach-send-btn:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow:
            0 10px 22px rgba(51, 125, 255, 0.55),
            inset 0 -1px 0 rgba(13, 45, 104, 0.45);
          filter: saturate(1.08);
        }
        .coach-trigger {
          transition: transform 220ms ease;
        }
        .coach-trigger:hover {
          transform: scale(1.04);
        }
        .coach-trigger-orbit {
          position: absolute;
          inset: -9px;
          border-radius: 999px;
          background: conic-gradient(
            from 0deg,
            rgba(95, 182, 255, 0),
            rgba(95, 182, 255, 0.62),
            rgba(44, 104, 255, 0),
            rgba(95, 182, 255, 0)
          );
          filter: blur(1.2px);
          animation: coach-orbit-spin 5.4s linear infinite;
          pointer-events: none;
        }
        .coach-trigger.is-open .coach-trigger-orbit {
          opacity: 0.85;
        }
        .coach-trigger-core {
          transition: transform 220ms ease;
        }
        .coach-trigger:hover .coach-trigger-core {
          transform: scale(1.03);
        }
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
        @keyframes coach-msg-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes coach-live-ping {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(52, 228, 195, 0.7);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(52, 228, 195, 0);
            transform: scale(1.05);
          }
        }
        @keyframes coach-border-spin {
          to { transform: rotate(1turn); }
        }
        @keyframes coach-orbit-spin {
          to { transform: rotate(1turn); }
        }
        @keyframes coach-typing-bounce {
          0%, 70%, 100% {
            transform: translateY(0);
            opacity: 0.55;
          }
          35% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
        @keyframes coach-highlight-ring {
          0%   { box-shadow: 0 0 0 0px rgba(34,139,230,0.9),  0 0 0 0px rgba(34,139,230,0.4); }
          30%  { box-shadow: 0 0 0 6px rgba(34,139,230,0.8),  0 0 0 14px rgba(34,139,230,0.25); }
          60%  { box-shadow: 0 0 0 4px rgba(34,139,230,0.6),  0 0 0 10px rgba(34,139,230,0.15); }
          100% { box-shadow: 0 0 0 0px rgba(34,139,230,0.0),  0 0 0 0px rgba(34,139,230,0.0); }
        }
        .coach-action-highlight {
          animation: coach-highlight-ring 2.5s ease-out forwards !important;
          border-radius: 8px;
          position: relative;
          z-index: 100;
        }
        @media (max-width: 720px) {
          .coach-shell {
            border-radius: 18px;
          }
          .coach-panel {
            border-radius: 18px;
          }
          .coach-message-row-user,
          .coach-message-row-assistant {
            padding-left: 0;
            padding-right: 0;
          }
          .coach-bubble {
            max-width: 90% !important;
          }
        }
      `}</style>
    </>
  )
}
