import { useEffect, useState, useCallback } from 'react';
import { Card, Title, Group, Stack, Table, Badge, Text, SegmentedControl, Tabs, SimpleGrid, Paper, ScrollArea, Loader, Center, Button } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useAppStore } from '../stores/appStore';
import { getDisplayMonth, formatDate, getDayName, formatCurrency } from '../utils/dates';
import { generateRosterExcel } from '../utils/excelExport';
import type { RosterSummaryItem, RosterPaymentItem } from '../types';

export function ReportsPage() {
  const { currentMonth, rosterReport, rosterSummary, rosterPayment, holidays, loadRosterReport, loadRosterSummary, loadRosterPayment, loadHolidays } = useAppStore();
  const [source, setSource] = useState('original');
  const [activeTab, setActiveTab] = useState<string | null>('calendar');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadRosterReport(currentMonth, source),
      loadRosterSummary(currentMonth, source),
      loadRosterPayment(currentMonth, source),
      loadHolidays(currentMonth),
    ]).finally(() => setLoading(false));
  }, [currentMonth, source, loadRosterReport, loadRosterSummary, loadRosterPayment, loadHolidays]);

  const roster = rosterReport?.roster;

  const handleExportExcel = useCallback(async () => {
    if (!roster?.rows || roster.rows.length === 0) return;
    setExporting(true);
    try {
      const label = source === 'copy' ? 'Salinan' : 'Asal';
      await generateRosterExcel(roster.rows, currentMonth, holidays, label);
    } catch (err) {
      console.error('Excel export error:', err);
    } finally {
      setExporting(false);
    }
  }, [roster, currentMonth, holidays, source]);
  const rows = roster?.rows || [];
  const log = rosterReport?.log || [];
  const unfilled = rosterReport?.unfilled || [];

  // Group rows by date
  const rowsByDate = new Map<string, typeof rows>();
  rows.forEach(r => {
    if (!rowsByDate.has(r.date)) rowsByDate.set(r.date, []);
    rowsByDate.get(r.date)!.push(r);
  });

  const sortedDates = Array.from(rowsByDate.keys()).sort();

  const totalHours = rosterSummary.reduce((s, r) => s + r.totalHours, 0);
  const totalSlots = rosterSummary.reduce((s, r) => s + r.slotCount, 0);
  const totalPay = rosterPayment.reduce((s, r) => s + r.totalOTPay, 0);
  const exceedCount = rosterPayment.filter(r => r.exceedsOneThird).length;

  if (loading) return <Center style={{ height: 400 }}><Loader size="lg" /></Center>;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Laporan — {getDisplayMonth(currentMonth)}</Title>
        <Group>
          <SegmentedControl value={source} onChange={(v) => setSource(v as string)} data={[{ label: 'Asal', value: 'original' }, { label: 'Salinan', value: 'copy' }]} />
          <Button
            leftSection={<IconDownload size={16} />}
            variant="light"
            color="green"
            loading={exporting}
            disabled={!roster?.rows || roster.rows.length === 0}
            onClick={handleExportExcel}
          >
            Muat Turun Excel
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Paper shadow="xs" p="md" withBorder><Text size="xs" c="dimmed">Jumlah Jam</Text><Title order={3}>{totalHours}h</Title></Paper>
        <Paper shadow="xs" p="md" withBorder><Text size="xs" c="dimmed">Jumlah Slot</Text><Title order={3}>{totalSlots}</Title></Paper>
        <Paper shadow="xs" p="md" withBorder><Text size="xs" c="dimmed">Jumlah Bayaran OT</Text><Title order={3}>{formatCurrency(totalPay)}</Title></Paper>
        <Paper shadow="xs" p="md" withBorder><Text size="xs" c="dimmed">Melebihi 1/3 Gaji</Text><Title order={3} c={exceedCount > 0 ? 'red' : 'green'}>{exceedCount}</Title></Paper>
      </SimpleGrid>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="calendar">Kalendar</Tabs.Tab>
          <Tabs.Tab value="summary">Ringkasan</Tabs.Tab>
          <Tabs.Tab value="payment">Bayaran</Tabs.Tab>
          <Tabs.Tab value="log">Log</Tabs.Tab>
          <Tabs.Tab value="unfilled">Tidak Diisi</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="calendar" pt="md">
          <Stack gap="xs">
            {sortedDates.map(date => (
              <Card key={date} shadow="xs" padding="sm" withBorder>
                <Group justify="space-between" mb="xs">
                  <Group>
                    <Badge color="blue">{formatDate(date)}</Badge>
                    <Text size="sm" fw={500}>{getDayName(date)}</Text>
                  </Group>
                </Group>
                <Group gap="xs" wrap="wrap">
                  {rowsByDate.get(date)!.sort((a, b) => a.slotType.localeCompare(b.slotType)).map((r, i) => (
                    <Badge key={i} color={r.slotType === 'AE' ? 'red' : r.slotType.startsWith('IPP') ? 'blue' : r.slotType.startsWith('OPD') ? 'orange' : 'grape'} variant="light" size="sm">
                      {r.slotType}: {r.employeeName} ({r.hours}h)
                    </Badge>
                  ))}
                </Group>
              </Card>
            ))}
            {sortedDates.length === 0 && <Text c="dimmed" ta="center" py="xl">Tiada data jadual</Text>}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="summary" pt="md">
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th><Table.Th>Nama</Table.Th><Table.Th>Unit</Table.Th>
                  <Table.Th>Jawatan</Table.Th><Table.Th>Jam</Table.Th><Table.Th>Slot</Table.Th>
                  <Table.Th>AE</Table.Th><Table.Th>Cuti</Table.Th><Table.Th>Hujung Minggu</Table.Th><Table.Th>Hari Bekerja</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rosterSummary.map(s => (
                  <Table.Tr key={s.employeeId}>
                    <Table.Td>{s.employeeId}</Table.Td><Table.Td>{s.name}</Table.Td>
                    <Table.Td><Badge color={s.department === 'IPP' ? 'blue' : 'orange'} size="xs">{s.department}</Badge></Table.Td>
                    <Table.Td>{s.role}</Table.Td><Table.Td fw={500}>{s.totalHours}h</Table.Td>
                    <Table.Td>{s.slotCount}</Table.Td><Table.Td>{s.aeCount}</Table.Td>
                    <Table.Td>{s.holidayCount}</Table.Td><Table.Td>{s.weekendCount}</Table.Td><Table.Td>{s.weekdayCount}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="payment" pt="md">
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th><Table.Th>Nama</Table.Th><Table.Th>Gaji</Table.Th>
                  <Table.Th>Kadar/Jam</Table.Th><Table.Th>Jumlah OT</Table.Th><Table.Th>Melebihi 1/3</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rosterPayment.map(p => (
                  <Table.Tr key={p.employeeId} style={p.exceedsOneThird ? { backgroundColor: '#fff5f5' } : undefined}>
                    <Table.Td>{p.employeeId}</Table.Td><Table.Td>{p.name}</Table.Td>
                    <Table.Td>{formatCurrency(p.salary)}</Table.Td><Table.Td>{formatCurrency(p.hourlyRate)}</Table.Td>
                    <Table.Td fw={500}>{formatCurrency(p.totalOTPay)}</Table.Td>
                    <Table.Td>{p.exceedsOneThird ? <Badge color="red">Ya</Badge> : <Badge color="green">Tidak</Badge>}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="log" pt="md">
          <ScrollArea style={{ maxHeight: 500 }}>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tarikh</Table.Th><Table.Th>Slot</Table.Th><Table.Th>ID</Table.Th>
                  <Table.Th>Nama</Table.Th><Table.Th>Layak</Table.Th><Table.Th>Sebab</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {log.slice(0, 200).map((l, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{l.date}</Table.Td><Table.Td>{l.slot}</Table.Td><Table.Td>{l.employeeId}</Table.Td>
                    <Table.Td>{l.name}</Table.Td>
                    <Table.Td><Badge color={l.eligible ? 'green' : 'red'} size="xs">{l.eligible ? 'Ya' : 'Tidak'}</Badge></Table.Td>
                    <Table.Td><Text size="xs">{l.reasons}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {log.length === 0 && <Text c="dimmed" ta="center" py="xl">Tiada log kelayakan</Text>}
        </Tabs.Panel>

        <Tabs.Panel value="unfilled" pt="md">
          {unfilled.length > 0 ? (
            <Stack gap="xs">
              {unfilled.map((r, i) => (
                <Group key={i} p="xs" style={{ background: '#fff5f5', borderRadius: 8 }}>
                  <Badge color="red">{formatDate(r.date)}</Badge>
                  <Badge color="gray">{r.slotType}</Badge>
                  <Text size="sm">{r.day}</Text>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" ta="center" py="xl">Semua slot telah diisi</Text>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}