import { useEffect, useState } from 'react';
import { Card, Title, Group, Stack, Table, Badge, Button, Text, ScrollArea } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { getDisplayMonth, getCalendarDays, getDayName, formatDate } from '../utils/dates';
import { notifications } from '@mantine/notifications';

export function UnavailabilityPage() {
  const { currentMonth, workspace, loadWorkspace } = useAppStore();
  const { name, role } = useAuthStore();
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadWorkspace(currentMonth); }, [currentMonth, loadWorkspace]);

  const unavailability = workspace?.unavailability || [];
  const unavailSet = new Set(unavailability.map(u => u.date));
  const calendarDays = getCalendarDays(currentMonth);
  const weekdays = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

  const toggleDate = (date: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { api } = await import('../utils/api');
      await api.post('/unavailability/bulk', {
        month: currentMonth,
        dates: Array.from(selectedDates),
        employeeId: workspace?.employee?.employeeId || name,
      });
      notifications.show({ title: 'Berjaya', message: 'Ketidakhadiran disimpan', color: 'green' });
      loadWorkspace(currentMonth);
    } catch {
      notifications.show({ title: 'Ralat', message: 'Gagal menyimpan', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Ketidakhadiran — {getDisplayMonth(currentMonth)}</Title>
        <Button onClick={handleSave} loading={saving} disabled={selectedDates.size === 0}>
          Simpan ({selectedDates.size} tarikh)
        </Button>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text size="sm" c="dimmed" mb="md">Klik tarikh untuk menanda ketidakhadiran. Tarikh yang ditanda akan diserahkan.</Text>
        <ScrollArea>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>{weekdays.map(d => <Table.Th key={d} style={{ textAlign: 'center' }}>{d}</Table.Th>)}</Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, wi) => (
                <Table.Tr key={wi}>
                  {calendarDays.slice(wi * 7, wi * 7 + 7).map((date, i) => {
                    const isUnavail = date ? unavailSet.has(date) : false;
                    const isSelected = date ? selectedDates.has(date) : false;
                    return (
                      <Table.Td key={i} style={{
                        textAlign: 'center', cursor: date ? 'pointer' : 'default', padding: 12,
                        backgroundColor: isSelected ? '#e3fafc' : isUnavail ? '#fff5f5' : undefined,
                      }} onClick={() => date && toggleDate(date)}>
                        {date && (
                          <Stack gap={2} align="center">
                            <Text size="sm" fw={500}>{parseInt(date.split('-')[2])}</Text>
                            {isUnavail && <Badge color="red" size="xs">Tidak Hadir</Badge>}
                            {isSelected && !isUnavail && <Badge color="cyan" size="xs">Dipilih</Badge>}
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

      {unavailability.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={4} mb="md">Tarikh Tidak Hadir Semasa</Title>
          <Group gap="xs" wrap="wrap">
            {unavailability.sort((a, b) => a.date.localeCompare(b.date)).map(u => (
              <Badge key={u.date} color="red" variant="light">{formatDate(u.date)}</Badge>
            ))}
          </Group>
        </Card>
      )}
    </Stack>
  );
}