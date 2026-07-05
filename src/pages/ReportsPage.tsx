import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Title, Group, Stack, Table, Badge, Text, SegmentedControl, Tabs, SimpleGrid, Paper, ScrollArea, Loader, Center, Button, UnstyledButton, Alert } from '@mantine/core';
import { IconDownload, IconChevronUp, IconChevronDown, IconSelector, IconAlertCircle } from '@tabler/icons-react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { getDisplayMonth, formatDate, getDayName, formatCurrency } from '../utils/dates';
import { generateRosterExcel } from '../utils/excelExport';
import { RosterCalendar } from '../components/RosterCalendar';
import { notifications } from '@mantine/notifications';
import type { RosterSummaryItem, RosterPaymentItem } from '../types';

export function ReportsPage() {
  const { currentMonth, rosterReport, rosterSummary, rosterPayment, holidays, employees, rosterCopyExists, loadRosterReport, loadRosterSummary, loadRosterPayment, loadHolidays, editRosterCell, editRosterCopyCell, checkRosterCopyExists } = useAppStore();
  const { role } = useAuthStore();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [source, setSource] = useState('original');
  const [activeTab, setActiveTab] = useState<string | null>('calendar');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [summarySort, setSummarySort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'totalHours', dir: 'desc' });
  const [paymentSort, setPaymentSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'totalOTPay', dir: 'desc' });

  const toggleSummarySort = (key: string) => setSummarySort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  const togglePaymentSort = (key: string) => setPaymentSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const SortIcon = ({ sortKey, current }: { sortKey: string; current: { key: string; dir: string } }) => {
    if (current.key !== sortKey) return <IconSelector size={12} />;
    return current.dir === 'asc' ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />;
  };

  const ThSort = ({ sortKey, current, onToggle, children }: { sortKey: string; current: { key: string; dir: string }; onToggle: (key: string) => void; children: React.ReactNode }) => (
    <Table.Th>
      <UnstyledButton onClick={() => onToggle(sortKey)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {children} <SortIcon sortKey={sortKey} current={current} />
      </UnstyledButton>
    </Table.Th>
  );

  const sortedSummary = useMemo(() => {
    const arr = [...rosterSummary];
    arr.sort((a, b) => {
      const av = a[summarySort.key as keyof typeof a] ?? 0;
      const bv = b[summarySort.key as keyof typeof b] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') return summarySort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return summarySort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [rosterSummary, summarySort]);

  const sortedPayment = useMemo(() => {
    const arr = [...rosterPayment];
    arr.sort((a, b) => {
      const av = a[paymentSort.key as keyof typeof a] ?? 0;
      const bv = b[paymentSort.key as keyof typeof b] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') return paymentSort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      if (paymentSort.key === 'exceedsOneThird') {
        const aVal = av ? 1 : 0;
        const bVal = bv ? 1 : 0;
        return paymentSort.dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return paymentSort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [rosterPayment, paymentSort]);

  // Check salinan availability for regular users
  useEffect(() => {
    if (!isAdmin) {
      checkRosterCopyExists(currentMonth);
    }
  }, [currentMonth, isAdmin, checkRosterCopyExists]);

  // Regular users can only view/edit salinan
  const canViewOriginal = isAdmin;
  const effectiveSource = isAdmin ? source : (rosterCopyExists ? 'copy' : 'original');
  const canEdit = isAdmin ? source === 'copy' : rosterCopyExists;

  // Force source for regular users
  useEffect(() => {
    if (!isAdmin && rosterCopyExists) {
      setSource('copy');
    }
  }, [isAdmin, rosterCopyExists]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadRosterReport(currentMonth, effectiveSource),
      loadRosterSummary(currentMonth, effectiveSource),
      loadRosterPayment(currentMonth, effectiveSource),
      loadHolidays(currentMonth),
    ]).finally(() => setLoading(false));
  }, [currentMonth, effectiveSource, loadRosterReport, loadRosterSummary, loadRosterPayment, loadHolidays]);

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
          <SegmentedControl
            value={isAdmin ? source : (rosterCopyExists ? 'copy' : 'original')}
            onChange={(v) => setSource(v as string)}
            disabled={!isAdmin}
            data={[{ label: 'Asal', value: 'original' }, { label: 'Salinan', value: 'copy' }]}
          />
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

      {/* Regular user info messages */}
      {!isAdmin && !rosterCopyExists && (
        <Alert icon={<IconAlertCircle size={16} />} color="blue" title="Jadual Salinan Belum Dijana">
          <Text size="sm">Admin belum menjana jadual salinan untuk bulan ini. Anda boleh melihat jadual asal sahaja tetapi tidak boleh mengubah suai.</Text>
        </Alert>
      )}
      {!isAdmin && rosterCopyExists && (
        <Alert icon={<IconAlertCircle size={16} />} color="green" title="Mod Sunting Salinan">
          <Text size="sm">Anda sedang menyunting jadual salinan. Semua perubahan akan direkodkan.</Text>
        </Alert>
      )}

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
          {rows.length > 0 ? (
            <RosterCalendar
              rows={rows}
              month={currentMonth}
              holidays={holidays}
              employees={employees}
              canEdit={canEdit}
              onEdit={canEdit ? async (date, slotType, employeeName) => {
                const editFn = effectiveSource === 'copy' ? editRosterCopyCell : editRosterCell;
                await editFn(currentMonth, date, slotType, employeeName);
                await loadRosterReport(currentMonth, effectiveSource);
                const dayLabel = getDayName(date);
                const dateLabel = formatDate(date);
                notifications.show({
                  title: 'Perubahan Direkod',
                  message: `${slotType} pada ${dateLabel} (${dayLabel}) ditukar kepada "${employeeName}" oleh ${role === 'employee' ? 'Anda' : 'Admin'}`,
                  color: 'green',
                  icon: <IconDownload size={16} />,
                  autoClose: 4000,
                });
              } : undefined}
            />
          ) : (
            <Text c="dimmed" ta="center" py="xl">Tiada data jadual</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="summary" pt="md">
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <ThSort sortKey="employeeId" current={summarySort} onToggle={toggleSummarySort}>ID</ThSort>
                  <ThSort sortKey="name" current={summarySort} onToggle={toggleSummarySort}>Nama</ThSort>
                  <ThSort sortKey="department" current={summarySort} onToggle={toggleSummarySort}>Unit</ThSort>
                  <ThSort sortKey="role" current={summarySort} onToggle={toggleSummarySort}>Jawatan</ThSort>
                  <ThSort sortKey="totalHours" current={summarySort} onToggle={toggleSummarySort}>Jam</ThSort>
                  <ThSort sortKey="slotCount" current={summarySort} onToggle={toggleSummarySort}>Slot</ThSort>
                  <ThSort sortKey="aeCount" current={summarySort} onToggle={toggleSummarySort}>AE</ThSort>
                  <ThSort sortKey="holidayCount" current={summarySort} onToggle={toggleSummarySort}>Cuti</ThSort>
                  <ThSort sortKey="weekendCount" current={summarySort} onToggle={toggleSummarySort}>Hujung Minggu</ThSort>
                  <ThSort sortKey="weekdayCount" current={summarySort} onToggle={toggleSummarySort}>Hari Bekerja</ThSort>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedSummary.map(s => (
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
                  <ThSort sortKey="employeeId" current={paymentSort} onToggle={togglePaymentSort}>ID</ThSort>
                  <ThSort sortKey="name" current={paymentSort} onToggle={togglePaymentSort}>Nama</ThSort>
                  <ThSort sortKey="salary" current={paymentSort} onToggle={togglePaymentSort}>Gaji</ThSort>
                  <ThSort sortKey="hourlyRate" current={paymentSort} onToggle={togglePaymentSort}>Kadar/Jam</ThSort>
                  <ThSort sortKey="totalOTPay" current={paymentSort} onToggle={togglePaymentSort}>Jumlah OT</ThSort>
                  <ThSort sortKey="exceedsOneThird" current={paymentSort} onToggle={togglePaymentSort}>Melebihi 1/3</ThSort>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedPayment.map(p => (
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