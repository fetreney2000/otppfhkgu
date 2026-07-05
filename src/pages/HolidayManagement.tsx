import { useEffect, useState } from 'react';
import { Card, TextInput, Button, Title, Group, Stack, ActionIcon, Text, Badge } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useAppStore } from '../stores/appStore';
import { getDisplayMonth, formatDate, getDayName } from '../utils/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';

export function HolidayManagement() {
  const { currentMonth, holidays, loadHolidays, addHoliday, deleteHoliday } = useAppStore();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => { loadHolidays(currentMonth); }, [currentMonth, loadHolidays]);

  const handleAdd = async () => {
    if (!date || !name.trim()) return;
    try {
      await addHoliday(date, name.trim());
      setName(''); setDate('');
      notifications.show({ title: 'Berjaya', message: 'Cuti umum ditambah', color: 'green' });
    } catch { notifications.show({ title: 'Ralat', message: 'Gagal menambah', color: 'red' }); }
  };

  const handleDelete = async (d: string) => {
    try {
      await deleteHoliday(d);
      await loadHolidays(currentMonth);
      notifications.show({ title: 'Berjaya', message: 'Cuti umum dipadam', color: 'green' });
    } catch { notifications.show({ title: 'Ralat', message: 'Gagal memadam', color: 'red' }); }
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Cuti Umum — {getDisplayMonth(currentMonth)}</Title>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group grow mb="md">
          <DatePickerInput
            value={date ? new Date(date) : null}
            onChange={(val) => {
              if (val) {
                const d = new Date(val);
                if (!isNaN(d.getTime())) setDate(d.toISOString().split('T')[0]);
              } else {
                setDate('');
              }
            }}
            placeholder="Pilih Tarikh"
            valueFormat="DD-MM-YYYY"
            clearable
            size="sm"
          />
          <TextInput label="Nama Cuti" value={name} onChange={e => setName(e.currentTarget.value)} placeholder="cth. Hari Merdeka" />
          <Button leftSection={<IconPlus size={16} />} onClick={handleAdd} size="sm">Tambah</Button>
        </Group>
        <Stack gap="xs">
          {holidays.map(h => (
            <Group key={h.date} justify="space-between" p="sm" style={{ background: '#f8f9fa', borderRadius: 'md' }}>
              <Group gap="sm">
                <Badge color="pink" variant="light" size="lg">{formatDate(h.date)}</Badge>
                <Badge color="gray" variant="outline" size="sm">{getDayName(h.date)}</Badge>
                <Text fw={500} size="sm">{h.name}</Text>
              </Group>
              <ActionIcon color="red" variant="subtle" onClick={() => handleDelete(h.date)} size="sm"><IconTrash size={14} /></ActionIcon>
            </Group>
          ))}
          {holidays.length === 0 && <Text c="dimmed" ta="center" py="xl">Tiada cuti umum bulan ini</Text>}
        </Stack>
      </Card>
    </Stack>
  );
}