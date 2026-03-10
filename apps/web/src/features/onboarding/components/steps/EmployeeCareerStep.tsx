'use client'

import {
  Box,
  Title,
  Text,
  Stack,
  Button,
  Group,
  TextInput,
  NumberInput,
  Select,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconBriefcase, IconBrandLinkedin } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { CareerInfo } from '../../types'

const INDUSTRIES = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Manufacturing',
  'Retail',
  'Media & Entertainment',
  'Education',
  'Professional Services',
  'Real Estate',
  'Other',
]

interface EmployeeCareerStepProps {
  onNext: (info: CareerInfo) => void
  onSkip: () => void
}

export function EmployeeCareerStep({ onNext, onSkip }: EmployeeCareerStepProps) {
  const form = useForm<CareerInfo>({
    initialValues: {
      jobTitle: '',
      yearsOfExperience: undefined,
      industry: '',
      linkedIn: '',
    },
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      <Stack gap="xl">
        <Box ta="center">
          <Title order={2} fw={700} mb="xs">
            Tell us about yourself
          </Title>
          <Text c="dimmed" maw={440} mx="auto">
            This helps us personalize your coaching scenarios and match you with relevant content.
          </Text>
        </Box>

        <Stack gap="md">
          <TextInput
            label="Job Title"
            placeholder="e.g. Account Executive"
            leftSection={<IconBriefcase size={16} />}
            {...form.getInputProps('jobTitle')}
          />

          <NumberInput
            label="Years of Sales Experience"
            placeholder="e.g. 3"
            min={0}
            max={50}
            {...form.getInputProps('yearsOfExperience')}
          />

          <Select
            label="Industry"
            placeholder="Select your industry"
            data={INDUSTRIES}
            searchable
            {...form.getInputProps('industry')}
          />

          <TextInput
            label="LinkedIn Profile (optional)"
            placeholder="https://linkedin.com/in/yourprofile"
            leftSection={<IconBrandLinkedin size={16} />}
            {...form.getInputProps('linkedIn')}
          />
        </Stack>

        <Group justify="space-between" wrap="wrap">
          <Button variant="subtle" color="gray" onClick={onSkip}>
            Skip
          </Button>
          <Button onClick={() => onNext(form.values)} px={32}>
            Continue
          </Button>
        </Group>
      </Stack>
    </motion.div>
  )
}
