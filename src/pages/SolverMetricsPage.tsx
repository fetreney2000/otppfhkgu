import { useEffect, useState } from 'react';
import { Card, Title, Stack, Table, Badge, Text, Group, Button, ScrollArea, Loader, Center } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { useAppStore } from '../stores/appStore';
import { ThSort, useSortable } from '../components/SortableTh';
import { BarChart } from '@mantine/charts';
import dayjs from 'dayjs';

export function SolverMetricsPage() {
  const { solverMetrics, loadSolverMetrics } = useAppStore();
  const [monthFrom, setMonthFrom] = useState(dayjs().subtract(6, 'month').format('YYYY-MM'));
  const [monthTo, setMonthTo] = useState(dayjs().format('YYYY-MM'));
  const metricsSort = useSortable('generatedAt', 'desc');
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
          <MonthPickerInput
            value={monthFrom ? new Date(parseInt(monthFrom.split('-')[0]), parseInt(monthFrom.split('-')[1]) - 1, 1) : null}
            onChange={(value: any) => {
              const d = new Date(value);
              if (!isNaN(d.getTime())) {
                setMonthFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
              }
            }}
            label="Dari"
            size="sm"
            clearable={false}
          />
          <MonthPickerInput
            value={monthTo ? new Date(parseInt(monthTo.split('-')[0]), parseInt(monthTo.split('-')[1]) - 1, 1) : null}
            onChange={(value: any) => {
              const d = new Date(value);
              if (!isNaN(d.getTime())) {
                setMonthTo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
              }
            }}
            label="Hingga"
            size="sm"
            clearable={false}
          />
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
                  <ThSort sortKey="month" current={metricsSort.sort} onToggle={metricsSort.toggle}>Bulan</ThSort>
                  <ThSort sortKey="solverMode" current={metricsSort.sort} onToggle={metricsSort.toggle}>Mod</ThSort>
                  <ThSort sortKey="elapsedSeconds" current={metricsSort.sort} onToggle={metricsSort.toggle}>Masa(s)</ThSort>
                  <ThSort sortKey="totalSlots" current={metricsSort.sort} onToggle={metricsSort.toggle}>Slot</ThSort>
                  <ThSort sortKey="assignedSlots" current={metricsSort.sort} onToggle={metricsSort.toggle}>Diisi</ThSort>
                  <ThSort sortKey="coveragePct" current={metricsSort.sort} onToggle={metricsSort.toggle}>Liputan%</ThSort>
                  <ThSort sortKey="hardPenalty" current={metricsSort.sort} onToggle={metricsSort.toggle}>Keras</ThSort>
                  <ThSort sortKey="softPenalty" current={metricsSort.sort} onToggle={metricsSort.toggle}>Lembut</ThSort>
                  <ThSort sortKey="exceedOneThirdCount" current={metricsSort.sort} onToggle={metricsSort.toggle}>Melebihi 1/3</ThSort>
                  <ThSort sortKey="roleHoursDeviation" current={metricsSort.sort} onToggle={metricsSort.toggle}>Dev Jam</ThSort>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {metricsSort.sortArray(solverMetrics).map(m => (
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