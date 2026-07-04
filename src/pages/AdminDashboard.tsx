import { useEffect, useState } from 'react';
import { SimpleGrid, Card, Text, Title, Group, Badge, Button, Stack, Loader, Center, Timeline, ActionIcon, Modal, Radio, Table, Alert, ScrollArea } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { getDisplayMonth, getCalendarDays, getDayName, getDayNameShort, formatDate } from '../utils/dates';
import { notifications } from '@mantine/notifications';
import {
  IconUsers, IconCalendarEvent, IconCalendarDue, IconCalendarCog,
  IconRefresh, IconPlayerPlay, IconCopy, IconClock, IconAlertCircle,
} from '@tabler/icons-react';

export function AdminDashboard() {
  const {
    currentMonth, employees, holidays, aeAssignments, preselections,
    rosterExists, rosterCopyExists, changeLog, loading,
    loadAdminDashboard, loadHolidays, addHoliday, deleteHoliday,
    loadAEAssignments, saveAEAssignments,
  } = useAppStore();

  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [aeModalOpen, setAeModalOpen] = useState(false);
  const [selectedAeDate, setSelectedAeDate] = useState('');
  const [selectedAeDept, setSelectedAeDept] = useState<string>('');

  useEffect(() => {
    loadAdminDashboard(currentMonth);
  }, [currentMonth, loadAdminDashboard]);

  const handleAddHoliday = async () => {
    if (!holidayDate || !holidayName) return;
    try {
      await addHoliday(holidayDate, holidayName);
      setHolidayDate('');
      setHolidayName('');
      notifications.show({ title: 'Berjaya', message: 'Cuti umum ditambah', color: 'green' });
    } catch {
      notifications.show({ title: 'Ralat', message: 'Gagal menambah cuti umum', color: 'red' });
    }
  };

  const handleDeleteHoliday = async (date: string) => {
    try {
      await deleteHoliday(date);
      await loadHolidays(currentMonth);
      notifications.show({ title: 'Berjaya', message: 'Cuti umum dipadam', color: 'green' });
    } catch {
      notifications.show({ title: 'Ralat', message: 'Gagal memadam cuti umum', color: 'red' });
    }
  };

  const handleAeCellClick = (date: string) => {
    const existing = aeAssignments.find(a => a.date === date);
    setSelectedAeDate(date);
    setSelectedAeDept(existing?.department || '');
    setAeModalOpen(true);
  };

  const handleSaveAE = async () => {
    const updated = aeAssignments.filter(a => a.date !== selectedAeDate);
    if (selectedAeDept) {
      updated.push({ _id: '', month: currentMonth, date: selectedAeDate, department: selectedAeDept as 'IPP' | 'OPD' });
    }
    await saveAEAssignments(currentMonth, updated.map(a => ({ date: a.date, department: a.department })));
    setAeModalOpen(false);
    notifications.show({ title: 'Berjaya', message: 'Tugasan AE dikemaskini', color: 'green' });
  };

  const calendarDays = getCalendarDays(currentMonth);
  const holidaySet = new Set(holidays.map(h => h.date));
  const aeMap = new Map(aeAssignments.map(a => [a.date, a.department]));
  const ppsEmployees = employees.filter(e => e.active && e.role === 'PPF');
  const praEmployees = employees.filter(e => e.active && e.role === 'PRA');

  const weekdays = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

  if (loading.admin) {
    return <Center style={{ height: 400 }}><Loader size="lg" /></Center>;
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Papan Pemuka — {getDisplayMonth(currentMonth)}</Title>

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Kakitangan Aktif</Text>
            <IconUsers size={24} color="#3b7dc0" />
          </Group>
          <Title order={2} mt="xs">{employees.filter(e => e.active).length}</Title>
          <Text size="xs" c="dimmed">{ppsEmployees.length} PPF · {praEmployees.length} PRA</Text>
        </Card>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Cuti Umum</Text>
            <IconCalendarEvent size={24} color="#e64980" />
          </Group>
          <Title order={2} mt="xs">{holidays.length}</Title>
          <Text size="xs" c="dimmed">hari cuti bulan ini</Text>
        </Card>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Tugasan AE</Text>
            <IconCalendarDue size={24} color="#f76707" />
          </Group>
          <Title order={2} mt="xs">{aeAssignments.length}</Title>
          <Text size="xs" c="dimmed">hari AE bulan ini</Text>
        </Card>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Status Jadual</Text>
            <IconCalendarCog size={24} color="#2b8a3e" />
          </Group>
          <Group gap="xs" mt="xs">
            <Badge color={rosterExists ? 'green' : 'gray'}>{rosterExists ? 'Asal: Ada' : 'Asal: Tiada'}</Badge>
            <Badge color={rosterCopyExists ? 'blue' : 'gray'}>{rosterCopyExists ? 'Salinan: Ada' : 'Salinan: Tiada'}</Badge>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Operations */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Operasi</Title>
        <Group>
          <Button leftSection={<IconPlayerPlay size={16} />} onClick={() => window.location.href = '/roster-generation'}>
            Jana Jadual
          </Button>
          <Button variant="outline" leftSection={<IconCopy size={16} />} onClick={() => window.location.href = '/roster-generation'}>
            Hasilkan Salinan
          </Button>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => loadAdminDashboard(currentMonth)}>
            Muat Semula
          </Button>
        </Group>
      </Card>

      {/* AE Assignment Calendar */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Tugasan AE</Title>
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>{weekdays.map(d => <Table.Th key={d} style={{ textAlign: 'center' }}>{d}</Table.Th>)}</Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, weekIndex) => (
                <Table.Tr key={weekIndex}>
                  {calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7).map((date, i) => (
                    <Table.Td key={i} style={{ textAlign: 'center', minHeight: 60, cursor: date ? 'pointer' : 'default' }}
                      onClick={() => date && handleAeCellClick(date)}
                    >
                      {date && (
                        <Stack gap={2} align="center">
                          <Text size="sm" fw={500}>{parseInt(date.split('-')[2])}</Text>
                          {aeMap.has(date) && (
                            <Badge color={aeMap.get(date) === 'IPP' ? 'blue' : 'orange'} size="xs">
                              {aeMap.get(date)}
                            </Badge>
                          )}
                        </Stack>
                      )}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Holiday Management */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Pengurusan Cuti Umum</Title>
        <Group mb="md" grow>
          <input
            type="date"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
            style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
            title="Tarikh Cuti"
          />
          <input
            type="text"
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
            placeholder="Nama Cuti Umum"
            style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
            title="Nama Cuti"
          />
          <Button onClick={handleAddHoliday}>Tambah</Button>
        </Group>
        <Stack gap="xs">
          {holidays.map(h => (
            <Group key={h.date} justify="space-between" p="xs" style={{ background: '#f8f9fa', borderRadius: 8 }}>
              <Group>
                <Text size="sm" fw={500}>{formatDate(h.date)}</Text>
                <Text size="sm">{h.name}</Text>
              </Group>
              <ActionIcon color="red" variant="light" onClick={() => handleDeleteHoliday(h.date)}>
                ×
              </ActionIcon>
            </Group>
          ))}
          {holidays.length === 0 && <Text size="sm" c="dimmed">Tiada cuti umum bulan ini</Text>}
        </Stack>
      </Card>

      {/* Change Log */}
      {changeLog.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={4} mb="md">Log Perubahan</Title>
          <Timeline active={changeLog.length - 1} bulletSize={20} lineWidth={2}>
            {changeLog.slice(0, 20).map((log, i) => (
              <Timeline.Item key={i} bullet={<IconClock size={10} />} title={log.action}>
                <Text size="xs" c="dimmed">
                  {new Date(log.changedAt).toLocaleString('ms-MY')}
                </Text>
                <Text size="sm">
                  {log.changedByName}: {log.date} — {log.slot}
                  {log.newEmployee && ` → ${log.newEmployee}`}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}

      {/* AE Assignment Modal */}
      <Modal opened={aeModalOpen} onClose={() => setAeModalOpen(false)} title={`Tugasan AE — ${formatDate(selectedAeDate)}`}>
        <Stack>
          <Radio.Group value={selectedAeDept} onChange={setSelectedAeDept}>
            <Stack>
              <Radio value="IPP" label="IPP" />
              <Radio value="OPD" label="OPD" />
              <Radio value="" label="Tiada (Nyah-set)" />
            </Stack>
          </Radio.Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAeModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveAE}>Simpan</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}