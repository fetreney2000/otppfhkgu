import { AppShell, Burger, Group, Title, Text, Badge, Button, NavLink, ScrollArea, Divider, ActionIcon, Tooltip, Menu, Avatar, UnstyledButton, Flex } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import {
  IconLayoutDashboard, IconUsers, IconCalendarEvent, IconCalendarDue,
  IconCalendarStats, IconCalendarCog, IconFileText, IconClockCancel,
  IconCalendarTime, IconChartBar, IconSettings, IconUserCircle,
  IconHelp, IconMicroscope, IconLogout, IconWifi, IconWifiOff,
  IconChevronDown,
} from '@tabler/icons-react';

const adminNavItems = [
  { label: 'Papan Pemuka', path: '/admin', icon: IconLayoutDashboard, roles: ['admin', 'superadmin'] },
  { label: 'Kakitangan', path: '/employees', icon: IconUsers, roles: ['admin', 'superadmin'] },
  { label: 'Cuti Umum', path: '/holidays', icon: IconCalendarEvent, roles: ['admin', 'superadmin'] },
  { label: 'Tugasan AE', path: '/ae-assignments', icon: IconCalendarDue, roles: ['admin', 'superadmin'] },
  { label: 'Pra-pilihan', path: '/preselections', icon: IconCalendarStats, roles: ['admin', 'superadmin'] },
  { label: 'Jana Jadual', path: '/roster-generation', icon: IconCalendarCog, roles: ['admin', 'superadmin'] },
  { label: 'Tetapan', path: '/settings', icon: IconSettings, roles: ['admin', 'superadmin'] },
];

const commonNavItems = [
  { label: 'Jadual Saya', path: '/my-schedule', icon: IconCalendarTime },
  { label: 'Laporan', path: '/reports', icon: IconFileText },
  { label: 'Ketidakhadiran', path: '/unavailability', icon: IconClockCancel },
  { label: 'Carta', path: '/charts', icon: IconChartBar },
];

const superAdminNavItems = [
  { label: 'Metrik Solver', path: '/solver-metrics', icon: IconMicroscope, roles: ['superadmin'] },
];

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure(false);
  const { name, role, logout } = useAuthStore();
  const { isOnline, currentMonth, setCurrentMonth } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabel = role === 'superadmin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Kakitangan';
  const roleColor = role === 'superadmin' ? 'red' : role === 'admin' ? 'blue' : 'green';

  const handleMonthChange = (value: string | null) => {
    if (value) {
      const monthStr = value.substring(0, 7); // "YYYY-MM"
      setCurrentMonth(monthStr);
    }
  };

  const visibleAdminItems = adminNavItems.filter(item => role && item.roles.includes(role));

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            {!isMobile && (
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            )}
            {isMobile && (
              <Burger opened={opened} onClick={toggle} size="sm" />
            )}
            <Title order={3} style={{ color: '#103860' }}>Jadual OT</Title>
          </Group>
          <Group gap="sm">
            {!isOnline && (
              <Tooltip label="Mod Luar Talian">
                <ActionIcon color="orange" variant="light" size="lg">
                  <IconWifiOff size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {isOnline && (
              <Tooltip label="Dalam Talian">
                <ActionIcon color="green" variant="light" size="lg">
                  <IconWifi size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            <DatePickerInput
              value={currentMonth ? new Date(currentMonth + '-01') : null}
              onChange={(val) => {
                if (val) {
                  const d = val instanceof Date ? val : new Date(val);
                  const iso = d.toISOString().substring(0, 7);
                  setCurrentMonth(iso);
                }
              }}
              placeholder="Pilih Bulan"
              size="sm"
              valueFormat="MMM YYYY"
              clearable={false}
              styles={{ input: { width: 160 } }}
              level="month"
            />
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="xs">
                    <Avatar color={roleColor} radius="xl" size={32}>
                      {(name || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>{name}</Text>
                      <Badge color={roleColor} size="xs">{roleLabel}</Badge>
                    </div>
                    <IconChevronDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconUserCircle size={16} />} onClick={() => navigate('/profile')}>
                  Profil Saya
                </Menu.Item>
                <Menu.Item leftSection={<IconHelp size={16} />} onClick={() => navigate('/help')}>
                  Bantuan
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={handleLogout}>
                  Log Keluar
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          {role && (role === 'admin' || role === 'superadmin') && (
            <>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="xs">Pentadbiran</Text>
              {visibleAdminItems.map((item) => (
                <NavLink
                  key={item.path}
                  label={item.label}
                  leftSection={<item.icon size={18} />}
                  active={location.pathname === item.path}
                  onClick={() => { navigate(item.path); if (isMobile) toggle(); }}
                  style={{ borderRadius: 8, marginBottom: 2 }}
                />
              ))}
              <Divider my="sm" />
            </>
          )}
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="xs">Umum</Text>
          {commonNavItems.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              leftSection={<item.icon size={18} />}
              active={location.pathname === item.path}
              onClick={() => { navigate(item.path); if (isMobile) toggle(); }}
              style={{ borderRadius: 8, marginBottom: 2 }}
            />
          ))}
          {role === 'superadmin' && (
            <>
              <Divider my="sm" />
              <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="xs">Super Admin</Text>
              {superAdminNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  label={item.label}
                  leftSection={<item.icon size={18} />}
                  active={location.pathname === item.path}
                  onClick={() => { navigate(item.path); if (isMobile) toggle(); }}
                  style={{ borderRadius: 8, marginBottom: 2 }}
                />
              ))}
            </>
          )}
        </AppShell.Section>
        <AppShell.Section>
          <Divider mb="sm" />
          <Button
            variant="subtle"
            color="red"
            fullWidth
            leftSection={<IconLogout size={18} />}
            onClick={handleLogout}
          >
            Log Keluar
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}