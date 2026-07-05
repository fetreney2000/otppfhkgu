import { useEffect, useState, useRef, useCallback } from 'react';
import { SimpleGrid, Card, Text, TextInput, Select, Title, Group, Badge, Button, Stack, Loader, Center, Timeline, ActionIcon, Modal, Radio, Table, Alert, ScrollArea, Progress } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useAppStore } from '../stores/appStore';
import { getDisplayMonth, getCalendarDays, getDayName, formatDate } from '../utils/dates';
import { notifications } from '@mantine/notifications';
import {
  IconUsers, IconCalendarEvent, IconCalendarDue, IconCalendarCog,
  IconRefresh, IconPlayerPlay, IconCopy, IconClock, IconTrash, IconCalendarStats, IconCheck,
} from '@tabler/icons-react';
import type { SolverProgress, SolverResult, SolverInputData } from '../types';

export function AdminDashboard() {
  const {
    currentMonth, employees, holidays, aeAssignments, preselections,
    rosterExists, rosterCopyExists, changeLog, loading,
    loadAdminDashboard, loadHolidays, addHoliday, deleteHoliday,
    saveAEAssignments, loadPreselections, setPreselection,
  } = useAppStore();

  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [aeModalOpen, setAeModalOpen] = useState(false);
  const [selectedAeDate, setSelectedAeDate] = useState('');
  const [selectedAeDept, setSelectedAeDept] = useState<string>('');
  const [presModalOpen, setPresModalOpen] = useState(false);
  const [selectedPresDate, setSelectedPresDate] = useState('');
  const [selectedPresSlot, setSelectedPresSlot] = useState('');
  const [selectedPresEmp, setSelectedPresEmp] = useState('');

  useEffect(() => { loadAdminDashboard(currentMonth); }, [currentMonth, loadAdminDashboard]);

  const handleAddHoliday = async () => {
    if (!holidayDate || !holidayName) return;
    try {
      await addHoliday(holidayDate, holidayName);
      setHolidayDate(''); setHolidayName('');
      notifications.show({ title: 'Berjaya', message: 'Cuti umum ditambah', color: 'green' });
    } catch { notifications.show({ title: 'Ralat', message: 'Gagal menambah cuti umum', color: 'red' }); }
  };

  const handleDeleteHoliday = async (date: string) => {
    try {
      await deleteHoliday(date);
      await loadHolidays(currentMonth);
      notifications.show({ title: 'Berjaya', message: 'Cuti umum dipadam', color: 'green' });
    } catch { notifications.show({ title: 'Ralat', message: 'Gagal memadam cuti umum', color: 'red' }); }
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

  const handlePresCellClick = (date: string) => {
    setSelectedPresDate(date);
    setSelectedPresSlot('');
    setSelectedPresEmp('');
    setPresModalOpen(true);
  };

  const handleSavePres = async () => {
    if (!selectedPresSlot || !selectedPresEmp) {
      notifications.show({ title: 'Ralat', message: 'Pilih slot dan kakitangan', color: 'red' });
      return;
    }
    await setPreselection(currentMonth, selectedPresDate, selectedPresSlot, selectedPresEmp);
    setPresModalOpen(false);
    notifications.show({ title: 'Berjaya', message: 'Pra-pilihan disimpan', color: 'green' });
  };

  const calendarDays = getCalendarDays(currentMonth);
  const aeMap = new Map(aeAssignments.map(a => [a.date, a.department]));
  const presMap = new Map(preselections.map(p => [p.date, p.slotType]));
  const activeEmps = employees.filter(e => e.active);
  const weekdays = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];
  const slotTypes = ['AE', 'IPP_1', 'OPD_1', 'PP_PPF'];
  const empOptions = activeEmps.map(e => ({ value: e.employeeId, label: `${e.employeeId} — ${e.name}` }));

  const [solverRunning, setSolverRunning] = useState(false);
  const [solverProgress, setSolverProgress] = useState<SolverProgress | null>(null);
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const { generateRosterData, saveRoster, generateRosterCopy } = useAppStore();

  const handleGenerate = useCallback(async () => {
    setSolverRunning(true); setSolverResult(null); setProgressModalOpen(true);
    setSolverProgress({ type: 'progress', percent: 0, stage: 'init', stageLabel: 'Menyediakan data...', message: 'Memuat data dari pelayan', attempt: 0, totalAttempts: 0, bestUnfilled: 0 });
    try {
      const data: SolverInputData | null = await generateRosterData(currentMonth);
      if (!data) { notifications.show({ title: 'Ralat', message: 'Gagal mendapat data jadual', color: 'red' }); setSolverRunning(false); setProgressModalOpen(false); return; }
      const worker = new Worker(new URL('../workers/rosterSolver.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = async (e: MessageEvent<SolverProgress | SolverResult>) => {
        if (e.data.type === 'progress') setSolverProgress(e.data as SolverProgress);
        else if (e.data.type === 'result') {
          const res = e.data as SolverResult; setSolverResult(res); setSolverRunning(false); worker.terminate(); workerRef.current = null;
          if (res.success || res.assignments.length > 0) {
            try { await saveRoster(currentMonth, res.assignments, res.objective, res.solverMode, res.elapsedSeconds, res.warnings); notifications.show({ title: 'Berjaya', message: `Jadual dijana: ${res.assignments.length} tugasan`, color: 'green' }); loadAdminDashboard(currentMonth); }
            catch { notifications.show({ title: 'Ralat', message: 'Gagal menyimpan jadual', color: 'red' }); }
          }
        }
      };
      worker.onerror = () => { notifications.show({ title: 'Ralat', message: 'Ralat solver', color: 'red' }); setSolverRunning(false); worker.terminate(); };
      worker.postMessage({ type: 'start', data });
    } catch { notifications.show({ title: 'Ralat', message: 'Gagal menjana jadual', color: 'red' }); setSolverRunning(false); }
  }, [currentMonth, generateRosterData, saveRoster, loadAdminDashboard]);

  const handleCancel = () => { if (workerRef.current) { workerRef.current.postMessage({ type: 'cancel' }); workerRef.current.terminate(); workerRef.current = null; } setSolverRunning(false); setProgressModalOpen(false); };

  const handleGenerateCopy = async () => { try { await generateRosterCopy(currentMonth); notifications.show({ title: 'Berjaya', message: 'Salinan jadual dijana', color: 'green' }); loadAdminDashboard(currentMonth); } catch { notifications.show({ title: 'Ralat', message: 'Gagal menjana salinan', color: 'red' }); } };

  if (loading.admin) {
    return <Center style={{ height: 400 }}><Loader size="lg" /></Center>;
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Papan Pemuka — {getDisplayMonth(currentMonth)}</Title>

      {/* 1. Stats Cards */}
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between"><Text size="sm" c="dimmed">Kakitangan Aktif</Text><IconUsers size={24} color="#3b7dc0" /></Group>
          <Title order={2} mt="xs">{employees.filter(e => e.active).length}</Title>
          <Text size="xs" c="dimmed">{employees.filter(e => e.active && e.role === 'PPF').length} PPF · {employees.filter(e => e.active && e.role === 'PRA').length} PRA</Text>
        </Card>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between"><Text size="sm" c="dimmed">Cuti Umum</Text><IconCalendarEvent size={24} color="#e64980" /></Group>
          <Title order={2} mt="xs">{holidays.length}</Title>
          <Text size="xs" c="dimmed">hari cuti bulan ini</Text>
        </Card>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between"><Text size="sm" c="dimmed">Tugasan AE</Text><IconCalendarDue size={24} color="#f76707" /></Group>
          <Title order={2} mt="xs">{aeAssignments.length}</Title>
          <Text size="xs" c="dimmed">hari AE bulan ini</Text>
        </Card>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between"><Text size="sm" c="dimmed">Status Jadual</Text><IconCalendarCog size={24} color="#2b8a3e" /></Group>
          <Group gap="xs" mt="xs">
            <Badge color={rosterExists ? 'green' : 'gray'}>{rosterExists ? 'Asal: Ada' : 'Asal: Tiada'}</Badge>
            <Badge color={rosterCopyExists ? 'blue' : 'gray'}>{rosterCopyExists ? 'Salinan: Ada' : 'Salinan: Tiada'}</Badge>
          </Group>
        </Card>
      </SimpleGrid>

      {/* 2. Pengurusan Cuti Umum */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Pengurusan Cuti Umum</Title>
        <Group grow mb="md">
          <DatePickerInput value={holidayDate ? new Date(holidayDate) : null} onChange={(val) => {
            const d = new Date(val);
            if (!isNaN(d.getTime())) setHolidayDate(d.toISOString().split('T')[0]); else setHolidayDate('');
          }} placeholder="Tarikh Cuti" size="sm" valueFormat="DD-MM-YYYY" clearable />
          <TextInput value={holidayName} onChange={e => setHolidayName(e.currentTarget.value)} placeholder="Nama Cuti Umum" size="sm" />
          <Button size="sm" onClick={handleAddHoliday}>Tambah</Button>
        </Group>
        <Stack gap="xs">
          {holidays.map(h => (
            <Group key={h.date} justify="space-between" p="xs" style={{ background: '#f8f9fa', borderRadius: 8 }}>
              <Group gap="sm">
                <Badge color="pink" variant="light" size="sm">{formatDate(h.date)}</Badge>
                <Text size="sm" fw={500}>{h.name}</Text>
              </Group>
              <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleDeleteHoliday(h.date)}><IconTrash size={14} /></ActionIcon>
            </Group>
          ))}
          {holidays.length === 0 && <Text size="sm" c="dimmed">Tiada cuti umum bulan ini</Text>}
        </Stack>
      </Card>

      {/* 3. Tugasan AE */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Tugasan AE</Title>
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>{weekdays.map(d => <Table.Th key={d} style={{ textAlign: 'center' }}>{d}</Table.Th>)}</Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, wi) => (
                <Table.Tr key={wi}>
                  {calendarDays.slice(wi * 7, wi * 7 + 7).map((date, i) => (
                    <Table.Td key={i} style={{ textAlign: 'center', cursor: date ? 'pointer' : 'default', padding: 12 }}
                      onClick={() => date && handleAeCellClick(date)}>
                      {date && <Stack gap={2} align="center">
                        <Text size="sm" fw={500}>{parseInt(date.split('-')[2])}</Text>
                        {aeMap.has(date) && <Badge color={aeMap.get(date) === 'IPP' ? 'blue' : 'orange'} size="xs">{aeMap.get(date)}</Badge>}
                      </Stack>}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      {/* 4. Pra-Pilihan */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Pra-pilihan</Title>
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>{weekdays.map(d => <Table.Th key={d} style={{ textAlign: 'center' }}>{d}</Table.Th>)}</Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, wi) => (
                <Table.Tr key={wi}>
                  {calendarDays.slice(wi * 7, wi * 7 + 7).map((date, i) => {
                    const presForDate = preselections.filter(p => p.date === date);
                    return (
                      <Table.Td key={i} style={{ textAlign: 'center', cursor: date ? 'pointer' : 'default', padding: 8 }}
                        onClick={() => date && handlePresCellClick(date)}>
                        {date && <Stack gap={1} align="center">
                          <Text size="sm" fw={500}>{parseInt(date.split('-')[2])}</Text>
                          {presForDate.length > 0 && <Badge color="teal" size="xs">{presForDate.length} slot</Badge>}
                        </Stack>}
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      {/* 5. Operasi */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Operasi</Title>
        <Group>
          <Button leftSection={<IconPlayerPlay size={16} />} onClick={handleGenerate} loading={solverRunning}>Jana Jadual</Button>
          <Button variant="outline" leftSection={<IconCopy size={16} />} onClick={handleGenerateCopy}>Hasilkan Salinan</Button>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => loadAdminDashboard(currentMonth)}>Muat Semula</Button>
        </Group>
      </Card>

      {/* Change Log */}
      {changeLog.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={4} mb="md">Log Perubahan</Title>
          <Timeline active={changeLog.length - 1} bulletSize={20} lineWidth={2}>
            {changeLog.slice(0, 10).map((log, i) => (
              <Timeline.Item key={i} bullet={<IconClock size={10} />} title={log.action}>
                <Text size="xs" c="dimmed">{new Date(log.changedAt).toLocaleString('ms-MY')}</Text>
                <Text size="sm">{log.changedByName}: {log.date} — {log.slot}{log.newEmployee && ` → ${log.newEmployee}`}</Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}

      {/* AE Assignment Modal */}
      <Modal opened={aeModalOpen} onClose={() => setAeModalOpen(false)} title={`Tugasan AE — ${formatDate(selectedAeDate)}`}>
        <Stack>
          <Radio.Group value={selectedAeDept} onChange={setSelectedAeDept}>
            <Stack><Radio value="IPP" label="IPP" /><Radio value="OPD" label="OPD" /><Radio value="" label="Tiada (Nyah-set)" /></Stack>
          </Radio.Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAeModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveAE}>Simpan</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Preselection Modal */}
      <Modal opened={presModalOpen} onClose={() => setPresModalOpen(false)} title={`Pra-pilihan — ${formatDate(selectedPresDate)}`}>
        <Stack>
          <Select data={SLOT_TYPES} value={selectedPresSlot} onChange={(_v: any) => setSelectedPresSlot(_v || '')} label="Jenis Slot" searchable />
          <Select data={empOptions} value={selectedPresEmp} onChange={(_v: any) => setSelectedPresEmp(_v || '')} label="Kakitangan" searchable />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPresModalOpen(false)}>Batal</Button>
            <Button onClick={handleSavePres}>Simpan</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Progress Modal */}
      <Modal opened={progressModalOpen} onClose={() => !solverRunning && setProgressModalOpen(false)} title="Penjanaan Jadual" centered closeOnClickOutside={!solverRunning} closeOnEscape={!solverRunning}>
        <Stack>
          {solverProgress && (<>
            <Text fw={500}>{solverProgress.stageLabel}</Text>
            <Text size="sm" c="dimmed">{solverProgress.message}</Text>
            <Progress value={solverProgress.percent} animated striped size="xl" />
            <Group justify="space-between">
              <Text size="xs">{solverProgress.percent.toFixed(0)}%</Text>
            </Group>
          </>)}
          {solverRunning && <Group justify="flex-end"><Button color="red" variant="outline" onClick={handleCancel}>Batal</Button></Group>}
          {!solverRunning && solverResult && <Group justify="flex-end"><Button leftSection={<IconCheck size={16} />} onClick={() => setProgressModalOpen(false)}>Tutup</Button></Group>}
        </Stack>
      </Modal>
    </Stack>
  );
}

const SLOT_TYPES = ['AE', 'IPP_1', 'IPP_2', 'IPP_3', 'IPP_4', 'OPD_1', 'OPD_2', 'OPD_3', 'PP_PPF'];