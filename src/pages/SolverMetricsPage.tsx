import { useEffect, useState } from 'react';
import { Card, Title, Stack, Table, Badge, Text, Group, Button, TextInput, ScrollArea, Loader, Center } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { BarChart } from '@mantine/charts';
import dayjs from 'dayjs';

export function SolverMetricsPage() {
  const { solverMetrics, loadSolverMetrics } = useAppStore();
  const [monthFrom, setMonthFrom] = useState(dayjs().subtract(6, 'month').format('YYYY-MM'));
  const [monthTo, setMonthTo] = useState(dayjs().format('YYYY-MM'));
  const [loading, setLoading] = useState(false);

  const handleLoad = () => {
    setLoading(true);
    loadSolverMetrics(monthFrom, monthTo).finally(() => setLoading(false));
  };

  useEffect(() => { handleLoad(); }, []);

  const chartData = solverMetrics.slice().reverse().map(m => ({
    name: m.month,
    penaltiKeras: m.hardPenalty,
    penaltiLembut: m.softPenalty,
    liputan: m.coveragePct,
    masa: m.elapsedSeconds,
  }));

  return (
    <Stack gap="lg">
      <Title order={2}>Metrik Solver</Title>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="md">
          <TextInput type="month" label="Dari" value={monthFrom} onChange={e => setMonthFrom(e.currentTarget.value)} />
          <TextInput type="month" label="Hingga" value={monthTo} onChange={e => setMonthTo(e.currentTarget.value)} />
          <Button onClick={handleLoad} loading={loading} style={{ marginTop: 24 }}>Muat</Button>
        </Group>
      </Card>

      {chartData.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={4} mb="md">Trend Penalti</Title>
          <BarChart
            h={300}
            data={chartData}
            dataKey="name"
            series={[
              { name: 'penaltiKeras', color: 'red.6', label: 'Penalti Keras' },
              { name: 'penaltiLembut', color: 'orange.6', label: 'Penalti Lembut' },
            ]}
            tickLine="y"
            gridAxis="y"
          />
        </Card>
      )}

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Data Metrik</Title>
        {loading ? <Center style={{ height: 200 }}><Loader /></Center> : (
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Bulan</Table.Th><Table.Th>Mod</Table.Th><Table.Th>Masa(s)</Table.Th>
                  <Table.Th>Slot</Table.Th><Table.Th>Diisi</Table.Th><Table.Th>Liputan%</Table.Th>
                  <Table.Th>Keras</Table.Th><Table.Th>Lembut</Table.Th><Table.Th>Melebihi 1/3</Table.Th><Table.Th>Dev Jam</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {solverMetrics.map(m => (
                  <Table.Tr key={m.runId}>
                    <Table.Td><Badge>{m.month}</Badge></Table.Td>
                    <Table.Td>{m.solverMode}</Table.Td>
                    <Table.Td>{m.elapsedSeconds.toFixed(1)}</Table.Td>
                    <Table.Td>{m.totalSlots}</Table.Td>
                    <Table.Td>{m.assignedSlots}</Table.Td>
                    <Table.Td><Badge color={m.coveragePct >= 100 ? 'green' : 'orange'}>{m.coveragePct.toFixed(1)}%</Badge></Table.Td>
                    <Table.Td>{m.hardPenalty}</Table.Td>
                    <Table.Td>{m.softPenalty}</Table.Td>
                    <Table.Td>{m.exceedOneThirdCount}</Table.Td>
                    <Table.Td>{m.roleHoursDeviation.toFixed(1)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
        {!loading && solverMetrics.length === 0 && <Text c="dimmed" ta="center" py="xl">Tiada data metrik</Text>}
      </Card>
    </Stack>
  );
}