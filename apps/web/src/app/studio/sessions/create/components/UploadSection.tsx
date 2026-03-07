'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import {
  IconAlertCircle,
  IconCheck,
  IconFile,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import {
  BLOCKED_EXTENSIONS,
  MAX_FILE_SIZE_MB,
  MAX_FILES_PER_SESSION,
} from '@/features/sessions/constants/upload.constants'
import type { SessionAttachment } from '@/features/sessions/types/sessions.types'
import { api } from '@/lib/client'
import classes from '../create-session.module.css'

type PendingFile = {
  file: File
  status: 'idle' | 'uploading' | 'uploaded' | 'error'
  error?: string
  attachment?: SessionAttachment
}

interface UploadSectionProps {
  sessionDraftId?: string
  onAttachmentsChange: (attachments: SessionAttachment[]) => void
  onUploadingChange?: (isUploading: boolean) => void
  onHasErrorsChange?: (hasErrors: boolean) => void
}

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const PRESIGN_UPLOAD_EXPIRY_SECONDS = 300
const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET?.trim() ?? ''
const BLOCKED_EXTENSIONS_TEXT = BLOCKED_EXTENSIONS.join(', ')

const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

const getFileExtension = (filename: string) => {
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex < 0) {
    return ''
  }

  return filename.slice(lastDotIndex).toLowerCase()
}

