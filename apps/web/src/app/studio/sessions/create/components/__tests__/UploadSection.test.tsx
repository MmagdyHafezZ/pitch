/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

const presignUploadMock = jest.fn()

jest.mock('@mantine/dropzone', () => ({
  Dropzone: ({
    onDrop,
    disabled,
    children,
  }: {
    onDrop: (files: File[]) => void
    disabled?: boolean
    children: ReactNode
  }) => (
    <div>
      <input
        data-testid="dropzone-input"
        type="file"
        multiple
        disabled={disabled}
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
      presignUpload: (...args: unknown[]) => presignUploadMock(...args),
    },
  },
}))

describe('UploadSection', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.NEXT_PUBLIC_STORAGE_BUCKET = 'test-bucket'
    presignUploadMock.mockReset()
    global.fetch = jest.fn() as unknown as typeof fetch
  })

  afterAll(() => {
    global.fetch = originalFetch
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
    expect(presignUploadMock).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('uploads successfully and emits attachment metadata', async () => {
    presignUploadMock.mockResolvedValueOnce({ url: 'https://upload.test/presigned' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
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
      expect(presignUploadMock).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(screen.getByText('uploaded')).toBeInTheDocument()
    })

    expect(presignUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'test-bucket',
        expiresIn: 300,
      })
    )
    expect(presignUploadMock.mock.calls[0]?.[0]?.key).toMatch(
      /^sessions\/.+\/\d+-proposal\.pdf$/
    )
    expect(global.fetch).toHaveBeenCalledWith(
      'https://upload.test/presigned',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      })
    )

    await waitFor(() => {
      expect(onAttachmentsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({
          bucket: 'test-bucket',
          filename: 'proposal.pdf',
          contentType: 'application/pdf',
          size: file.size,
        }),
      ])
    })
  })

  it('sets error status when presign upload fails', async () => {
    presignUploadMock.mockRejectedValueOnce(new Error('presign failed'))
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' })

    await uploadFile(file)

    await waitFor(() => {
      expect(screen.getByText(/presign failed/i)).toBeInTheDocument()
    })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('sets error status when PUT upload fails', async () => {
    presignUploadMock.mockResolvedValueOnce({ url: 'https://upload.test/presigned' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
    })
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' })

    await uploadFile(file)

    await waitFor(() => {
      expect(screen.getByText(/upload failed with status 403/i)).toBeInTheDocument()
    })
    expect(screen.getByText('error')).toBeInTheDocument()
  })
})
