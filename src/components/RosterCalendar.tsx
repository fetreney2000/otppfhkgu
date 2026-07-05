import { useState, useMemo } from 'react';
import { SimpleGrid, Text, Paper, Stack, Group, Badge, Modal, Select, Button, ScrollArea, Divider, ActionIcon, Tooltip } from '@mantine/core';
import { IconEdit, IconCheck, IconX } from '@tabler/icons-react';
import type { RosterRow, Holiday, Employee } from '../types';
import { WEEKDAY_NAMES, SLOT_HOURS } from '../types';
import dayjs from 'dayjs';

interface RosterCalendarProps {
  rows: RosterRow[];
  month: string;
  holidays: Holiday[];
  employees: Employee[];
  canEdit: boolean;
  onEdit?: (date: string, slotType: string, employeeName: string) => Promise<void>;
}

const SLOT_ORDER = ['OPD_1', 'OPD_2', 'OPD_3', 'OPD_4', 'OPD_5', 'IPP_1', 'IPP_2', 'IPP_3', 'IPP_4', 'PP_PPF', 'PP_PRA_1', 'PP_PRA_2', 'AE', 'POST-AE'];

const SLOT_COLORS: Record<string, string> = {
  OPD_1: 'orange', OPD_2: 'orange', OPD_3: 'orange', OPD_4: 'orange', OPD_5: 'orange',
  IPP_1: 'blue', IPP_2: 'blue', IPP_3: 'blue', IPP_4: 'blue',
  PP_PPF: 'grape', PP_PRA_1: 'grape', PP_PRA_2: 'grape',
  AE: 'red', 'POST-AE': 'pink',
};

