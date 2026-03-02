'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import type { TtsProvider } from '@/features/tts'
import type { Persona, PersonaTraits } from '../lib/types'
import classes from '../create-session.module.css'

const personaTextPattern = /^[a-zA-Z0-9 ,.'&/+-]+$/

const levelOptions = ['Associate', 'Senior', 'Lead', 'Director', 'VP', 'Executive']
const archetypeOptions = [
  'Buyer',
  'Champion',
  'Economic Decision Maker',
  'Technical Gatekeeper',
  'Legal Reviewer',
  'Operations Leader',
]
const communicationOptions = ['Direct', 'Consultative', 'Analytical', 'Warm', 'Skeptical']
const languageOptions = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
]
const signatureTraitOptions = [
  'Asks for proof',
  'Pushes on ROI',
  'Demands specifics',
  'Interrupts long answers',
  'Needs implementation detail',
  'Wants next steps fast',
  'Challenges vague claims',
  'Sensitive to legal risk',
  'Tests confidence',
  'Looks for executive alignment',
]

const buildDefaultState = (providers: TtsProvider[]) => {
  const provider = providers[0]
  return {
    name: '',
    role: '',
    level: 'Senior',
    archetype: 'Buyer',
    tone: 'Professional',
    personality: '',
    background: '',
    patience: 'Medium',
    communicationStyle: 'Direct',
    provider: provider?.name ?? '',
    model: provider?.models?.[0] ?? '',
    voice: provider?.voices?.[0] ?? '',
    language: 'en-US',
    signatureTraits: ['Asks for proof'],
    pacing: 60,
    empathy: 50,
    assertiveness: 55,
  }
}

interface CreatePersonaModalProps {
  opened: boolean
  onClose: () => void
  onCreatePersona: (input: { name: string; traits: PersonaTraits }) => Promise<Persona>
  ttsProviders: TtsProvider[]
  createDisabledReason?: string | null
}

