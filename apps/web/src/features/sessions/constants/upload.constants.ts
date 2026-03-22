export const MAX_FILE_SIZE_MB = 25
export const MAX_FILES_PER_SESSION = 10
export const BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.ps1',
  '.js',
  '.html',
  '.svg',
  '.sh',
  '.msi',
  '.dll',
] as const

export const ALLOWED_UPLOAD_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.tsv',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.xml',
  '.rtf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
] as const

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/tab-separated-values',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/xml',
  'text/xml',
  'application/rtf',
  'text/rtf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export const ALLOWED_UPLOAD_TYPE_LABELS = [
  'PDF',
  'Word (.doc, .docx)',
  'Excel (.xls, .xlsx, .csv, .tsv)',
  'PowerPoint (.ppt, .pptx)',
  'Text (.txt, .md, .json, .xml, .rtf)',
  'Images (.png, .jpg, .jpeg, .webp)',
] as const

export const ALLOWED_UPLOAD_TYPES_TEXT = ALLOWED_UPLOAD_TYPE_LABELS.join(', ')

export const ALLOWED_UPLOAD_ACCEPT = [...ALLOWED_UPLOAD_EXTENSIONS, ...ALLOWED_UPLOAD_MIME_TYPES]

const normalizeMimeType = (mimeType: string | undefined) =>
  mimeType?.toLowerCase().split(';', 1)[0]?.trim() ?? ''

const getFileExtension = (filename: string) => {
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex >= 0 ? filename.slice(lastDotIndex).toLowerCase() : ''
}

export const isSupportedUploadFile = (input: { filename: string; mimeType?: string }) => {
  const extension = getFileExtension(input.filename)
  if (extension && BLOCKED_EXTENSIONS.includes(extension as (typeof BLOCKED_EXTENSIONS)[number])) {
    return false
  }

  const normalizedMimeType = normalizeMimeType(input.mimeType)
  return (
    ALLOWED_UPLOAD_EXTENSIONS.includes(extension as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number]) ||
    ALLOWED_UPLOAD_MIME_TYPES.includes(
      normalizedMimeType as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]
    )
  )
}
