import { useEffect, useState } from 'react';
import { Card, Title, Stack, TextInput, Select, NumberInput, Button, Group, Badge, Text, Avatar } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';
import api from '../utils/api';
import type { Employee } from '../types';

export function ProfilePage() {
  const { name, role } = useAuthStore();
  const [profile, setProfile] = useState<Employee | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formSalary, setFormSalary] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<{ success: boolean; data: Employee }>('/profile')
      .then(res => {
        if (res.success && res.data) {
          setProfile(res.data);
          setFormName(res.data.name);
          setFormEmail(res.data.email);
          setFormDept(res.data.department);
          setFormSalary(res.data.salary);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/profile', { Name: formName, Email: formEmail, Department: formDept, Salary: formSalary });
      notifications.show({ title: 'Berjaya', message: 'Profil dikemaskini', color: 'green' });
    } catch {
      notifications.show({ title: 'Ralat', message: 'Gagal mengemaskini profil', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const roleColor = role === 'superadmin' ? 'red' : role === 'admin' ? 'blue' : 'green';

  return (
    <Stack gap="lg">
      <Title order={2}>Profil Saya</Title>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="lg">
          <Avatar size={64} color={roleColor} radius="xl">{(name || 'U').charAt(0).toUpperCase()}</Avatar>
          <div>
            <Title order={3}>{name}</Title>
            <Badge color={roleColor} size="lg">{role === 'superadmin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Kakitangan'}</Badge>
          </div>
        </Group>

        {profile && (
          <Stack>
            <Group grow>
              <TextInput label="Nama" value={formName} onChange={e => setFormName(e.currentTarget.value)} />
              <TextInput label="E-mel" value={formEmail} onChange={e => setFormEmail(e.currentTarget.value)} />
            </Group>
            <Group grow>
              <Select label="Unit" data={['IPP', 'OPD']} value={formDept} onChange={v => setFormDept(v || '')} />
              <NumberInput label="Gaji Pokok (RM)" value={formSalary} onChange={v => setFormSalary(Number(v) || 0)} min={0} thousandSeparator="," />
            </Group>
            <Group grow>
              <TextInput label="ID Kakitangan" value={profile.employeeId} disabled />
              <TextInput label="Jawatan" value={profile.role} disabled />
            </Group>
            <Group grow>
              <TextInput label="Jam Max/Bulan" value={String(profile.maxHoursPerMonth)} disabled />
              <div>
                <Text size="xs" c="dimmed" mb={4}>Peruntukan Tahunan</Text>
                <Group gap="xs">
                  <Badge color="red" variant="light">AE: {profile.annualAE}</Badge>
                  <Badge color="pink" variant="light">PH: {profile.annualPH}</Badge>
                  <Badge color="green" variant="light">AE Bergaji: {profile.annualPaidAE}</Badge>
                </Group>
              </div>
            </Group>
            <Button onClick={handleSave} loading={saving} style={{ alignSelf: 'flex-start' }}>Kemaskini Profil</Button>
          </Stack>
        )}
      </Card>
    </Stack>
  );
}