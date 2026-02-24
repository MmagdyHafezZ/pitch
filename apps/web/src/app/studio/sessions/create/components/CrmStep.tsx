'use client'

import {
  Stack,
  Group,
  Box,
  Title,
  Text,
  Paper,
  Button,
  Badge,
  MultiSelect,
  Select,
  SimpleGrid,
  Alert,
  Anchor,
  Checkbox,
  Divider,
  TextInput,
  ActionIcon,
} from '@mantine/core'
import {
  IconPlugConnected,
  IconDatabase,
  IconRefresh,
  IconBuilding,
  IconBriefcase,
  IconUserCircle,
  IconClipboardList,
  IconAlertCircle,
  IconTrash,
} from '@tabler/icons-react'
import classes from '../create-session.module.css'
import type {
  SavedCrmConnection,
  SavedCrmSessionConnection,
} from '@/features/crm/utils/session-crm-preferences'

export interface CrmOption {
  value: string
  label: string
}

interface CrmStepProps {
  crmStatus: {
    connected?: boolean
    status?: string
    providerEmail?: string
    lastSyncAt?: string
  } | null
  loadingStatus: boolean
  onConnect: () => void
  onRefreshStatus: () => void
  onLoadData: () => void
  loadingData: boolean
  accounts: CrmOption[]
  opportunities: CrmOption[]
  leads: CrmOption[]
  contacts: CrmOption[]
  selectedAccounts: string[]
  setSelectedAccounts: (value: string[]) => void
  selectedOpportunities: string[]
  setSelectedOpportunities: (value: string[]) => void
  selectedLeads: string[]
  setSelectedLeads: (value: string[]) => void
  selectedContacts: string[]
  setSelectedContacts: (value: string[]) => void
  saveForFutureUse?: boolean
  setSaveForFutureUse?: (value: boolean) => void
  savedCrms?: SavedCrmConnection[]
  selectedSavedCrmId?: string | null
  onSelectSavedCrm?: (crmId: string | null) => void
  savedConnections?: SavedCrmSessionConnection[]
  onUseSavedConnection?: (connection: SavedCrmSessionConnection) => void
  onRemoveSavedConnection?: (connection: SavedCrmSessionConnection) => void
  savedConnectionLabel?: string
  setSavedConnectionLabel?: (value: string) => void
}