export function CreatePersonaModal({
  opened,
  onClose,
  onCreatePersona,
  ttsProviders,
  createDisabledReason,
}: CreatePersonaModalProps) {
  const [form, setForm] = useState(() => buildDefaultState(ttsProviders))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const selectedProvider = useMemo(
    () => ttsProviders.find((provider) => provider.name === form.provider) ?? null,
    [form.provider, ttsProviders]
  )

  useEffect(() => {
    if (!opened) {
      return
    }

    setErrors({})
    setForm((current) => {
      if (ttsProviders.length === 0) {
        return current
      }

      const provider =
        ttsProviders.find((entry) => entry.name === current.provider) ?? ttsProviders[0]
      return {
        ...current,
        provider: provider?.name ?? '',
        model: provider?.models?.includes(current.model)
          ? current.model
          : (provider?.models?.[0] ?? ''),
        voice: provider?.voices?.includes(current.voice)
          ? current.voice
          : (provider?.voices?.[0] ?? ''),
      }
    })
  }, [opened, ttsProviders])

  useEffect(() => {
    if (!selectedProvider) {
      return
    }

    setForm((current) => ({
      ...current,
      model: selectedProvider.models?.includes(current.model)
        ? current.model
        : (selectedProvider.models?.[0] ?? ''),
      voice: selectedProvider.voices.includes(current.voice)
        ? current.voice
        : (selectedProvider.voices[0] ?? ''),
    }))
  }, [selectedProvider])

  const updateField = <T extends keyof typeof form>(field: T, value: (typeof form)[T]) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) {
        return current
      }

      const { [field]: _removed, ...rest } = current
      return rest
    })
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}

    const normalizedName = form.name.trim()
    if (normalizedName.length < 3 || normalizedName.length > 80) {
      nextErrors.name = 'Persona name must be between 3 and 80 characters.'
    } else if (!personaTextPattern.test(normalizedName)) {
      nextErrors.name = 'Use letters, numbers, spaces, and simple punctuation only.'
    }

    const normalizedRole = form.role.trim()
    if (normalizedRole.length < 3 || normalizedRole.length > 80) {
      nextErrors.role = 'Role must be between 3 and 80 characters.'
    } else if (!personaTextPattern.test(normalizedRole)) {
      nextErrors.role = 'Role contains unsupported characters.'
    }

    if (form.personality.trim().length < 12 || form.personality.trim().length > 240) {
      nextErrors.personality = 'Personality should be between 12 and 240 characters.'
    }

    if (form.background.trim().length < 12 || form.background.trim().length > 320) {
      nextErrors.background = 'Background should be between 12 and 320 characters.'
    }

    if (!selectedProvider) {
      nextErrors.provider = 'Choose a voice provider.'
    } else {
      if (!selectedProvider.voices.includes(form.voice)) {
        nextErrors.voice = 'Choose a valid voice for the selected provider.'
      }

      if (
        (selectedProvider.models?.length ?? 0) > 0 &&
        !selectedProvider.models?.includes(form.model)
      ) {
        nextErrors.model = 'Choose a valid model for the selected provider.'
      }
    }

    if (form.signatureTraits.length < 1 || form.signatureTraits.length > 4) {
      nextErrors.signatureTraits = 'Pick between 1 and 4 signature traits.'
    }

    for (const [field, value] of [
      ['pacing', form.pacing],
      ['empathy', form.empathy],
      ['assertiveness', form.assertiveness],
    ] as const) {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        nextErrors[field] = 'Use a value between 0 and 100.'
      }
    }

    if (createDisabledReason) {
      nextErrors.submit = createDisabledReason
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      return
    }

    if (!selectedProvider) {
      return
    }

    setSubmitting(true)
    try {
      const providerLabel = selectedProvider.description || selectedProvider.name
      await onCreatePersona({
        name: form.name.trim(),
        traits: {
          role: form.role.trim(),
          level: form.level,
          archetype: form.archetype,
          tone: form.tone,
          personality: form.personality.trim(),
          background: form.background.trim(),
          patience: form.patience,
          communicationStyle: form.communicationStyle,
          rarity: 'Custom',
          voiceProfile: `${providerLabel} / ${form.voice}`,
          voice: {
            provider: form.provider,
            voiceName: form.voice,
            language: form.language,
            ...(form.model ? { model: form.model } : {}),
          },
          signatureTraits: form.signatureTraits,
          metrics: {
            pacing: Math.round(form.pacing),
            empathy: Math.round(form.empathy),
            assertiveness: Math.round(form.assertiveness),
          },
        },
      })
      setForm(buildDefaultState(ttsProviders))
      setErrors({})
      onClose()
    } catch (error) {
      setErrors((current) => ({
        ...current,
        submit: error instanceof Error ? error.message : 'Failed to create persona.',
      }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Persona Here"
      size="xl"
      centered
      overlayProps={{ opacity: 0.55, blur: 4 }}
    >
      <Stack gap="lg">
        {createDisabledReason && (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
            {createDisabledReason}
          </Alert>
        )}

        <Paper withBorder radius="lg" p="md" className={classes.personaComposerSection}>
          <Stack gap="md">
            <Text fw={600}>Identity</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="Persona name"
                placeholder="Arden - Skeptical CTO"
                value={form.name}
                onChange={(event) => updateField('name', event.currentTarget.value)}
                error={errors.name}
                required
              />
              <TextInput
                label="Role"
                placeholder="Chief Technology Officer"
                value={form.role}
                onChange={(event) => updateField('role', event.currentTarget.value)}
                error={errors.role}
                required
              />
              <Select
                label="Seniority"
                data={levelOptions}
                value={form.level}
                onChange={(value) => updateField('level', value || 'Senior')}
                allowDeselect={false}
              />
              <Select
                label="Archetype"
                data={archetypeOptions}
                value={form.archetype}
                onChange={(value) => updateField('archetype', value || 'Buyer')}
                allowDeselect={false}
              />
            </SimpleGrid>
          </Stack>
        </Paper>

        <Paper withBorder radius="lg" p="md" className={classes.personaComposerSection}>
          <Stack gap="md">
            <Text fw={600}>Character</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="Tone"
                data={['Formal', 'Professional', 'Friendly', 'Casual', 'Rude Karen']}
                value={form.tone}
                onChange={(value) => updateField('tone', value || 'Professional')}
                allowDeselect={false}
              />
              <Select
                label="Communication style"
                data={communicationOptions}
                value={form.communicationStyle}
                onChange={(value) => updateField('communicationStyle', value || 'Direct')}
                allowDeselect={false}
              />
              <Select
                label="Patience"
                data={['Low', 'Medium', 'High']}
                value={form.patience}
                onChange={(value) => updateField('patience', value || 'Medium')}
                allowDeselect={false}
              />
              <Select
                label="Language"
                data={languageOptions}
                value={form.language}
                onChange={(value) => updateField('language', value || 'en-US')}
                allowDeselect={false}
              />
            </SimpleGrid>
            <Textarea
              label="Personality"
              description="How this persona behaves under pressure."
              minRows={3}
              value={form.personality}
              onChange={(event) => updateField('personality', event.currentTarget.value)}
              error={errors.personality}
              required
            />
            <Textarea
              label="Background"
              description="Context that gives the persona a believable point of view."
              minRows={3}
              value={form.background}
              onChange={(event) => updateField('background', event.currentTarget.value)}
              error={errors.background}
              required
            />
            <MultiSelect
              label="Signature traits"
              description="Choose up to four behaviors the learner should feel."
              data={signatureTraitOptions}
              value={form.signatureTraits}
              onChange={(value) => updateField('signatureTraits', value.slice(0, 4))}
              maxValues={4}
              searchable
              error={errors.signatureTraits}
            />
          </Stack>
        </Paper>

        <Paper withBorder radius="lg" p="md" className={classes.personaComposerSection}>
          <Stack gap="md">
            <Text fw={600}>Voice</Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <Select
                label="Provider"
                data={ttsProviders.map((provider) => ({
                  value: provider.name,
                  label: provider.description || provider.name,
                }))}
                value={form.provider}
                onChange={(value) => updateField('provider', value || '')}
                allowDeselect={false}
                error={errors.provider}
                required
              />
              <Select
                label="Model"
                data={(selectedProvider?.models ?? []).map((model) => ({
                  value: model,
                  label: model,
                }))}
                value={form.model}
                onChange={(value) => updateField('model', value || '')}
                disabled={(selectedProvider?.models?.length ?? 0) === 0}
                placeholder={
                  (selectedProvider?.models?.length ?? 0) > 0 ? 'Select model' : 'Default model'
                }
                error={errors.model}
              />
              <Select
                label="Voice"
                data={(selectedProvider?.voices ?? []).map((voice) => ({
                  value: voice,
                  label: voice,
                }))}
                value={form.voice}
                onChange={(value) => updateField('voice', value || '')}
                allowDeselect={false}
                error={errors.voice}
                required
              />
            </SimpleGrid>
          </Stack>
        </Paper>

        <Paper withBorder radius="lg" p="md" className={classes.personaComposerSection}>
          <Stack gap="md">
            <Text fw={600}>Metrics</Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <NumberInput
                label="Pacing"
                min={0}
                max={100}
                value={form.pacing}
                onChange={(value) => updateField('pacing', Number(value) || 0)}
                error={errors.pacing}
              />
              <NumberInput
                label="Empathy"
                min={0}
                max={100}
                value={form.empathy}
                onChange={(value) => updateField('empathy', Number(value) || 0)}
                error={errors.empathy}
              />
              <NumberInput
                label="Assertiveness"
                min={0}
                max={100}
                value={form.assertiveness}
                onChange={(value) => updateField('assertiveness', Number(value) || 0)}
                error={errors.assertiveness}
              />
            </SimpleGrid>
          </Stack>
        </Paper>

        {errors.submit && (
          <Text c="red" size="sm">
            {errors.submit}
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={Boolean(createDisabledReason)}
          >
            Create Persona
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
