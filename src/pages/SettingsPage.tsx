import { useEffect, useState } from 'react';
import { Card, Title, Stack, TextInput, NumberInput, Button, Group, Text, Divider, PasswordInput } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { notifications } from '@mantine/notifications';
import { SOLVER_DEFAULTS } from '../types';

export function SettingsPage() {
  const { config, loadConfig, saveSettings } = useAppStore();
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [cutoffDay, setCutoffDay] = useState(15);
  const [solverConfig, setSolverConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    setAdminName(config.AdminName || 'admin');
    setCutoffDay(parseInt(config.UnavailabilityCutoffDay || '15'));
    const sc: Record<string, string> = {};
    Object.keys(SOLVER_DEFAULTS).forEach(k => {
      sc[k] = config[k] || SOLVER_DEFAULTS[k];
    });
    setSolverConfig(sc);
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        adminName,
        cutoffDay,
        ...solverConfig,
        ...(adminPassword ? { adminPassword } : {}),
      });
      notifications.show({ title: 'Berjaya', message: 'Tetapan disimpan', color: 'green' });
      setAdminPassword('');
    } catch {
      notifications.show({ title: 'Ralat', message: 'Gagal menyimpan tetapan', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Tetapan</Title>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Tetapan Admin</Title>
        <Stack>
          <TextInput label="Nama Admin" value={adminName} onChange={e => setAdminName(e.currentTarget.value)} />
          <PasswordInput label="Kata Laluan Admin Baru" value={adminPassword} onChange={e => setAdminPassword(e.currentTarget.value)} placeholder="Kosongkan jika tidak mahu tukar" />
          <NumberInput label="Tarikh Potongan Ketidakhadiran" value={cutoffDay} onChange={v => setCutoffDay(Number(v) || 15)} min={1} max={28} />
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Parameter Solver</Title>
        <Stack>
          {Object.entries(solverConfig).map(([key, value]) => (
            <TextInput key={key} label={key.replace(/_/g, ' ')} value={value}
              onChange={e => setSolverConfig(sc => ({ ...sc, [key]: e.currentTarget.value }))} />
          ))}
        </Stack>
      </Card>

      <Group>
        <Button onClick={handleSave} loading={saving}>Simpan Tetapan</Button>
      </Group>
    </Stack>
  );
}