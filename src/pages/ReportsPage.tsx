import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Title, Group, Stack, Table, Badge, Text, SegmentedControl, Tabs, SimpleGrid, Paper, ScrollArea, Loader, Center, Button, UnstyledButton, Alert } from '@mantine/core';
import { IconDownload, IconAlertCircle } from '@tabler/icons-react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { getDisplayMonth, formatDate, getDayName, formatCurrency } from '../utils/dates';
import { generateRosterExcel } from '../utils/excelExport';
import { RosterCalendar } from '../components/RosterCalendar';
import { notifications } from '@mantine/notifications';
import type { RosterSummaryItem, RosterPaymentItem } from '../types';
import { ThSort, useSortable } from '../components/SortableTh';

export function ReportsPage() {
  const { currentMonth, rosterReport, rosterSummary, rosterPayment, holidays, employees, rosterCopyExists, changeLog, loadRosterReport, loadRosterSummary, loadRosterPayment, loadHolidays, loadChangeLog, editRosterCell, editRosterCopyCell, checkRosterCopyExists } = useAppStore();
  const { role } = useAuthStore();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [source, setSource] = useState('original');
  const [activeTab, setActiveTab] = useState<string | null>('calendar');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const summarySort = useSortable('totalHours', 'desc');
  const paymentSort = useSortable('totalOTPay', 'desc');
  const logSort = useSortable('changedAt', 'desc');

  const sortedSummary = useMemo(() => summarySort.sortArray(rosterSummary), [rosterSummary, summarySort]);
  const sortedPayment = useMemo(() => paymentSort.sortArray(rosterPayment), [rosterPayment, paymentSort]);
  const sortedChangeLog = useMemo(() => logSort.sortArray(changeLog), [changeLog, logSort]);

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
      loadChangeLog(currentMonth),
    ]).finally(() => setLoading(false));
  }, [currentMonth, effectiveSource, loadRosterReport, loadRosterSummary, loadRosterPayment, loadHolidays, loadChangeLog]);

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
                  <ThSort sortKey="employeeId" current={summarySort.sort} onToggle={summarySort.toggle}>ID</ThSort>
                  <ThSort sortKey="name" current={summarySort.sort} onToggle={summarySort.toggle}>Nama</ThSort>
                  <ThSort sortKey="department" current={summarySort.sort} onToggle={summarySort.toggle}>Unit</ThSort>
                  <ThSort sortKey="role" current={summarySort.sort} onToggle={summarySort.toggle}>Jawatan</ThSort>
                  <ThSort sortKey="totalHours" current={summarySort.sort} onToggle={summarySort.toggle}>Jam</ThSort>
                  <ThSort sortKey="slotCount" current={summarySort.sort} onToggle={summarySort.toggle}>Slot</ThSort>
                  <ThSort sortKey="aeCount" current={summarySort.sort} onToggle={summarySort.toggle}>AE</ThSort>
                  <ThSort sortKey="holidayCount" current={summarySort.sort} onToggle={summarySort.toggle}>Cuti</ThSort>
                  <ThSort sortKey="weekendCount" current={summarySort.sort} onToggle={summarySort.toggle}>Hujung Minggu</ThSort>
                  <ThSort sortKey="weekdayCount" current={summarySort.sort} onToggle={summarySort.toggle}>Hari Bekerja</ThSort>
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
                  <ThSort sortKey="employeeId" current={paymentSort.sort} onToggle={paymentSort.toggle}>ID</ThSort>
                  <ThSort sortKey="name" current={paymentSort.sort} onToggle={paymentSort.toggle}>Nama</ThSort>
                  <ThSort sortKey="salary" current={paymentSort.sort} onToggle={paymentSort.toggle}>Gaji</ThSort>
                  <ThSort sortKey="hourlyRate" current={paymentSort.sort} onToggle={paymentSort.toggle}>Kadar/Jam</ThSort>
                  <ThSort sortKey="totalOTPay" current={paymentSort.sort} onToggle={paymentSort.toggle}>Jumlah OT</ThSort>
                  <ThSort sortKey="exceedsOneThird" current={paymentSort.sort} onToggle={paymentSort.toggle}>Melebihi 1/3</ThSort>
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
                  <ThSort sortKey="changedAt" current={logSort.sort} onToggle={logSort.toggle}>Masa</ThSort>
                  <ThSort sortKey="slot" current={logSort.sort} onToggle={logSort.toggle}>Slot</ThSort>
                  <ThSort sortKey="changedByName" current={logSort.sort} onToggle={logSort.toggle}>Oleh</ThSort>
                  <ThSort sortKey="oldEmployee" current={logSort.sort} onToggle={logSort.toggle}>Dari</ThSort>
                  <ThSort sortKey="newEmployee" current={logSort.sort} onToggle={logSort.toggle}>Ke</ThSort>
                  <ThSort sortKey="date" current={logSort.sort} onToggle={logSort.toggle}>Tarikh</ThSort>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedChangeLog.slice(0, 200).map((c, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{c.changedAt ? new Date(c.changedAt).toLocaleString('ms-MY') : ''}</Table.Td>
                    <Table.Td><Badge color="blue" size="xs">{c.slot}</Badge></Table.Td>
                    <Table.Td>{c.changedByName}</Table.Td>
                    <Table.Td>{c.oldEmployee || <Text c="dimmed">—</Text>}</Table.Td>
                    <Table.Td>{c.newEmployee || <Text c="dimmed">—</Text>}</Table.Td>
                    <Table.Td><Badge color={c.action === 'ASSIGN' ? 'green' : c.action === 'CLEAR' ? 'red' : 'orange'} size="xs">{c.action}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {sortedChangeLog.length === 0 && <Text c="dimmed" ta="center" py="xl">Tiada log perubahan</Text>}
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