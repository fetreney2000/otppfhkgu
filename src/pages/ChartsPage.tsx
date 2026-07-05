import { useEffect, useState } from 'react';
import { Card, Title, Stack, Table, Badge, Text, SimpleGrid, Loader, Center, Tabs, Group } from '@mantine/core';
import { BarChart, DonutChart } from '@mantine/charts';
import { useAppStore } from '../stores/appStore';
import { getDisplayMonth, formatCurrency } from '../utils/dates';
import { ThSort, useSortable } from '../components/SortableTh';

export function ChartsPage() {
  const { currentMonth, rosterSummary, loadRosterSummary, annualData, loadAnnualAllocation } = useAppStore();
  const [loading, setLoading] = useState(false);
  const annualSort = useSortable('annualAE', 'desc');
  const [activeTab, setActiveTab] = useState<string | null>('monthly');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadRosterSummary(currentMonth, 'original'),
      loadAnnualAllocation(currentMonth),
    ]).finally(() => setLoading(false));
  }, [currentMonth, loadRosterSummary, loadAnnualAllocation]);

  const chartData = rosterSummary.map(s => ({
    name: s.employeeId,
    jam: s.totalHours,
    AE: s.aeCount,
    cuti: s.holidayCount,
    hujungMinggu: s.weekendCount,
    hariBekerja: s.weekdayCount,
  }));

  const deptData = [
    { name: 'IPP', value: rosterSummary.filter(s => s.department === 'IPP').reduce((a, s) => a + s.totalHours, 0), color: 'blue' },
    { name: 'OPD', value: rosterSummary.filter(s => s.department === 'OPD').reduce((a, s) => a + s.totalHours, 0), color: 'orange' },
  ];

  const roleData = [
    { name: 'PPF', value: rosterSummary.filter(s => s.role === 'PPF').length, color: 'teal' },
    { name: 'PRA', value: rosterSummary.filter(s => s.role === 'PRA').length, color: 'purple' },
  ];

  const annualEmployees = annualData?.employees || [];

  if (loading) return <Center style={{ height: 400 }}><Loader size="lg" /></Center>;

  return (
    <Stack gap="lg">
      <Title order={2}>Carta — {getDisplayMonth(currentMonth)}</Title>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="monthly">Bulanan</Tabs.Tab>
          <Tabs.Tab value="annual">Tahunan</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="monthly" pt="md">
          <Stack gap="lg">
            {chartData.length > 0 ? (
              <>
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Title order={4} mb="md">Jam OT Mengikut Kakitangan</Title>
                  <BarChart
                    h={300}
                    data={chartData}
                    dataKey="name"
                    series={[{ name: 'jam', color: 'blue.6', label: 'Jam OT' }]}
                    tickLine="y"
                    gridAxis="y"
                  />
                </Card>

                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={4} mb="md">Jam Mengikut Unit</Title>
                    <DonutChart h={200} data={deptData} />
                    <Group justify="center" mt="md">
                      {deptData.map(d => <Badge key={d.name} color={d.color}>{d.name}: {d.value}h</Badge>)}
                    </Group>
                  </Card>
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={4} mb="md">Kakitangan Mengikut Jawatan</Title>
                    <DonutChart h={200} data={roleData} />
                    <Group justify="center" mt="md">
                      {roleData.map(d => <Badge key={d.name} color={d.color}>{d.name}: {d.value}</Badge>)}
                    </Group>
                  </Card>
                </SimpleGrid>

                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Title order={4} mb="md">Taburan Slot</Title>
                  <BarChart
                    h={300}
                    data={chartData}
                    dataKey="name"
                    series={[
                      { name: 'AE', color: 'red.6' },
                      { name: 'cuti', color: 'pink.6' },
                      { name: 'hujungMinggu', color: 'orange.6' },
                      { name: 'hariBekerja', color: 'teal.6' },
                    ]}
                    tickLine="y"
                    gridAxis="y"
                  />
                </Card>
              </>
            ) : (
              <Text c="dimmed" ta="center" py="xl">Tiada data jadual untuk carta</Text>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="annual" pt="md">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">Peruntukan Tahunan</Title>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <ThSort sortKey="employeeId" current={annualSort.sort} onToggle={annualSort.toggle}>ID</ThSort>
                  <ThSort sortKey="name" current={annualSort.sort} onToggle={annualSort.toggle}>Nama</ThSort>
                  <ThSort sortKey="department" current={annualSort.sort} onToggle={annualSort.toggle}>Unit</ThSort>
                  <ThSort sortKey="annualAE" current={annualSort.sort} onToggle={annualSort.toggle}>AE</ThSort>
                  <ThSort sortKey="annualHalfPaidAE" current={annualSort.sort} onToggle={annualSort.toggle}>AE Separuh Gaji</ThSort>
                  <ThSort sortKey="annualPaidAE" current={annualSort.sort} onToggle={annualSort.toggle}>AE Bergaji</ThSort>
                  <ThSort sortKey="annualPHAE" current={annualSort.sort} onToggle={annualSort.toggle}>PH+AE</ThSort>
                  <ThSort sortKey="annualPH" current={annualSort.sort} onToggle={annualSort.toggle}>PH</ThSort>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {annualSort.sortArray(annualEmployees).map(emp => (
                  <Table.Tr key={emp.employeeId}>
                    <Table.Td>{emp.employeeId}</Table.Td>
                    <Table.Td>{emp.name}</Table.Td>
                    <Table.Td><Badge color={emp.department === 'IPP' ? 'blue' : 'orange'} size="xs">{emp.department}</Badge></Table.Td>
                    <Table.Td><Badge color="red" variant="light">{emp.annualAE}</Badge></Table.Td>
                    <Table.Td><Badge color="orange" variant="light">{emp.annualHalfPaidAE}</Badge></Table.Td>
                    <Table.Td><Badge color="green" variant="light">{emp.annualPaidAE}</Badge></Table.Td>
                    <Table.Td><Badge color="purple" variant="light">{emp.annualPHAE}</Badge></Table.Td>
                    <Table.Td><Badge color="pink" variant="light">{emp.annualPH}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}