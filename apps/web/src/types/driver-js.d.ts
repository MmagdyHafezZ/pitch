declare module 'driver.js' {
  export type DriveStep = {
    element?: string
    popover?: {
      title?: string
      description?: string
      side?: 'left' | 'right' | 'top' | 'bottom'
      align?: 'start' | 'center' | 'end'
    }
  }

  export type DriverInstance = {
    destroy: () => void
    drive: () => void
    moveNext: () => void
    isLastStep: () => boolean
  }

  export type DriverHookContext = {
    driver: DriverInstance
  }

  export type DriverConfig = {
    animate?: boolean
    showProgress?: boolean
    showButtons?: string[]
    allowClose?: boolean
    steps?: DriveStep[]
    onCloseClick?: (
      element: Element | null,
      step: DriveStep,
      context: DriverHookContext
    ) => void
    onNextClick?: (
      element: Element | null,
      step: DriveStep,
      context: DriverHookContext
    ) => void
  }

  export function driver(config?: DriverConfig): DriverInstance
}