export function CrmStep({
  crmStatus,
  loadingStatus,
  onConnect,
  onRefreshStatus,
  onLoadData,
  loadingData,
  accounts,
  opportunities,
  leads,
  contacts,
  selectedAccounts,
  setSelectedAccounts,
  selectedOpportunities,
  setSelectedOpportunities,
  selectedLeads,
  setSelectedLeads,
  selectedContacts,
  setSelectedContacts,
  saveForFutureUse = false,
  setSaveForFutureUse,
  savedCrms = [],
  selectedSavedCrmId = null,
  onSelectSavedCrm,
  savedConnections = [],
  onUseSavedConnection,
  onRemoveSavedConnection,
  savedConnectionLabel = '',
  setSavedConnectionLabel,
}: CrmStepProps) {
  const isConnected = crmStatus?.connected
  const connectLabel = isConnected ? 'Connected' : 'Connect'
  const salesforceHelpUrl =
    'https://help.salesforce.com/s/articleView?id=sf.connected_app_create.htm'

  return (
    <Stack gap="lg">
      <Group align="center" gap="sm">
        <Box className={classes.stepIcon}>
          <IconDatabase size={22} />
        </Box>
        <Box>
          <Title order={3}>CRM Enrichment</Title>
          <Text size="sm" c="dimmed">
            Connect Salesforce and pick the records to ground this session in real data.
          </Text>
        </Box>
      </Group>

      <Paper withBorder p="md" radius="lg" className={classes.crmCard}>
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="sm">
            <IconPlugConnected size={18} />
            <Text fw={600}>Salesforce</Text>
            <Badge color={isConnected ? 'green' : 'gray'} variant="light">
              {isConnected ? 'Connected' : 'Not connected'}
            </Badge>
            {crmStatus?.providerEmail && (
              <Text size="xs" c="dimmed">
                {crmStatus.providerEmail}
              </Text>
            )}
          </Group>
          <Group gap="sm">
            <Button variant="light" onClick={onConnect} disabled={!!isConnected}>
              {connectLabel}
            </Button>
            <Button
              variant="subtle"
              leftSection={<IconRefresh size={16} />}
              loading={loadingStatus}
              onClick={onRefreshStatus}
            >
              Refresh
            </Button>
          </Group>
        </Group>
        {isConnected && setSaveForFutureUse ? (
          <>
            <Divider my="md" />
            <Checkbox
              label="Save this CRM connection/setup for future sessions"
              description="If checked, your current CRM provider + selected records can be reused next time."
              checked={saveForFutureUse}
              onChange={(event) => setSaveForFutureUse(event.currentTarget.checked)}
            />
            {saveForFutureUse && setSavedConnectionLabel ? (
              <TextInput
                mt="sm"
                label="Saved preset name"
                placeholder="e.g. Enterprise pipeline (Q2)"
                value={savedConnectionLabel}
                onChange={(event) => setSavedConnectionLabel(event.currentTarget.value)}
                description="Name this CRM setup so you can recognize it next time."
              />
            ) : null}
          </>
        ) : null}
      </Paper>

      {savedCrms.length > 0 && onSelectSavedCrm ? (
        <Paper withBorder p="md" radius="lg" className={classes.crmCard}>
          <Stack gap="sm">
            <Text fw={600}>Saved CRMs</Text>
            <Text size="sm" c="dimmed">
              Select one of your saved CRM connections for this session.
            </Text>
            <Select
              label="Saved CRM connection"
              placeholder="Choose a saved CRM"
              value={selectedSavedCrmId}
              onChange={onSelectSavedCrm}
              data={savedCrms.map((crm) => ({
                value: crm.id,
                label: `${crm.name}${crm.providerEmail ? ` • ${crm.providerEmail}` : ''}`,
              }))}
              clearable
            />
            {selectedSavedCrmId ? (
              <Text size="xs" c="dimmed">
                Selecting a saved CRM applies its provider/account metadata to this session. Record
                selections are still managed below.
              </Text>
            ) : null}
          </Stack>
        </Paper>
      ) : null}

      {savedConnections.length > 0 && onUseSavedConnection ? (
        <Paper withBorder p="md" radius="lg" className={classes.crmCard}>
          <Stack gap="sm">
            <Text fw={600}>Saved CRM connections for future sessions</Text>
            <Text size="sm" c="dimmed">
              Reuse a previously saved CRM selection set for this session.
            </Text>
            {savedConnections.map((connection) => {
              const totalSelections =
                connection.selections.accounts.length +
                connection.selections.opportunities.length +
                connection.selections.leads.length +
                connection.selections.contacts.length

              return (
                <Group key={connection.id} justify="space-between" align="center" wrap="wrap">
                  <Box>
                    <Text fw={500}>{connection.label}</Text>
                    <Text size="xs" c="dimmed">
                      {connection.providerEmail ?? 'Salesforce'} · {totalSelections} selections ·
                      saved {new Date(connection.savedAt).toLocaleString()}
                    </Text>
                  </Box>
                  <Group gap="xs">
                    <Button variant="light" onClick={() => onUseSavedConnection(connection)}>
                      Use for this session
                    </Button>
                    {onRemoveSavedConnection ? (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Remove ${connection.label}`}
                        onClick={() => onRemoveSavedConnection(connection)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    ) : null}
                  </Group>
                </Group>
              )
            })}
          </Stack>
        </Paper>
      ) : null}

      <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light" radius="md">
        <Text size="sm" fw={600}>
          Having trouble connecting?
        </Text>
        <Text size="sm" c="dimmed">
          If you see “External client app is not installed in this org”, your Salesforce org does
          not have the Connected App installed or authorized. Ask your Salesforce admin to install
          it or use the org where the app was created.
        </Text>
        <Anchor href={salesforceHelpUrl} target="_blank" rel="noreferrer">
          Salesforce Connected App setup instructions
        </Anchor>
      </Alert>

      <Paper withBorder p="md" radius="lg" className={classes.crmCard}>
        <Group justify="space-between" align="center" mb="md">
          <Text fw={600}>Choose CRM data for the scenario</Text>
          <Button
            variant="light"
            leftSection={<IconDatabase size={16} />}
            onClick={onLoadData}
            loading={loadingData}
            disabled={!isConnected}
          >
            Load Salesforce data
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <MultiSelect
            label="Accounts"
            placeholder={isConnected ? 'Pick accounts' : 'Connect Salesforce first'}
            data={accounts}
            value={selectedAccounts}
            onChange={setSelectedAccounts}
            leftSection={<IconBuilding size={14} />}
            searchable
            disabled={!isConnected}
          />
          <MultiSelect
            label="Opportunities"
            placeholder={isConnected ? 'Pick opportunities' : 'Connect Salesforce first'}
            data={opportunities}
            value={selectedOpportunities}
            onChange={setSelectedOpportunities}
            leftSection={<IconBriefcase size={14} />}
            searchable
            disabled={!isConnected}
          />
          <MultiSelect
            label="Leads"
            placeholder={isConnected ? 'Pick leads' : 'Connect Salesforce first'}
            data={leads}
            value={selectedLeads}
            onChange={setSelectedLeads}
            leftSection={<IconClipboardList size={14} />}
            searchable
            disabled={!isConnected}
          />
          <MultiSelect
            label="Contacts"
            placeholder={isConnected ? 'Pick contacts' : 'Connect Salesforce first'}
            data={contacts}
            value={selectedContacts}
            onChange={setSelectedContacts}
            leftSection={<IconUserCircle size={14} />}
            searchable
            disabled={!isConnected}
          />
        </SimpleGrid>
      </Paper>
    </Stack>
  )
}
