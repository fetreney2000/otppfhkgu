import { useEffect, useState } from 'react';
import { Card, Title, Group, Stack, Table, Badge, Text, Select, ScrollArea, Loader, Center, SimpleGrid, Paper, Avatar } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { getDisplayMonth, formatDate, getDayName } from '../utils/dates';
import api from '../utils/api';

interface UnavailRecord {
  employeeId: string;
  employeeName: string;
  department: string;
  dates: string[];
}

export function AdminUnavailabilityPage() {
  const { currentMonth, employees, loadEmployees } = useAppStore();
  const [unavailData, setUnavailData] = useState<UnavailRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterDept, setFilterDept] = useState<string | null>(null);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    setLoading(true);
    api.get<{ success: boolean; data: Array<{ employeeId: string; date: string }> }>(`/unavailability?month=${currentMonth}`)
      .then(res => {
        if (res.success && res.data) {
          // Group by employee
          const grouped = new Map<string, string[]>();
          for (const u of res.data) {
            if (!grouped.has(u.employeeId)) grouped.set(u.employeeId, []);
            grouped.get(u.employeeId)!.push(u.date);
          }
          
          const records: UnavailRecord[] = [];
          for (const emp of employees) {
            const dates = grouped.get(emp.employeeId) || [];
            if (dates.length > 0) {
              records.push({
                employeeId: emp.employeeId,
                employeeName: emp.name,
                department: emp.department,
                dates: dates.sort(),
              });
            }
          }
          setUnavailData(records);
        }
      })
      .finally(() => setLoading(false));
  }, [currentMonth, employees]);

  const filtered = filterDept 
    ? unavailData.filter(r => r.department === filterDept) 
    : unavailData;

  // Calculate stats
  const totalEmployees = unavailData.length;
  const totalDates = unavailData.reduce((sum, r) => sum + r.dates.length, 0);
  const ippCount = unavailData.filter(r => r.department === 'IPP').length;
  const opdCount = unavailData.filter(r => r.department === 'OPD').length;

  const weekdays = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

  // Build date heatmap
  const dateCountMap = new Map<string, number>();
  for (const r of unavailData) {
    for (const d of r.dates) {
      dateCountMap.set(d, (dateCountMap.get(d) || 0) + 1);
    }
  }

  const calendarDays = (() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const firstDay = new Date(Date.UTC(y, m - 1, 1));
    const lastDay = new Date(Date.UTC(y, m, 0));
    const startDow = firstDay.getUTCDay();
    const offset = startDow === 0 ? 6 : startDow - 1;
    const days: (string | null)[] = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getUTCDate(); d++) {
      days.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  })();

  return (
    <Stack gap="lg">
      <Title order={2}>Ketidakhadiran Kakitangan — {getDisplayMonth(currentMonth)}</Title>

      {/* Stats */}
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <Paper shadow="xs" p="md" withBorder>
          <Text size="xs" c="dimmed">Kakitangan Tidak Hadir</Text>
          <Title order={3}>{totalEmployees}</Title>
        </Paper>
        <Paper shadow="xs" p="md" withBorder>
          <Text size="xs" c="dimmed">Jumlah Tarikh</Text>
          <Title order={3}>{totalDates}</Title>
        </Paper>
        <Paper shadow="xs" p="md" withBorder>
          <Text size="xs" c="dimmed">Unit IPP</Text>
          <Title order={3}>{ippCount}</Title>
          <Badge color="blue" size="lg">IPP</Badge>
        </Paper>
        <Paper shadow="xs" p="md" withBorder>
          <Text size="xs" c="dimmed">Unit OPD</Text>
          <Title order={3}>{opdCount}</Title>
          <Badge color="orange" size="lg">OPD</Badge>
        </Paper>
      </SimpleGrid>

      {/* Date Heatmap */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Peta Tarikh Ketidakhadiran</Title>
        <Text size="sm" c="dimmed" mb="md">Semakin gelap = semakin ramai kakitangan tidak hadir pada tarikh tersebut</Text>
        <ScrollArea>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>{weekdays.map(d => <Table.Th key={d} style={{ textAlign: 'center' }}>{d}</Table.Th>)}</Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, wi) => (
                <Table.Tr key={wi}>
                  {calendarDays.slice(wi * 7, wi * 7 + 7).map((date, i) => {
                    const count = date ? (dateCountMap.get(date) || 0) : 0;
                    const intensity = count === 0 ? 'transparent' : count <= 2 ? '#e3fafc' : count <= 4 ? '#b2f2f2' : '#80e0d0';
                    return (
                      <Table.Td key={i} style={{ textAlign: 'center', padding: 8, backgroundColor: intensity, cursor: 'default' }}>
                        {date && (
                          <Stack gap={1} align="center">
                            <Text size="sm" fw={500}>{parseInt(date.split('-')[2])}</Text>
                            {count > 0 && <Badge color="red" size="xs">{count} tidak hadir</Badge>}
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

      {/* Filter */}
      <Group>
        <Text fw={500}>Filter mengikut unit:</Text>
        <Select
          data={[
            { value: '', label: 'Semua' },
            { value: 'IPP', label: 'IPP' },
            { value: 'OPD', label: 'OPD' },
          ]}
          value={filterDept || ''}
          onChange={val => setFilterDept(val || null)}
          size="sm"
          styles={{ input: { width: 120 } }}
          clearable
        />
        <Text size="sm" c="dimmed">{filtered.length} kakitangan</Text>
      </Group>

      {/* Employee List */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Senarai Kakitangan Tidak Hadir</Title>
        {loading ? (
          <Center style={{ height: 200 }}><Loader size="md" /></Center>
        ) : (
          <ScrollArea style={{ maxHeight: 500 }}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th>Tarikh Tidak Hadir</Table.Th>
                  <Table.Th>Jumlah</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map(r => (
                  <Table.Tr key={r.employeeId}>
                    <Table.Td><Badge>{r.employeeId}</Badge></Table.Td>
                    <Table.Td fw={500}>{r.employeeName}</Table.Td>
                    <Table.Td><Badge color={r.department === 'IPP' ? 'blue' : 'orange'}>{r.department}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="wrap">
                        {r.dates.map(d => (
                          <Badge key={d} color="red" variant="light" size="xs">{formatDate(d)}</Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td><Badge color="red">{r.dates.length} hari</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
        {filtered.length === 0 && <Text c="dimmed" ta="center" py="xl">Tiada kakitangan tidak hadir bulan ini</Text>}
      </Card>
    </Stack>
  );
}