export function RosterCalendar({ rows, month, holidays, employees, canEdit, onEdit }: RosterCalendarProps) {
  const [editDate, setEditDate] = useState<string | null>(null);
  const [editSlot, setEditSlot] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const holidayDates = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  // Build calendar days
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = dayjs(`${year}-${String(mon).padStart(2, '0')}`).daysInMonth();
  const firstDow = dayjs(`${year}-${String(mon).padStart(2, '0')}-01`).day(); // 0=Sun

  // Build lookup: date -> slotType -> employeeName
  const rosterMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const row of rows) {
      if (row.slotType === 'POST-AE' || row.slotType === 'PREV_MONTH_POST_AE') continue;
      if (!map.has(row.date)) map.set(row.date, new Map());
      map.get(row.date)!.set(row.slotType, row.employeeName);
    }
    return map;
  }, [rows]);

  const postAEMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.slotType === 'POST-AE') map.set(row.date, row.employeeName);
    }
    return map;
  }, [rows]);

  // Build calendar grid (Mon-Sun)
  const offset = firstDow === 0 ? 6 : firstDow - 1; // Monday-first
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const getDayType = (d: number): 'weekday' | 'weekend' | 'holiday' => {
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (holidayDates.has(dateStr)) return 'holiday';
    const dow = dayjs(dateStr).day();
    if (dow === 0 || dow === 6) return 'weekend';
    return 'weekday';
  };

  const getBgColor = (type: 'weekday' | 'weekend' | 'holiday'): string => {
    if (type === 'holiday') return '#FFF3E0';
    if (type === 'weekend') return '#F3E5F5';
    return '#FFFFFF';
  };

  const handleEdit = (d: number) => {
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    setEditDate(dateStr);
    setEditSlot(null);
    setEditValue('');
  };

  const handleSave = async () => {
    if (!editDate || !editSlot || !onEdit) return;
    setSaving(true);
    try {
      await onEdit(editDate, editSlot, editValue);
      setEditDate(null);
      setEditSlot(null);
    } catch (err) {
      console.error('Edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Get slots for the edit modal
  const editDaySlots = editDate ? rosterMap.get(editDate) : undefined;
  const editPostAE = editDate ? postAEMap.get(editDate) : undefined;
  const employeeNames = employees.map(e => e.name).sort();

  return (
    <>
      <SimpleGrid cols={7} spacing={4}>
        {/* Day of week headers */}
        {['ISN', 'SEL', 'RAB', 'KHA', 'JUM', 'SAB', 'AHD'].map(d => (
          <Text key={d} size="xs" fw={700} ta="center" c="dimmed" py={4}>{d}</Text>
        ))}

        {/* Calendar cells */}
        {calendarCells.map((d, i) => {
          if (d === null) return <Paper key={i} p={4} style={{ minHeight: 80, background: '#FAFAFA' }} />;

          const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dayType = getDayType(d);
          const assignments = rosterMap.get(dateStr);
          const postAE = postAEMap.get(dateStr);
          const bgColor = dayType === 'holiday' ? '#FFF3E0' : dayType === 'weekend' ? '#F3E5F5' : '#FFFFFF';
          const dayName = WEEKDAY_NAMES[dayjs(dateStr).day()];

          return (
            <Paper
              key={i}
              p={4}
              withBorder
              style={{
                minHeight: 80,
                background: bgColor,
                cursor: canEdit ? 'pointer' : 'default',
                transition: 'box-shadow 0.15s',
              }}
              onClick={() => canEdit && handleEdit(d)}
              onMouseEnter={(e) => canEdit && (e.currentTarget.style.boxShadow = '0 0 0 2px #228BE6')}
              onMouseLeave={(e) => canEdit && (e.currentTarget.style.boxShadow = '')}
            >
              <Stack gap={2}>
                <Group justify="space-between" gap={2}>
                  <Text size="xs" fw={700}>{d}</Text>
                  <Text size="xs" c="dimmed" style={{ fontSize: 8 }}>{dayName}</Text>
                </Group>
                {assignments && Array.from(assignments.entries())
                  .sort(([a], [b]) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b))
                  .map(([slot, name]) => (
                    <Group key={slot} gap={2} wrap="nowrap">
                      <Badge size="xs" color={SLOT_COLORS[slot] || 'gray'} variant="light" style={{ fontSize: 7, padding: '0 3px', height: 14, minWidth: 30 }}>
                        {slot.replace('_', '')}
                      </Badge>
                      <Text size="xs" truncate style={{ maxWidth: 60, fontSize: 8 }}>{name}</Text>
                    </Group>
                  ))
                }
                {postAE && (
                  <Group gap={2} wrap="nowrap">
                    <Badge size="xs" color="pink" variant="light" style={{ fontSize: 7, padding: '0 3px', height: 14, minWidth: 30 }}>POST</Badge>
                    <Text size="xs" truncate style={{ maxWidth: 60, fontSize: 8 }}>{postAE}</Text>
                  </Group>
                )}
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>

      {/* Edit Modal */}
      <Modal
        opened={!!editDate}
        onClose={() => setEditDate(null)}
        title={`Edit OT — ${editDate ? dayjs(editDate).format('DD MMMM YYYY') : ''}`}
        size="md"
      >
        {editDate && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {WEEKDAY_NAMES[dayjs(editDate).day()]}
              {holidayDates.has(editDate) ? ' (Cuti Umum)' : ''}
            </Text>

            {/* Current assignments */}
            <Stack gap={4}>
              <Text size="xs" fw={600}>Tugasan Semasa:</Text>
              {editDaySlots ? Array.from(editDaySlots.entries())
                .sort(([a], [b]) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b))
                .map(([slot, name]) => (
                  <Group key={slot} justify="space-between" p="xs" style={{ background: '#F8F9FA', borderRadius: 4 }}>
                    <Group gap="xs">
                      <Badge size="sm" color={SLOT_COLORS[slot] || 'gray'}>{slot}</Badge>
                      <Text size="sm">{name}</Text>
                      <Text size="xs" c="dimmed">({SLOT_HOURS[slot] || 0}h)</Text>
                    </Group>
                    {canEdit && (
                      <Tooltip label="Edit">
                        <ActionIcon size="sm" variant="subtle" onClick={() => { setEditSlot(slot); setEditValue(name); }}>
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                )) : <Text size="sm" c="dimmed">Tiada tugasan</Text>}
              {editPostAE && (
                <Group p="xs" style={{ background: '#FFF0F6', borderRadius: 4 }}>
                  <Badge size="sm" color="pink">POST-AE</Badge>
                  <Text size="sm">{editPostAE}</Text>
                </Group>
              )}
            </Stack>

            {/* Edit form */}
            {editSlot && canEdit && (
              <>
                <Divider />
                <Group>
                  <Text size="sm">Edit {editSlot}:</Text>
                  <Select
                    placeholder="Pilih kakitangan"
                    data={['', ...employeeNames]}
                    value={editValue}
                    onChange={(v) => setEditValue(v || '')}
                    searchable
                    style={{ flex: 1 }}
                  />
                  <Button size="sm" loading={saving} onClick={handleSave} leftSection={<IconCheck size={14} />}>Simpan</Button>
                  <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setEditSlot(null)}>
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              </>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}