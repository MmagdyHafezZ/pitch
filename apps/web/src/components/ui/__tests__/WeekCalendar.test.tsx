/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import dayjs from 'dayjs'
import { WeekCalendar } from '../WeekCalendar'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>
}

const renderCalendar = (value: Date | null = new Date(), onChange = jest.fn()) =>
  render(<WeekCalendar value={value} onChange={onChange} />, { wrapper: Wrapper })

describe('WeekCalendar', () => {
  it('renders all 7 weekday labels', () => {
    renderCalendar()
    for (const label of ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('renders 7 day numbers', () => {
    const date = new Date(2025, 5, 11) // Wed Jun 11, 2025
    renderCalendar(date)
    const weekStart = dayjs(date).startOf('week').add(1, 'day') // Monday
    for (let i = 0; i < 7; i++) {
      const dayNum = weekStart.add(i, 'day').format('D')
      expect(screen.getByText(dayNum)).toBeInTheDocument()
    }
  })

  it('displays the month and year header', () => {
    const date = new Date(2025, 5, 11) // Jun 2025
    renderCalendar(date)
    expect(screen.getByText('June 2025')).toBeInTheDocument()
  })

  it('calls onChange when a day is clicked', () => {
    const onChange = jest.fn()
    const date = new Date(2025, 5, 11)
    renderCalendar(date, onChange)
    const weekStart = dayjs(date).startOf('week').add(1, 'day')
    const firstDayNum = weekStart.format('D')
    fireEvent.click(screen.getByText(firstDayNum))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(expect.any(Date))
  })

  it('navigates to previous week', () => {
    const date = new Date(2025, 5, 11)
    renderCalendar(date)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    const prevWeekStart = dayjs(date).subtract(7, 'day').startOf('week').add(1, 'day')
    expect(screen.getByText(prevWeekStart.format('MMMM YYYY'))).toBeInTheDocument()
  })

  it('navigates to next week', () => {
    const date = new Date(2025, 5, 11)
    renderCalendar(date)
    const buttons = screen.getAllByRole('button')
    const nextButton = buttons[buttons.length - 1]
    fireEvent.click(nextButton)
    const nextWeekStart = dayjs(date).add(7, 'day').startOf('week').add(1, 'day')
    expect(screen.getByText(nextWeekStart.format('MMMM YYYY'))).toBeInTheDocument()
  })

  it('renders with null value (defaults to today)', () => {
    renderCalendar(null)
    const today = dayjs()
    expect(screen.getByText(today.format('D'))).toBeInTheDocument()
  })
})
