'use client'

import { Box, Title, Text, Stack, Button, Group, SimpleGrid, Card, ThemeIcon } from '@mantine/core'
import { IconMap, IconHome, IconVideo, IconChartBar, IconUsers } from '@tabler/icons-react'
import { motion } from 'framer-motion'

interface TutorialOfferStepProps {
  onStartTour: () => void
  onSkip: () => void
}

const tourHighlights = [
  { icon: <IconHome size={18} />, label: 'Home Dashboard', desc: 'Key metrics at a glance' },
  { icon: <IconVideo size={18} />, label: 'Sessions', desc: 'Launch and review practice sessions' },
  { icon: <IconChartBar size={18} />, label: 'Analytics', desc: 'Track performance over time' },
  { icon: <IconUsers size={18} />, label: 'Team Config', desc: 'Manage your team and roles' },
]

export function TutorialOfferStep({ onStartTour, onSkip }: TutorialOfferStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      <Stack gap="xl">
        <Box ta="center">
          <ThemeIcon
            size={64}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'cyan' }}
            mx="auto"
            mb="md"
          >
            <IconMap size={32} />
          </ThemeIcon>
          <Title order={2} fw={700} mb="xs">
            You&apos;re all set!
          </Title>
          <Text c="dimmed" maw={440} mx="auto">
            Want a quick tour of the app? We&apos;ll walk you through the key screens in under 2
            minutes.
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {tourHighlights.map((item) => (
            <Card key={item.label} padding="md" radius="md" withBorder>
              <Group gap="sm">
                <ThemeIcon size={36} radius="md" variant="light" color="indigo">
                  {item.icon}
                </ThemeIcon>
                <Box>
                  <Text size="sm" fw={600}>
                    {item.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {item.desc}
                  </Text>
                </Box>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        <Group justify="space-between" wrap="wrap">
          <Button variant="subtle" color="gray" onClick={onSkip}>
            Skip tour
          </Button>
          <Button leftSection={<IconMap size={16} />} onClick={onStartTour} px={32}>
            Start Tour
          </Button>
        </Group>
      </Stack>
    </motion.div>
  )
}
