import { useState, useRef, useCallback } from 'react';
import { Card, Title, Button, Group, Stack, Text, Progress, Badge, Alert, Loader, Center, Modal, SegmentedControl } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { getDisplayMonth } from '../utils/dates';
import { notifications } from '@mantine/notifications';
import { IconPlayerPlay, IconCopy, IconRefresh, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import type { SolverProgress, SolverResult, SolverInputData } from '../types';

export function RosterGenerationPage() {
  const { currentMonth, generateRosterData, saveRoster, generateRosterCopy, setSolverProgress, solverProgress } = useAppStore();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  const handleGenerate = useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    setProgressModalOpen(true);
    setSolverProgress({ type: 'progress', percent: 0, stage: 'init', stageLabel: 'Menyediakan data...', message: 'Memuat data dari pelayan', attempt: 0, totalAttempts: 0, bestUnfilled: 0 });

    try {
      // 1. Fetch solver data from server
      const data: SolverInputData | null = await generateRosterData(currentMonth);
      if (!data) {
        notifications.show({ title: 'Ralat', message: 'Gagal mendapat data jadual', color: 'red' });
        setIsRunning(false);
        setProgressModalOpen(false);
        return;
      }

      // 2. Spawn web worker
      let worker: Worker;
      try {
        worker = new Worker(new URL('../workers/rosterSolver.worker.ts', import.meta.url), { type: 'module' });
      } catch (workerErr) {
        console.error('Failed to create worker:', workerErr);
        notifications.show({ title: 'Ralat', message: 'Gagal mencipta Web Worker solver', color: 'red' });
        setIsRunning(false);
        setProgressModalOpen(false);
        return;
      }
      workerRef.current = worker;

      worker.onmessage = async (e: MessageEvent<SolverProgress | SolverResult>) => {
        if (e.data.type === 'progress') {
          setSolverProgress(e.data as SolverProgress);
        } else if (e.data.type === 'result') {
          const res = e.data as SolverResult;
          setResult(res);
          setIsRunning(false);
          worker.terminate();
          workerRef.current = null;

          if (res.success || res.assignments.length > 0) {
            notifications.show({ title: 'Berjaya', message: `Jadual dijana: ${res.assignments.length} tugasan`, color: 'green' });
            // Save in background — don't await
            saveRoster(currentMonth, res.assignments, res.objective, res.solverMode, res.elapsedSeconds, res.warnings)
              .catch(() => notifications.show({ title: 'Ralat', message: 'Gagal menyimpan jadual ke pangkalan data', color: 'red' }));
          } else {
            notifications.show({ title: 'Amaran', message: 'Penyelesaian tidak lengkap', color: 'orange' });
          }
        }
      };

      worker.onerror = (err) => {
        console.error('Worker error:', err);
        notifications.show({ title: 'Ralat', message: 'Ralat solver', color: 'red' });
        setIsRunning(false);
        worker.terminate();
        workerRef.current = null;
      };

      // 3. Start solver
      worker.postMessage({ type: 'start', data });
    } catch (err) {
      console.error('Generate error:', err);
      notifications.show({ title: 'Ralat', message: 'Gagal menjana jadual', color: 'red' });
      setIsRunning(false);
    }
  }, [currentMonth, generateRosterData, saveRoster, setSolverProgress]);

  const handleCancel = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'cancel' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsRunning(false);
    setProgressModalOpen(false);
    notifications.show({ title: 'Dibatalkan', message: 'Penjanaan jadual dibatalkan', color: 'orange' });
  };

  const handleGenerateCopy = async () => {
    try {
      await generateRosterCopy(currentMonth);
      notifications.show({ title: 'Berjaya', message: 'Salinan jadual dijana', color: 'green' });
    } catch {
      notifications.show({ title: 'Ralat', message: 'Gagal menjana salinan', color: 'red' });
    }
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Penjanaan Jadual — {getDisplayMonth(currentMonth)}</Title>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Operasi Penjanaan</Title>
        <Group>
          <Button size="lg" leftSection={<IconPlayerPlay size={20} />} onClick={handleGenerate} loading={isRunning} disabled={isRunning}>
            Jana Jadual OT
          </Button>
          <Button variant="outline" size="lg" leftSection={<IconCopy size={20} />} onClick={handleGenerateCopy} disabled={isRunning}>
            Hasilkan Salinan
          </Button>
        </Group>
        <Text size="sm" c="dimmed" mt="md">
          Penjanaan jadual berlaku pada pelayar anda menggunakan Web Worker. Proses ini mungkin mengambil masa 1-2 minit.
        </Text>
      </Card>

      {result && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={4} mb="md">Keputusan Penjanaan</Title>
          <Stack>
            <Group>
              <Badge color={result.success ? 'green' : 'orange'} size="lg">{result.success ? 'Berjaya' : 'Selesai dengan amaran'}</Badge>
              <Badge color="blue">Mod: {result.solverMode}</Badge>
              <Badge color="gray">Masa: {result.elapsedSeconds.toFixed(1)}s</Badge>
            </Group>
            <Text>Tugasan: {result.assignments.length} slot</Text>
            <Text>Tidak diisi: {result.unfilledCount} slot</Text>
            {result.objective && (
              <Group>
                <Text size="sm">Penalti Keras: {result.objective.hardPenalty}</Text>
                <Text size="sm">Penalti Lembut: {result.objective.softPenalty}</Text>
                <Text size="sm">Jam Ditugaskan: {result.objective.assignedHours}</Text>
              </Group>
            )}
            {result.warnings.length > 0 && (
              <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Amaran">
                <Stack gap={4}>
                  {result.warnings.slice(0, 10).map((w, i) => <Text key={i} size="xs">{w}</Text>)}
                  {result.warnings.length > 10 && <Text size="xs">...dan {result.warnings.length - 10} lagi</Text>}
                </Stack>
              </Alert>
            )}
          </Stack>
        </Card>
      )}

      {/* Progress Modal */}
      <Modal opened={progressModalOpen} onClose={() => !isRunning && setProgressModalOpen(false)} title="Penjanaan Jadual" centered closeOnClickOutside={!isRunning} closeOnEscape={!isRunning}>
        <Stack>
          {solverProgress && (
            <>
              <Text fw={500}>{solverProgress.stageLabel}</Text>
              <Text size="sm" c="dimmed">{solverProgress.message}</Text>
              <Progress
                value={solverProgress.percent}
                animated
                striped={solverProgress.stage !== 'validate'}
                size="xl"
                color={solverProgress.stage === 'validate' ? 'yellow' : solverProgress.stage === 'done' ? 'green' : 'blue'}
              />
              <Group justify="space-between">
                <Text size="xs">{solverProgress.percent.toFixed(0)}%</Text>
                {solverProgress.bestUnfilled > 0 && <Text size="xs" c="orange">Slot terbaik belum diisi: {solverProgress.bestUnfilled}</Text>}
                {solverProgress.attempt > 0 && <Text size="xs">Cubaan {solverProgress.attempt}/{solverProgress.totalAttempts}</Text>}
              </Group>
              {solverProgress.validationRound !== undefined && solverProgress.validationRound > 0 && (
                <Group gap="xs">
                  <Badge color="yellow" variant="light" size="sm">Validasi Pusingan {solverProgress.validationRound}/{solverProgress.validationMaxRounds}</Badge>
                  {solverProgress.validationViolations !== undefined && solverProgress.validationViolations > 0 && (
                    <Badge color="red" variant="light" size="sm">{solverProgress.validationViolations} pelanggaran</Badge>
                  )}
                  {solverProgress.validationViolations !== undefined && solverProgress.validationViolations === 0 && (
                    <Badge color="green" variant="light" size="sm">✓ Semua peraturan dipenuhi</Badge>
                  )}
                </Group>
              )}
            </>
          )}
          {!solverProgress && (
            <Center style={{ height: 100 }}><Loader size="md" /></Center>
          )}
          {isRunning && (
            <Group justify="flex-end">
              <Button color="red" variant="outline" onClick={handleCancel}>Batal</Button>
            </Group>
          )}
          {!isRunning && result && (
            <Group justify="flex-end">
              <Button leftSection={<IconCheck size={16} />} onClick={() => setProgressModalOpen(false)}>Tutup</Button>
            </Group>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}