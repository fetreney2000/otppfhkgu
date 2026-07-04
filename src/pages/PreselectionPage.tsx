import { useEffect, useState } from 'react';
import { Card, Title, Group, Stack, Table, Badge, Button, Modal, Select, Text, ScrollArea } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { getDisplayMonth, getCalendarDays, formatDate, getDayName } from '../utils/dates';
import { notifications } from '@mantine/notifications';

const SLOT_TYPES = [
  'AE', 'IPP_1', 'IPP_2', 'IPP_3', 'IPP_4',
  'OPD_1', 'OPD_2', 'OPD_3', 'OPD_4', 'OPD_5',
  'PP_PPF', 'PP_PRA_1', 'PP_PRA_2',
];

export function PreselectionPage() {
  const { currentMonth, preselections, employees, loadPreselections, setPreselection, loadEmployees } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');

  useEffect(() => {
    loadPreselections(currentMonth);
    loadEmployees();
  }, [currentMonth, loadPreselections, loadEmployees]);

  const calendarDays = getCalendarDays(currentMonth);
  const weekdays = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

  const preMap = new Map<string, Map<string, string>>();
  preselections.forEach(p => {
    if (!preMap.has(p.date)) preMap.set(p.date, new Map());
    preMap.get(p.date)!.set(p.slotType, p.employeeId);
  });

  const handleCellClick = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot('');
    setSelectedEmp('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedSlot || !selectedEmp) {
      notifications.show({ title: 'Ralat', message: 'Pilih slot dan kakitangan', color: 'red' });
      return;
    }
    try {
      await setPreselection(currentMonth, selectedDate, selectedSlot, selectedEmp);
      notifications.show({ title: 'Berjaya', message: 'Pra-pilihan disimpan', color: 'green' });
      setModalOpen(false);
    } catch {
      notifications.show({ title: 'Ralat', message: 'Gagal menyimpan', color: 'red' });
    }
  };

  const empOptions = employees.filter(e => e.active).map(e => ({ value: e.employeeId, label: `${e.employeeId} — ${e.name}` }));

  const existingForDate = preselections.filter(p => p.date === selectedDate);

  return (
    <Stack gap="lg">
      <Title order={2}>Pra-pilihan — {getDisplayMonth(currentMonth)}</Title>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>{weekdays.map(d => <Table.Th key={d} style={{ textAlign: 'center' }}>{d}</Table.Th>)}</Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, wi) => (
                <Table.Tr key={wi}>
                  {calendarDays.slice(wi * 7, wi * 7 + 7).map((date, i) => {
                    const datePres = date ? preMap.get(date) : undefined;
                    return (
                      <Table.Td key={i} style={{ textAlign: 'center', cursor: date ? 'pointer' : 'default', padding: 8, verticalAlign: 'top', minHeight: 80 }}
                        onClick={() => date && handleCellClick(date)}>
                        {date && (
                          <Stack gap={1} align="center">
                            <Text size="sm" fw={500}>{parseInt(date.split('-')[2])}</Text>
                            {datePres && Array.from(datePres.entries()).map(([slot, empId]) => (
                              <Badge key={slot} size="xs" color="teal" variant="light">{slot}</Badge>
                            ))}
                          </Stack>
                        )}
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      {existingForDate.length > 0 && selectedDate && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={4} mb="md">Pra-pilihan untuk {formatDate(selectedDate)}</Title>
          <Stack gap="xs">
            {existingForDate.map(p => (
              <Group key={`${p.date}-${p.slotType}`} p="xs" style={{ background: '#f8f9fa', borderRadius: 8 }}>
                <Badge color="teal">{p.slotType}</Badge>
                <Text size="sm">{p.employeeId}</Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={`Pra-pilihan — ${formatDate(selectedDate)}`} size="md">
        <Stack>
          {existingForDate.length > 0 && (
            <Stack gap="xs" mb="md">
              <Text size="sm" fw={500}>Pra-pilihan sedia ada:</Text>
              {existingForDate.map(p => (
                <Group key={`${p.date}-${p.slotType}`}>
                  <Badge color="teal">{p.slotType}</Badge>
                  <Text size="sm">→ {p.employeeId}</Text>
                </Group>
              ))}
            </Stack>
          )}
          <Select label="Jenis Slot" data={SLOT_TYPES} value={selectedSlot} onChange={v => setSelectedSlot(v || '')} searchable />
          <Select label="Kakitangan" data={empOptions} value={selectedEmp} onChange={v => setSelectedEmp(v || '')} searchable />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave}>Simpan</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}