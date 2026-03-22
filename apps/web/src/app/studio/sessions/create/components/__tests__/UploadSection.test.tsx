/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

const uploadMock = jest.fn()

jest.mock('@mantine/dropzone', () => ({
  Dropzone: ({
    onDrop,
    disabled,
    accept,
    children,
  }: {
    onDrop: (files: File[]) => void
    disabled?: boolean
    accept?: string[]
    children: ReactNode
  }) => (
    <div>
      <input
        data-testid="dropzone-input"
        type="file"
        multiple
        disabled={disabled}
        data-accept={accept?.join(',')}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          onDrop(files)
        }}
      />
      {children}
    </div>
  ),
}))

jest.mock('@/lib/client', () => ({
  api: {
    s3: {
      upload: (...args: unknown[]) => uploadMock(...args),
    },
  },
}))

describe('UploadSection', () => {
  beforeEach(() => {
    uploadMock.mockReset()
  })

  const renderUploadSection = async (onAttachmentsChange: jest.Mock = jest.fn()) => {
    const { UploadSection } = await import('../UploadSection')
    return render(<UploadSection onAttachmentsChange={onAttachmentsChange} />)
  }

  const uploadFile = async (file: File) => {
    const user = userEvent.setup()
    await renderUploadSection()
    const input = screen.getByTestId('dropzone-input') as HTMLInputElement
    await user.upload(input, file)
  }

  it('rejects blocked extensions client-side and skips upload calls', async () => {
    const blocked = new File(['echo'], 'dangerous.exe', {
      type: 'application/x-msdownload',
    })

    await uploadFile(blocked)

    await waitFor(() => {
      expect(screen.getByText(/extension are not allowed/i)).toBeInTheDocument()
    })
    expect(uploadMock).not.toHaveBeenCalled()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('shows supported file formats in the upload UI', async () => {
    await renderUploadSection()

    expect(screen.getByText(/supported:/i)).toHaveTextContent('Word (.doc, .docx)')
    expect(screen.getByText('Excel (.xls, .xlsx, .csv, .tsv)')).toBeInTheDocument()
    expect(screen.getByText('PowerPoint (.ppt, .pptx)')).toBeInTheDocument()
  })

  it('rejects unsupported file types client-side and skips upload calls', async () => {
    const unsupported = new File(['zip'], 'archive.zip', {
      type: 'application/zip',
    })

    await uploadFile(unsupported)

    await waitFor(() => {
      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument()
    })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('uploads successfully and emits attachment metadata', async () => {
    uploadMock.mockResolvedValueOnce({
      bucket: 'resolved-bucket',
      key: 'sessions/session-id/proposal.pdf',
      filename: 'proposal.pdf',
      contentType: 'application/pdf',
      size: 5,
      uploadedAt: '2026-03-21T00:00:00.000Z',
      textPreview: 'Customer requirements and next steps.',
    })

    const onAttachmentsChange = jest.fn()
    const file = new File(['hello'], 'proposal.pdf', {
      type: 'application/pdf',
    })
    const user = userEvent.setup()
    await renderUploadSection(onAttachmentsChange)
    const input = screen.getByTestId('dropzone-input') as HTMLInputElement

    await user.upload(input, file)

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledTimes(1)
      expect(screen.getByText('uploaded')).toBeInTheDocument()
    })

    expect(uploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
      })
    )
    expect(uploadMock.mock.calls[0]?.[0]?.key).toMatch(/^sessions\/.+\/\d+-proposal\.pdf$/)

    await waitFor(() => {
      expect(onAttachmentsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({
          bucket: 'resolved-bucket',
          filename: 'proposal.pdf',
          contentType: 'application/pdf',
          size: file.size,
          textPreview: 'Customer requirements and next steps.',
        }),
      ])
    })
  })

  it('sets error status when upload fails', async () => {
    uploadMock.mockRejectedValueOnce(new Error('upload failed'))
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' })

    await uploadFile(file)

    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument()
    })
    expect(screen.getByText('error')).toBeInTheDocument()
  })
})
