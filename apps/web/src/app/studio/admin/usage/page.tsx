'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Box, Button, Group, Loader, Stack, Table, Text, Title } from '@mantine/core'
import { IconChartBar, IconDownload, IconPrinter, IconShieldLock } from '@tabler/icons-react'
import { api } from '@/lib/client'
import { useAuthStore } from '@/features/auth/stores/auth.store'

type UsageRow = {
  teamId: string
  subscriptionId: string
  periodKey: string
  allowance: number
  usedActual: number
  remaining: number
}

function usedPct(row: UsageRow): number {
  if (row.allowance <= 0) return 0
  return Math.round((row.usedActual / row.allowance) * 100)
}

function exportCsv(rows: UsageRow[]) {
  const headers = ['Team ID', 'Subscription ID', 'Period', 'Allowance', 'Used', 'Remaining', '%']
  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.teamId,
        r.subscriptionId,
        r.periodKey,
        r.allowance,
        r.usedActual,
        r.remaining,
        usedPct(r),
      ].join(',')
    ),
  ]
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `coin-usage-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminUsagePage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [rows, setRows] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<keyof UsageRow>('teamId')
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    if (user && !user.isSystemAdmin) {
      router.replace('/studio/home')
    }
  }, [router, user])

  useEffect(() => {
    if (!user?.isSystemAdmin) return

    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await api.coins.adminUsage()
        if (active) setRows(Array.isArray(result) ? result : [])
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load usage.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [user?.isSystemAdmin])

  const handleSort = (key: keyof UsageRow) => {
    if (sortKey === key) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortAsc ? av - bv : bv - av
    }
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })

  const SortTh = ({ label, field }: { label: string; field: keyof UsageRow }) => (
    <Table.Th
      onClick={() => handleSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label} {sortKey === field ? (sortAsc ? '↑' : '↓') : ''}
    </Table.Th>
  )

  if (!user?.isSystemAdmin) {
    return (
      <Stack gap="md">
        <Title order={2}>Usage report</Title>
        <Alert color="red" variant="light" icon={<IconShieldLock size={18} />}>
          Super admin access is required.
        </Alert>
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
        }
      `}</style>

      <Stack gap={4}>
        <Group gap="sm" justify="space-between">
          <Group gap="sm">
            <IconChartBar size={20} />
            <Title order={2}>Coin usage report</Title>
          </Group>
          <Group gap="sm" className="no-print">
            <Button
              variant="light"
              size="sm"
              leftSection={<IconDownload size={16} />}
              onClick={() => exportCsv(rows)}
              disabled={rows.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="light"
              size="sm"
              leftSection={<IconPrinter size={16} />}
              onClick={() => window.print()}
              disabled={rows.length === 0}
            >
              Print / PDF
            </Button>
          </Group>
        </Group>
        <Text c="dimmed">All-teams credit usage. Click column headers to sort.</Text>
      </Stack>

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      {loading ? (
        <Loader size="lg" />
      ) : rows.length === 0 ? (
        <Alert color="blue" variant="light">
          No usage data available yet.
        </Alert>
      ) : (
        <Box style={{ overflowX: 'auto' }}>
          <Table
            striped
            highlightOnHover
            withTableBorder
            withColumnBorders
            style={{ minWidth: 700 }}
          >
            <Table.Thead>
              <Table.Tr>
                <SortTh label="Team ID" field="teamId" />
                <SortTh label="Period" field="periodKey" />
                <SortTh label="Allowance" field="allowance" />
                <SortTh label="Used" field="usedActual" />
                <SortTh label="Remaining" field="remaining" />
                <Table.Th>%</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sorted.map((row, idx) => {
                const pct = usedPct(row)
                return (
                  <Table.Tr key={idx}>
                    <Table.Td>
                      <Text size="xs" truncate maw={160}>
                        {row.teamId}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" truncate maw={200}>
                        {row.periodKey}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{row.allowance.toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{row.usedActual.toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        c={pct >= 90 ? 'red' : pct >= 70 ? 'orange' : undefined}
                        fw={pct >= 90 ? 700 : undefined}
                      >
                        {row.remaining.toLocaleString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        c={pct >= 90 ? 'red' : pct >= 70 ? 'orange' : 'dimmed'}
                        fw={pct >= 90 ? 700 : undefined}
                      >
                        {pct}%
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </Box>
      )}
    </Stack>
  )
}
