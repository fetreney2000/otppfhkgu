import { useEffect, useState } from 'react';
import { Table, Button, Title, Group, Stack, Modal, TextInput, Select, NumberInput, Switch, ActionIcon, Text, Badge, Loader, Center } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconPencil, IconTrash } from '@tabler/icons-react';
import type { Employee, Department, EmployeeRole } from '../types';

export function EmployeeManagement() {
  const { employees, loadEmployees, createEmployee, updateEmployee, deleteEmployee, loading } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    employeeId: '', name: '', department: 'IPP' as Department, role: 'PPF' as EmployeeRole,
    email: '', maxHoursPerMonth: 40, salary: 0, password: '', active: true,
  });

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const openNew = () => {
    setEditId(null);
    setForm({ employeeId: '', name: '', department: 'IPP', role: 'PPF', email: '', maxHoursPerMonth: 40, salary: 0, password: '', active: true });
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditId(emp._id);
    setForm({
      employeeId: emp.employeeId, name: emp.name, department: emp.department,
      role: emp.role, email: emp.email, maxHoursPerMonth: emp.maxHoursPerMonth,
      salary: emp.salary, password: '', active: emp.active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editId) {
        const update: Record<string, unknown> = { ...form };
        if (!form.password) delete update.password;
        await updateEmployee(editId, update as Partial<Employee>);
        notifications.show({ title: 'Berjaya', message: 'Kakitangan dikemaskini', color: 'green' });
      } else {
        if (!form.password) { notifications.show({ title: 'Ralat', message: 'Kata laluan diperlukan', color: 'red' }); return; }
        await createEmployee(form as Partial<Employee>);
        notifications.show({ title: 'Berjaya', message: 'Kakitangan ditambah', color: 'green' });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      notifications.show({ title: 'Ralat', message: err instanceof Error ? err.message : 'Gagal menyimpan', color: 'red' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Padam kakitangan ini?')) return;
    try {
      await deleteEmployee(id);
      notifications.show({ title: 'Berjaya', message: 'Kakitangan dipadam', color: 'green' });
    } catch {
      notifications.show({ title: 'Ralat', message: 'Gagal memadam', color: 'red' });
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Pengurusan Kakitangan</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openNew}>Tambah Kakitangan</Button>
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th><Table.Th>Nama</Table.Th><Table.Th>Unit</Table.Th>
            <Table.Th>Jawatan</Table.Th><Table.Th>E-mel</Table.Th><Table.Th>Gaji</Table.Th>
            <Table.Th>Jam Max</Table.Th><Table.Th>Status</Table.Th><Table.Th>Tindakan</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {employees.map(emp => (
            <Table.Tr key={emp._id}>
              <Table.Td>{emp.employeeId}</Table.Td>
              <Table.Td>{emp.name}</Table.Td>
              <Table.Td><Badge color={emp.department === 'IPP' ? 'blue' : 'orange'}>{emp.department}</Badge></Table.Td>
              <Table.Td><Badge color={emp.role === 'PPF' ? 'green' : 'purple'}>{emp.role}</Badge></Table.Td>
              <Table.Td>{emp.email}</Table.Td>
              <Table.Td>RM {emp.salary.toLocaleString()}</Table.Td>
              <Table.Td>{emp.maxHoursPerMonth}h</Table.Td>
              <Table.Td><Badge color={emp.active ? 'green' : 'red'}>{emp.active ? 'Aktif' : 'Tidak Aktif'}</Badge></Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon variant="light" color="blue" onClick={() => openEdit(emp)}><IconPencil size={16} /></ActionIcon>
                  <ActionIcon variant="light" color="red" onClick={() => handleDelete(emp._id)}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {employees.length === 0 && !loading.employees && (
        <Center style={{ height: 200 }}>
          <Text c="dimmed">Tiada kakitangan. Klik "Tambah Kakitangan" untuk menambah.</Text>
        </Center>
      )}

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Kemaskini Kakitangan' : 'Tambah Kakitangan'} size="lg">
        <Stack>
          <Group grow>
            <TextInput label="ID Kakitangan" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.currentTarget.value }))} required />
            <TextInput label="Nama" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.currentTarget.value }))} required />
          </Group>
          <Group grow>
            <Select label="Unit" data={['IPP', 'OPD']} value={form.department} onChange={v => setForm(f => ({ ...f, department: (v || 'IPP') as Department }))} />
            <Select label="Jawatan" data={['PPF', 'PRA']} value={form.role} onChange={v => setForm(f => ({ ...f, role: (v || 'PPF') as EmployeeRole }))} />
          </Group>
          <TextInput label="E-mel" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.currentTarget.value }))} required />
          <Group grow>
            <NumberInput label="Gaji Pokok (RM)" value={form.salary} onChange={v => setForm(f => ({ ...f, salary: Number(v) || 0 }))} min={0} thousandSeparator="," />
            <NumberInput label="Jam Max/Bulan" value={form.maxHoursPerMonth} onChange={v => setForm(f => ({ ...f, maxHoursPerMonth: Number(v) || 40 }))} min={1} max={80} />
          </Group>
          <TextInput label={editId ? 'Kata Laluan Baru (kosong = tidak tukar)' : 'Kata Laluan'} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.currentTarget.value }))} required={!editId} />
          <Switch label="Aktif" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.currentTarget.checked }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave}>Simpan</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}