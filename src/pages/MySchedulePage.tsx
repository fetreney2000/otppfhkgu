import { useEffect, useState } from 'react';
import { Card, Title, Group, Stack, Badge, Text, SegmentedControl, SimpleGrid, Loader, Center } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { getDisplayMonth, formatDate, getDayName, formatCurrency } from '../utils/dates';
import { IconClock, IconMapPin, IconCash } from '@tabler/icons-react';
import type { RosterRow } from '../types';

export function MySchedulePage() {
  const { currentMonth, employeeData, loadEmployeeDashboard, loadRosterSummary } = useAppStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadEmployeeDashboard(currentMonth).finally(() => setLoading(false));
  }, [currentMonth, loadEmployeeDashboard]);

  const schedule = employeeData?.schedule || [];
  const profile = employeeData?.profile;

  // Sort by date then slot type
  const sortedSchedule = [...schedule].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.slotType.localeCompare(b.slotType);
  });

  const totalHours = sortedSchedule.reduce((s, r) => s + r.hours, 0);

  if (loading) return <Center style={{ height: 400 }}><Loader size="lg" /></Center>;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Jadual Saya — {getDisplayMonth(currentMonth)}</Title>
      </Group>

      {profile && (
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Card shadow="xs" padding="md" withBorder>
            <Text size="xs" c="dimmed">Unit</Text>
            <Badge color={profile.department === 'IPP' ? 'blue' : 'orange'} size="lg">{profile.department}</Badge>
          </Card>
          <Card shadow="xs" padding="md" withBorder>
            <Text size="xs" c="dimmed">Jawatan</Text>
            <Badge color="green" size="lg">{profile.role}</Badge>
          </Card>
          <Card shadow="xs" padding="md" withBorder>
            <Text size="xs" c="dimmed">Jumlah Jam</Text>
            <Title order={3}>{totalHours}h</Title>
          </Card>
          <Card shadow="xs" padding="md" withBorder>
            <Text size="xs" c="dimmed">Jumlah Tugasan</Text>
            <Title order={3}>{sortedSchedule.length}</Title>
          </Card>
        </SimpleGrid>
      )}

      <Stack gap="sm">
        {sortedSchedule.map((row, i) => (
          <Card key={`${row.date}-${row.slotType}-${i}`} shadow="xs" padding="md" withBorder>
            <Group justify="space-between">
              <Group>
                <Badge color="blue" variant="light">{formatDate(row.date)}</Badge>
                <Text size="sm" fw={500}>{getDayName(row.date)}</Text>
                <Badge color={row.slotType === 'AE' ? 'red' : row.slotType.startsWith('IPP') ? 'blue' : row.slotType.startsWith('OPD') ? 'orange' : 'grape'}>
                  {row.slotType}
                </Badge>
              </Group>
              <Group gap="md">
                <Group gap={4}><IconClock size={14} /><Text size="sm">{row.hours}h</Text></Group>
                <Group gap={4}><IconMapPin size={14} /><Text size="sm">{row.department}</Text></Group>
              </Group>
            </Group>
          </Card>
        ))}
        {sortedSchedule.length === 0 && (
          <Center style={{ height: 200 }}>
            <Text c="dimmed">Tiada tugasan OT bulan ini</Text>
          </Center>
        )}
      </Stack>
    </Stack>
  );
}