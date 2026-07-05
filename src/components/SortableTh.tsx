import { useState } from 'react';
import { Table, UnstyledButton } from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export function SortIcon({ sortKey, current }: { sortKey: string; current: SortState }) {
  if (current.key !== sortKey) return <IconSelector size={12} />;
  return current.dir === 'asc' ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />;
}

export function ThSort({ sortKey, current, onToggle, children }: {
  sortKey: string;
  current: SortState;
  onToggle: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <Table.Th>
      <UnstyledButton onClick={() => onToggle(sortKey)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {children} <SortIcon sortKey={sortKey} current={current} />
      </UnstyledButton>
    </Table.Th>
  );
}

export function useSortable(initialKey: string, initialDir: 'asc' | 'desc' = 'asc') {
  const [sort, setSort] = useState<SortState>({ key: initialKey, dir: initialDir });
  const toggle = (key: string) => setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  const sortArray = <T,>(arr: T[], accessor?: (item: T) => unknown): T[] => {
    const s = [...arr];
    s.sort((a, b) => {
      const av = accessor ? accessor(a) : (a as Record<string, unknown>)[sort.key];
      const bv = accessor ? accessor(b) : (b as Record<string, unknown>)[sort.key];
      if (typeof av === 'string' && typeof bv === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      if (typeof av === 'boolean') return sort.dir === 'asc' ? (av ? 1 : 0) - ((bv as boolean) ? 1 : 0) : ((bv as boolean) ? 1 : 0) - (av ? 1 : 0);
      return sort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return s;
  };
  return { sort, toggle, sortArray };
}
