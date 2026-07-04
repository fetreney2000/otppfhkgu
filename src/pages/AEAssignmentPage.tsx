import { useEffect, useState } from 'react';
import { Card, Title, Group, Stack, Table, Badge, Button, Modal, Radio, ScrollArea, Text } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { getDisplayMonth, getCalendarDays, formatDate } from '../utils/dates';
import { notifications } from '@mantine/notifications';

export function AEAssignmentPage() {
  const { currentMonth, aeAssignments, loadAEAssignments, saveAEAssignments } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  useEffect(() => { loadAEAssignments(currentMonth); }, [currentMonth, loadAEAssignments]);

  const aeMap = new Map(aeAssignments.map(a => [a.date, a.department]));
  const calendarDays = getCalendarDays(currentMonth);
  const weekdays = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

  const handleCellClick = (date: string) => {
    const existing = aeAssignments.find(a => a.date === date);
    setSelectedDate(date);
    setSelectedDept(existing?.department || '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    const updated = aeAssignments.filter(a => a.date !== selectedDate);
    if (selectedDept) {
      updated.push({ _id: '', month: currentMonth, date: selectedDate, department: selectedDept as 'IPP' | 'OPD' });
    }
    await saveAEAssignments(currentMonth, updated.map(a => ({ date: a.date, department: a.department })));
    setModalOpen(false);
    notifications.show({ title: 'Berjaya', message: 'Tugasan AE dikemaskini', color: 'green' });
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Tugasan AE — {getDisplayMonth(currentMonth)}</Title>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
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
                      onClick={() => date && handleCellClick(date)}>
                      {date && (
                        <Stack gap={2} align="center">
                          <Text size="sm" fw={500}>{parseInt(date.split('-')[2])}</Text>
                          {aeMap.has(date) && (
                            <Badge color={aeMap.get(date) === 'IPP' ? 'blue' : 'orange'} size="xs">{aeMap.get(date)}</Badge>
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

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Senarai Tugasan AE</Title>
        <Stack gap="xs">
          {aeAssignments.sort((a, b) => a.date.localeCompare(b.date)).map(a => (
            <Group key={a.date} p="xs" style={{ background: '#f8f9fa', borderRadius: 8 }}>
              <Badge color="pink">{formatDate(a.date)}</Badge>
              <Badge color={a.department === 'IPP' ? 'blue' : 'orange'}>{a.department}</Badge>
            </Group>
          ))}
          {aeAssignments.length === 0 && <Text c="dimmed">Tiada tugasan AE bulan ini</Text>}
        </Stack>
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={`Tugasan AE — ${formatDate(selectedDate)}`}>
        <Stack>
          <Radio.Group value={selectedDept} onChange={setSelectedDept}>
            <Stack><Radio value="IPP" label="IPP" /><Radio value="OPD" label="OPD" /><Radio value="" label="Tiada" /></Stack>
          </Radio.Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave}>Simpan</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}