'use client'

import { useState } from 'react'
import type { CreateTeamInput } from '../types/teams.types'
import { useTeamsStore } from '../stores/teams.store'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CreateTeamFormValues = {
  name: string
  slug: string
  billingEmail: string
  street: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
}

export type CreateTeamErrors = Partial<Record<keyof CreateTeamFormValues, string>>

export function useCreateTeamForm() {
  const createTeam = useTeamsStore((s) => s.createTeam)
  const storeError = useTeamsStore((s) => s.error)
  const storeLoading = useTeamsStore((s) => s.loading)

  const [values, setValues] = useState<CreateTeamFormValues>({
    name: '',
    slug: '',
    billingEmail: '',
    street: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
  })

  const [errors, setErrors] = useState<CreateTeamErrors>({})
  const [localError, setLocalError] = useState<string | null>(null)

  const setField = <K extends keyof CreateTeamFormValues>(
    field: K,
    value: CreateTeamFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setLocalError(null)
  }

  const validate = (v: CreateTeamFormValues): CreateTeamErrors => {
    const next: CreateTeamErrors = {}

    const name = v.name.trim()
    if (name.length < 2 || name.length > 64) {
      next.name = 'Team name must be between 2 and 64 characters'
    }

    const slug = v.slug.trim()
    if (slug && !slugRegex.test(slug)) {
      next.slug = 'Slug must be lowercase letters/numbers with "-" separators'
    }

    const email = v.billingEmail.trim()
    if (email && !emailRegex.test(email)) {
      next.billingEmail = 'Invalid email address'
    }

    const hasAddress = v.street || v.city || v.stateProvince || v.postalCode || v.country

    if (hasAddress) {
      if (!v.street) next.street = 'Street is required when address is provided'
      if (!v.city) next.city = 'City is required when address is provided'
      if (!v.stateProvince)
        next.stateProvince = 'State / province is required when address is provided'
      if (!v.postalCode) next.postalCode = 'Postal code is required when address is provided'
      if (!v.country) next.country = 'Country is required when address is provided'
    }

    return next
  }

  const buildPayload = (v: CreateTeamFormValues): CreateTeamInput => {
    const hasAddress = v.street || v.city || v.stateProvince || v.postalCode || v.country

    return {
      name: v.name.trim(),
      slug: v.slug.trim() || undefined,
      isActive: true,
      billingEmail: v.billingEmail.trim() || undefined,
      billingAddress: hasAddress
        ? {
            street: v.street,
            city: v.city,
            stateProvince: v.stateProvince,
            postalCode: v.postalCode,
            country: v.country,
          }
        : undefined,
    }
  }

  const submit = async (): Promise<boolean> => {
    const validationErrors = validate(values)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return false
    }

    try {
      const payload = buildPayload(values)
      await createTeam(payload)
      return true
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create team')
      return false
    }
  }

  return {
    values,
    errors,
    setField,
    submit,
    submitting: storeLoading,
    apiError: localError ?? storeError,
  }
}