const validateFile = (file: File) => {
  if (file.size === 0) {
    return 'Empty files cannot be added.'
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Files must be ${MAX_FILE_SIZE_MB} MB or smaller.`
  }

  const extension = getFileExtension(file.name)
  if (extension && BLOCKED_EXTENSIONS.includes(extension as (typeof BLOCKED_EXTENSIONS)[number])) {
    return `Files with the ${extension} extension are not allowed.`
  }

  return undefined
}

const getStatusColor = (status: PendingFile['status']) => {
  switch (status) {
    case 'uploaded':
      return 'green'
    case 'uploading':
      return 'blue'
    case 'error':
      return 'red'
    case 'idle':
    default:
      return 'gray'
  }
}

const sanitizeFilename = (filename: string) => {
  const sanitized = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')

  return sanitized || 'file'
}

const createTempDraftId = () => {
  const randomUuid = globalThis.crypto?.randomUUID?.()
  if (randomUuid) {
    return randomUuid
  }

  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function UploadSection({
  sessionDraftId,
  onAttachmentsChange,
  onUploadingChange,
  onHasErrorsChange,
}: UploadSectionProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const tempDraftIdRef = useRef(createTempDraftId())
  const effectiveSessionDraftId = useMemo(
    () => (sessionDraftId?.trim() ? sessionDraftId : tempDraftIdRef.current),
    [sessionDraftId]
  )
  const isUploading = pendingFiles.some((item) => item.status === 'uploading')
  const hasErrors = pendingFiles.some((item) => item.status === 'error')

  useEffect(() => {
    const uploadedAttachments = pendingFiles.flatMap((item) =>
      item.status === 'uploaded' && item.attachment ? [item.attachment] : []
    )
    onAttachmentsChange(uploadedAttachments)
  }, [onAttachmentsChange, pendingFiles])

  useEffect(() => {
    onUploadingChange?.(isUploading)
  }, [isUploading, onUploadingChange])

  useEffect(() => {
    onHasErrorsChange?.(hasErrors)
  }, [hasErrors, onHasErrorsChange])

  const updatePendingFile = (file: File, patch: Partial<PendingFile>) => {
    setPendingFiles((current) =>
      current.map((item) => (item.file === file ? { ...item, ...patch } : item))
    )
  }

  const uploadFile = async (file: File) => {
    if (!DEFAULT_BUCKET) {
      updatePendingFile(file, {
        status: 'error',
        error: 'Storage bucket is not configured.',
      })
      return
    }

    updatePendingFile(file, { status: 'uploading', error: undefined })

    const timestamp = Date.now()
    const key = `sessions/${effectiveSessionDraftId}/${timestamp}-${sanitizeFilename(file.name)}`

    try {
      const { url } = await api.s3.presignUpload({
        bucket: DEFAULT_BUCKET,
        key,
        expiresIn: PRESIGN_UPLOAD_EXPIRY_SECONDS,
      })

      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`)
      }

      const attachment: SessionAttachment = {
        bucket: DEFAULT_BUCKET,
        key,
        filename: file.name,
        contentType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      }

      updatePendingFile(file, {
        status: 'uploaded',
        attachment,
        error: undefined,
      })
    } catch (error) {
      updatePendingFile(file, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed',
      })
    }
  }

  const handleFilesAdded = async (files: File[]) => {
    const validFilesToUpload: File[] = []
    const acceptedCount = pendingFiles.filter((item) => item.status !== 'error').length
    let remainingSlots = Math.max(0, MAX_FILES_PER_SESSION - acceptedCount)

    const nextFiles = files.map<PendingFile>((file) => {
      if (remainingSlots <= 0) {
        return {
          file,
          status: 'error',
          error: `You can add up to ${MAX_FILES_PER_SESSION} files per session.`,
        }
      }

      const validationError = validateFile(file)
      if (validationError) {
        return {
          file,
          status: 'error',
          error: validationError,
        }
      }

      remainingSlots -= 1
      validFilesToUpload.push(file)
      return {
        file,
        status: 'idle',
      }
    })

    setPendingFiles((current) => [...current, ...nextFiles])

    for (const file of validFilesToUpload) {
      await uploadFile(file)
    }
  }

  const handleRemove = (index: number) => {
    setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <Stack gap="lg">
      <Group align="center" gap="sm">
        <Box className={classes.stepIcon}>
          <IconUpload size={22} />
        </Box>
        <Box>
          <Title order={3}>Files & Context</Title>
          <Text size="sm" c="dimmed">
            Add supporting documents to enrich the session context.
          </Text>
        </Box>
      </Group>

      <Paper withBorder p="md" radius="lg" className={classes.uploadCard}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Box>
              <Text fw={600}>Upload reference files</Text>
              <Text size="sm" c="dimmed">
                Drag files here or click to choose up to {MAX_FILES_PER_SESSION} files.
              </Text>
            </Box>
            <Badge size="xs" variant="light" color="blue">
              Max {MAX_FILE_SIZE_MB} MB each
            </Badge>
          </Group>

          <Dropzone
            onDrop={handleFilesAdded}
            multiple
            activateOnClick
            activateOnDrag
            disabled={isUploading}
            className={classes.uploadDropzone}
          >
            <Stack gap="xs" align="center">
              <ThemeIcon size={52} radius="xl" color="blue" variant="light">
                <IconUpload size={24} />
              </ThemeIcon>
              <Text fw={600}>Drop files here or click to browse</Text>
              <Text size="sm" c="dimmed" ta="center">
                Max {MAX_FILE_SIZE_MB} MB per file.
              </Text>
            </Stack>
          </Dropzone>

          <Stack gap="xs">
            {pendingFiles.length === 0 ? (
              <Paper withBorder radius="md" p="md" className={classes.uploadEmptyState}>
                <Text size="sm" c="dimmed">
                  No files selected yet.
                </Text>
              </Paper>
            ) : (
              pendingFiles.map((item, index) => (
                <Paper withBorder radius="md" p="md" key={`${item.file.name}-${item.file.size}-${index}`}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Group gap="sm" align="flex-start" wrap="nowrap">
                      <ThemeIcon size="lg" radius="md" variant="light" color="gray">
                        {item.status === 'error' ? (
                          <IconAlertCircle size={18} />
                        ) : item.status === 'uploaded' ? (
                          <IconCheck size={18} />
                        ) : (
                          <IconFile size={18} />
                        )}
                      </ThemeIcon>
                      <Stack gap={4}>
                        <Text fw={600} className={classes.uploadFileName}>
                          {item.file.name}
                        </Text>
                        <Group gap="xs">
                          <Text size="sm" c="dimmed">
                            {formatFileSize(item.file.size)}
                          </Text>
                          <Badge
                            size="sm"
                            variant={item.status === 'error' ? 'filled' : 'light'}
                            color={getStatusColor(item.status)}
                          >
                            {item.status}
                          </Badge>
                        </Group>
                        {item.error ? (
                          <Text size="xs" c="red">
                            {item.error}
                          </Text>
                        ) : null}
                      </Stack>
                    </Group>

                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Remove ${item.file.name}`}
                      disabled={item.status === 'uploading'}
                      onClick={() => handleRemove(index)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))
            )}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  )
}
