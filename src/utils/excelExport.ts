import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import { MONTH_NAMES_MS, WEEKDAY_NAMES } from '../types';
import type { RosterRow, Holiday } from '../types';

// Column layout constants (1-based for ExcelJS)
const COL = {
  TARIKH: 1,
  HARI: 2,
  // HARI BEKERJA BIASA (weekday) columns
  WD_OPD_1: 3,
  WD_OPD_2: 4,
  WD_OPD_3: 5,
  WD_IPP_1: 6,
  // HARI REHAT / CUTI UMUM (offday) columns
  OD_OPD_1: 7,
  OD_OPD_2: 8,
  OD_OPD_3: 9,
  OD_OPD_4: 10,
  OD_OPD_5: 11,
  OD_IPP_1: 12,
  OD_IPP_2: 13,
  OD_IPP_3: 14,
  OD_IPP_4: 15,
  OD_PP_PPF: 16,
  OD_PP_PRA_1: 17,
  OD_PP_PRA_2: 18,
  // FARMASI KECEMASAN columns
  AE_GAP: 19,
  AE: 20,
  POST_AE_GAP: 21,
  POST_AE: 22,
} as const;

const TOTAL_COLS = 22;

// Color palette
const COLORS = {
  titleBg: 'FF1F3864',       // Dark navy
  titleFont: 'FFFFFFFF',     // White
  catHeaderBg: 'FF2E75B6',   // Medium blue
  catHeaderFont: 'FFFFFFFF', // White
  weekdayHeaderBg: 'FFD6E4F0',  // Light blue
  offdayHeaderBg: 'FFFFF2CC',   // Light yellow
  aeHeaderBg: 'FFFCE4EC',       // Light pink
  weekdayDataBg: 'FFE8F5E9',    // Light green
  offdayDataBg: 'FFFFFDE7',     // Light cream
  aeDataBg: 'FFFFEBEE',         // Light red
  borderColor: 'FF000000',      // Black
  footerBg: 'FFF5F5F5',         // Light gray
  headerSubBg: 'FF4472C4',      // Blue for row 2 category
  headerTimeBg: 'FF5B9BD5',     // Lighter blue for row 3 time
  slotNameBg: 'FFD9E2F3',       // Very light blue for row 5
};

// Slot-to-weekday-column mapping
const WEEKDAY_SLOT_MAP: Record<string, number> = {
  OPD_1: COL.WD_OPD_1,
  OPD_2: COL.WD_OPD_2,
  OPD_3: COL.WD_OPD_3,
  IPP_1: COL.WD_IPP_1,
};

// Slot-to-offday-column mapping
const OFFDAY_SLOT_MAP: Record<string, number> = {
  OPD_1: COL.OD_OPD_1,
  OPD_2: COL.OD_OPD_2,
  OPD_3: COL.OD_OPD_3,
  OPD_4: COL.OD_OPD_4,
  OPD_5: COL.OD_OPD_5,
  IPP_1: COL.OD_IPP_1,
  IPP_2: COL.OD_IPP_2,
  IPP_3: COL.OD_IPP_3,
  IPP_4: COL.OD_IPP_4,
  PP_PPF: COL.OD_PP_PPF,
  PP_PRA_1: COL.OD_PP_PRA_1,
  PP_PRA_2: COL.OD_PP_PRA_2,
};

// AE slot mappings
const AE_SLOT_MAP: Record<string, number> = {
  AE: COL.AE,
  'POST-AE': COL.POST_AE,
};

function isOffday(dateStr: string, holidayDates: Set<string>): boolean {
  if (holidayDates.has(dateStr)) return true;
  const dow = dayjs(dateStr).day();
  return dow === 0 || dow === 6;
}

function getDayType(dateStr: string, holidayDates: Set<string>): string {
  if (holidayDates.has(dateStr)) return 'CUTI UMUM';
  const dow = dayjs(dateStr).day();
  return WEEKDAY_NAMES[dow] || '';
}

function setCellBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.borderColor } },
    left: { style: 'thin', color: { argb: COLORS.borderColor } },
    bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
    right: { style: 'thin', color: { argb: COLORS.borderColor } },
  };
}

function setCellFill(cell: ExcelJS.Cell, color: string) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color },
  };
}

function styleHeaderCell(cell: ExcelJS.Cell, bgColor: string, fontColor: string, bold = true) {
  setCellFill(cell, bgColor);
  setCellBorder(cell);
  cell.font = { bold, color: { argb: fontColor }, size: 10 };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

function styleDataCell(cell: ExcelJS.Cell, bgColor: string) {
  setCellFill(cell, bgColor);
  setCellBorder(cell);
  cell.font = { size: 9 };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

export async function generateRosterExcel(
  rows: RosterRow[],
  month: string,
  holidays: Holiday[],
  label: string = 'Asal'
): Promise<void> {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr);
  const mon = parseInt(monthStr);
  const monthName = MONTH_NAMES_MS[mon - 1]?.toUpperCase() || '';
  const daysInMonth = dayjs(`${yearStr}-${monthStr}`).daysInMonth();
  const holidayDates = new Set(holidays.map(h => h.date));

  // Build lookup: date -> slotType -> employeeName
  const rosterMap = new Map<string, Map<string, string>>();
  for (const row of rows) {
    if (row.slotType === 'POST-AE' || row.slotType === 'PREV_MONTH_POST_AE') continue;
    if (!rosterMap.has(row.date)) rosterMap.set(row.date, new Map());
    rosterMap.get(row.date)!.set(row.slotType, row.employeeName);
  }

  // Also get POST-AE assignments
  const postAEMap = new Map<string, string>();
  for (const row of rows) {
    if (row.slotType === 'POST-AE') {
      postAEMap.set(row.date, row.employeeName);
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Jadual OT Bersepadu';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Jadual OT', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }],
  });

  // Set column widths
  ws.getColumn(COL.TARIKH).width = 6;
  ws.getColumn(COL.HARI).width = 14;
  for (let c = 3; c <= TOTAL_COLS; c++) {
    ws.getColumn(c).width = 12;
  }

  // ========== ROW 1: Title ==========
  ws.mergeCells(1, COL.TARIKH, 1, TOTAL_COLS);
  const titleCell = ws.getCell(1, COL.TARIKH);
  titleCell.value = `JADUAL KERJA LEBIH MASA JABATAN FARMASI HOSPITAL KENINGAU (PPF & PA)`;
  styleHeaderCell(titleCell, COLORS.titleBg, COLORS.titleFont, true);
  titleCell.font = { bold: true, color: { argb: COLORS.titleFont }, size: 14 };
  ws.getRow(1).height = 30;

  // ========== ROW 2: Category headers ==========
  ws.getRow(2).height = 25;
  
  // BULAN
  const bulanCell = ws.getCell(2, COL.TARIKH);
  bulanCell.value = 'BULAN';
  styleHeaderCell(bulanCell, COLORS.headerSubBg, COLORS.catHeaderFont);
  
  // TAHUN
  const tahunCell = ws.getCell(2, COL.HARI);
  tahunCell.value = 'TAHUN';
  styleHeaderCell(tahunCell, COLORS.headerSubBg, COLORS.catHeaderFont);
  
  // HARI BEKERJA BIASA (cols 3-6)
  ws.mergeCells(2, COL.WD_OPD_1, 2, COL.WD_IPP_1);
  const wdHeader = ws.getCell(2, COL.WD_OPD_1);
  wdHeader.value = 'HARI BEKERJA BIASA';
  styleHeaderCell(wdHeader, COLORS.headerSubBg, COLORS.catHeaderFont);
  
  // HARI REHAT BIASA / CUTI UMUM (cols 7-18)
  ws.mergeCells(2, COL.OD_OPD_1, 2, COL.OD_PP_PRA_2);
  const odHeader = ws.getCell(2, COL.OD_OPD_1);
  odHeader.value = 'HARI REHAT BIASA / CUTI UMUM';
  styleHeaderCell(odHeader, COLORS.headerSubBg, COLORS.catHeaderFont);
  
  // FARMASI KECEMASAN (cols 19-22)
  ws.mergeCells(2, COL.AE_GAP, 2, COL.POST_AE);
  const aeHeader = ws.getCell(2, COL.AE_GAP);
  aeHeader.value = 'FARMASI KECEMASAN';
  styleHeaderCell(aeHeader, COLORS.headerSubBg, COLORS.catHeaderFont);

  // Style the rest of row 2
  for (let c = 3; c <= TOTAL_COLS; c++) {
    const cell = ws.getCell(2, c);
    setCellBorder(cell);
  }

  // ========== ROW 3: Time shifts ==========
  ws.getRow(3).height = 22;
  
  const monthCell = ws.getCell(3, COL.TARIKH);
  monthCell.value = monthName;
  styleHeaderCell(monthCell, COLORS.headerTimeBg, COLORS.catHeaderFont);
  
  const yearCell = ws.getCell(3, COL.HARI);
  yearCell.value = year;
  styleHeaderCell(yearCell, COLORS.headerTimeBg, COLORS.catHeaderFont);
  
  // Weekday time: 6PM - 10PM (cols 3-6)
  ws.mergeCells(3, COL.WD_OPD_1, 3, COL.WD_IPP_1);
  const wdTime = ws.getCell(3, COL.WD_OPD_1);
  wdTime.value = '6PM - 10PM';
  styleHeaderCell(wdTime, COLORS.weekdayHeaderBg, 'FF000000');
  
  // Offday times
  // 8AM - 3PM (cols 7-9: OPD_1-OPD_3)
  ws.mergeCells(3, COL.OD_OPD_1, 3, COL.OD_OPD_3);
  const odTime1 = ws.getCell(3, COL.OD_OPD_1);
  odTime1.value = '8AM - 3PM';
  styleHeaderCell(odTime1, COLORS.offdayHeaderBg, 'FF000000');
  
  // 3PM - 10PM (cols 10-11: OPD_4-OPD_5)
  ws.mergeCells(3, COL.OD_OPD_4, 3, COL.OD_OPD_5);
  const odTime2 = ws.getCell(3, COL.OD_OPD_4);
  odTime2.value = '3PM - 10PM';
  styleHeaderCell(odTime2, COLORS.offdayHeaderBg, 'FF000000');
  
  // 8AM - 3PM (cols 12-13: IPP_1-IPP_2)
  ws.mergeCells(3, COL.OD_IPP_1, 3, COL.OD_IPP_2);
  const odTime3 = ws.getCell(3, COL.OD_IPP_1);
  odTime3.value = '8AM - 3PM';
  styleHeaderCell(odTime3, COLORS.offdayHeaderBg, 'FF000000');
  
  // 3PM - 10PM (cols 14-15: IPP_3-IPP_4)
  ws.mergeCells(3, COL.OD_IPP_3, 3, COL.OD_IPP_4);
  const odTime4 = ws.getCell(3, COL.OD_IPP_3);
  odTime4.value = '3PM - 10PM';
  styleHeaderCell(odTime4, COLORS.offdayHeaderBg, 'FF000000');
  
  // 8AM - 2PM (cols 16-18: PP slots)
  ws.mergeCells(3, COL.OD_PP_PPF, 3, COL.OD_PP_PRA_2);
  const odTime5 = ws.getCell(3, COL.OD_PP_PPF);
  odTime5.value = '8AM - 2PM';
  styleHeaderCell(odTime5, COLORS.offdayHeaderBg, 'FF000000');
  
  // SETIAP HARI (cols 19-22: AE)
  ws.mergeCells(3, COL.AE_GAP, 3, COL.POST_AE);
  const aeTime = ws.getCell(3, COL.AE_GAP);
  aeTime.value = 'SETIAP HARI';
  styleHeaderCell(aeTime, COLORS.aeHeaderBg, 'FF000000');

  // ========== ROW 4: Sub-headers ==========
  ws.getRow(4).height = 22;
  
  const tarikhCell = ws.getCell(4, COL.TARIKH);
  tarikhCell.value = 'TARIKH';
  styleHeaderCell(tarikhCell, COLORS.slotNameBg, 'FF000000');
  
  const hariCell = ws.getCell(4, COL.HARI);
  hariCell.value = 'HARI';
  styleHeaderCell(hariCell, COLORS.slotNameBg, 'FF000000');
  
  // Weekday: FARMASI AMBULATORI (cols 3-5), FARMASI PESAKIT DALAM (col 6)
  ws.mergeCells(4, COL.WD_OPD_1, 4, COL.WD_OPD_3);
  const wdAmb = ws.getCell(4, COL.WD_OPD_1);
  wdAmb.value = 'FARMASI AMBULATORI';
  styleHeaderCell(wdAmb, COLORS.weekdayHeaderBg, 'FF000000');
  
  const wdIpp = ws.getCell(4, COL.WD_IPP_1);
  wdIpp.value = 'FARMASI PESAKIT DALAM';
  styleHeaderCell(wdIpp, COLORS.weekdayHeaderBg, 'FF000000');
  
  // Offday: FARMASI AMBULATORI (cols 7-11), FARMASI PESAKIT DALAM (cols 12-15), PRABUNGKUS (cols 16-18)
  ws.mergeCells(4, COL.OD_OPD_1, 4, COL.OD_OPD_5);
  const odAmb = ws.getCell(4, COL.OD_OPD_1);
  odAmb.value = 'FARMASI AMBULATORI';
  styleHeaderCell(odAmb, COLORS.offdayHeaderBg, 'FF000000');
  
  ws.mergeCells(4, COL.OD_IPP_1, 4, COL.OD_IPP_4);
  const odIpp = ws.getCell(4, COL.OD_IPP_1);
  odIpp.value = 'FARMASI PESAKIT DALAM';
  styleHeaderCell(odIpp, COLORS.offdayHeaderBg, 'FF000000');
  
  ws.mergeCells(4, COL.OD_PP_PPF, 4, COL.OD_PP_PRA_2);
  const odPra = ws.getCell(4, COL.OD_PP_PPF);
  odPra.value = 'PRABUNGKUS';
  styleHeaderCell(odPra, COLORS.offdayHeaderBg, 'FF000000');
  
  // AE: 10PM-12AM (cols 19-20), 12AM-8AM (cols 21-22)
  ws.mergeCells(4, COL.AE_GAP, 4, COL.AE);
  const aeSub1 = ws.getCell(4, COL.AE_GAP);
  aeSub1.value = '10PM - 12AM';
  styleHeaderCell(aeSub1, COLORS.aeHeaderBg, 'FF000000');
  
  ws.mergeCells(4, COL.POST_AE_GAP, 4, COL.POST_AE);
  const aeSub2 = ws.getCell(4, COL.POST_AE_GAP);
  aeSub2.value = '12AM - 8AM';
  styleHeaderCell(aeSub2, COLORS.aeHeaderBg, 'FF000000');

  // ========== ROW 5: Slot names ==========
  ws.getRow(5).height = 20;
  
  // Leave TARIKH and HARI empty in row 5
  const r5tarikh = ws.getCell(5, COL.TARIKH);
  styleHeaderCell(r5tarikh, COLORS.slotNameBg, 'FF000000');
  const r5hari = ws.getCell(5, COL.HARI);
  styleHeaderCell(r5hari, COLORS.slotNameBg, 'FF000000');
  
  // Weekday slot names
  const wdSlots = [
    { col: COL.WD_OPD_1, name: 'OPD_1' },
    { col: COL.WD_OPD_2, name: 'OPD_2' },
    { col: COL.WD_OPD_3, name: 'OPD_3' },
    { col: COL.WD_IPP_1, name: 'IPP_1' },
  ];
  for (const s of wdSlots) {
    const cell = ws.getCell(5, s.col);
    cell.value = s.name;
    styleHeaderCell(cell, COLORS.weekdayHeaderBg, 'FF000000', false);
  }
  
  // Offday slot names
  const odSlots = [
    { col: COL.OD_OPD_1, name: 'OPD_1' },
    { col: COL.OD_OPD_2, name: 'OPD_2' },
    { col: COL.OD_OPD_3, name: 'OPD_3' },
    { col: COL.OD_OPD_4, name: 'OPD_4' },
    { col: COL.OD_OPD_5, name: 'OPD_5' },
    { col: COL.OD_IPP_1, name: 'IPP_1' },
    { col: COL.OD_IPP_2, name: 'IPP_2' },
    { col: COL.OD_IPP_3, name: 'IPP_3' },
    { col: COL.OD_IPP_4, name: 'IPP_4' },
    { col: COL.OD_PP_PPF, name: 'PP_PPF' },
    { col: COL.OD_PP_PRA_1, name: 'PP_PRA_1' },
    { col: COL.OD_PP_PRA_2, name: 'PP_PRA_2' },
  ];
  for (const s of odSlots) {
    const cell = ws.getCell(5, s.col);
    cell.value = s.name;
    styleHeaderCell(cell, COLORS.offdayHeaderBg, 'FF000000', false);
  }
  
  // AE slot names
  const r5gap1 = ws.getCell(5, COL.AE_GAP);
  styleHeaderCell(r5gap1, COLORS.aeHeaderBg, 'FF000000', false);
  const r5ae = ws.getCell(5, COL.AE);
  r5ae.value = 'AE';
  styleHeaderCell(r5ae, COLORS.aeHeaderBg, 'FF000000', false);
  const r5gap2 = ws.getCell(5, COL.POST_AE_GAP);
  styleHeaderCell(r5gap2, COLORS.aeHeaderBg, 'FF000000', false);
  const r5postae = ws.getCell(5, COL.POST_AE);
  r5postae.value = 'POST-AE';
  styleHeaderCell(r5postae, COLORS.aeHeaderBg, 'FF000000', false);

  // ========== DATA ROWS (rows 6+) ==========
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    const dayName = getDayType(dateStr, holidayDates);
    const offday = isOffday(dateStr, holidayDates);
    const dayAssignments = rosterMap.get(dateStr);
    const postAEName = postAEMap.get(dateStr);
    
    const rowNum = 5 + d;
    const row = ws.getRow(rowNum);
    row.height = 18;
    
    // Col 1: Date number
    const dateCell = ws.getCell(rowNum, COL.TARIKH);
    dateCell.value = d;
    styleDataCell(dateCell, COLORS.slotNameBg);
    dateCell.font = { bold: true, size: 9 };
    
    // Col 2: Day name
    const dayCell = ws.getCell(rowNum, COL.HARI);
    dayCell.value = dayName;
    styleDataCell(dayCell, COLORS.slotNameBg);
    dayCell.font = { bold: true, size: 9 };
    
    // Weekday columns (3-6)
    for (let c = 3; c <= 6; c++) {
      const cell = ws.getCell(rowNum, c);
      if (!offday) {
        // Find which slot maps to this column
        const slotEntry = Object.entries(WEEKDAY_SLOT_MAP).find(([, col]) => col === c);
        if (slotEntry && dayAssignments) {
          const name = dayAssignments.get(slotEntry[0]);
          if (name) cell.value = name;
        }
      }
      styleDataCell(cell, offday ? COLORS.offdayDataBg : COLORS.weekdayDataBg);
    }
    
    // Offday columns (7-18)
    for (let c = 7; c <= 18; c++) {
      const cell = ws.getCell(rowNum, c);
      if (offday) {
        const slotEntry = Object.entries(OFFDAY_SLOT_MAP).find(([, col]) => col === c);
        if (slotEntry && dayAssignments) {
          const name = dayAssignments.get(slotEntry[0]);
          if (name) cell.value = name;
        }
      }
      styleDataCell(cell, offday ? COLORS.offdayDataBg : COLORS.weekdayDataBg);
    }
    
    // AE gap columns (19, 21)
    const gap1 = ws.getCell(rowNum, COL.AE_GAP);
    styleDataCell(gap1, COLORS.aeDataBg);
    const gap2 = ws.getCell(rowNum, COL.POST_AE_GAP);
    styleDataCell(gap2, COLORS.aeDataBg);
    
    // AE column (20)
    const aeCell = ws.getCell(rowNum, COL.AE);
    if (dayAssignments) {
      const aeName = dayAssignments.get('AE');
      if (aeName) aeCell.value = aeName;
    }
    styleDataCell(aeCell, COLORS.aeDataBg);
    
    // POST-AE column (22)
    const postAECell = ws.getCell(rowNum, COL.POST_AE);
    if (postAEName) postAECell.value = postAEName;
    styleDataCell(postAECell, COLORS.aeDataBg);
  }

  // ========== FOOTER ==========
  const footerStartRow = 5 + daysInMonth + 2;
  
  // "DISEDIAKAN OLEH :" (left side)
  const preparedLabel = ws.getCell(footerStartRow, COL.TARIKH);
  preparedLabel.value = 'DISEDIAKAN OLEH :';
  preparedLabel.font = { bold: true, size: 10 };
  preparedLabel.alignment = { horizontal: 'left' };
  
  // "DI LULUSKAN OLEH:" (right side)
  const approvedLabel = ws.getCell(footerStartRow, COL.AE);
  approvedLabel.value = 'DI LULUSKAN OLEH:';
  approvedLabel.font = { bold: true, size: 10 };
  approvedLabel.alignment = { horizontal: 'left' };
  
  // Prepared by name
  const preparedName = ws.getCell(footerStartRow + 1, COL.TARIKH);
  preparedName.value = '';
  preparedName.font = { size: 10 };
  
  const approvedName = ws.getCell(footerStartRow + 1, COL.AE);
  approvedName.value = '';
  approvedName.font = { size: 10 };
  
  // Prepared by title
  const preparedTitle = ws.getCell(footerStartRow + 2, COL.TARIKH);
  preparedTitle.value = '';
  preparedTitle.font = { size: 10, italic: true };
  
  const approvedTitle = ws.getCell(footerStartRow + 2, COL.AE);
  approvedTitle.value = '';
  approvedTitle.font = { size: 10, italic: true };
  
  // Date
  const preparedDate = ws.getCell(footerStartRow + 3, COL.TARIKH);
  preparedDate.value = '';
  preparedDate.font = { size: 10 };
  
  const approvedDate = ws.getCell(footerStartRow + 3, COL.AE);
  approvedDate.value = '';
  approvedDate.font = { size: 10 };

  // Set print area and page setup
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9, // A4
    margins: {
      left: 0.25, right: 0.25,
      top: 0.5, bottom: 0.5,
      header: 0.3, footer: 0.3,
    },
  };

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const suffix = label === 'Asal' ? '' : `_${label}`;
  const fileName = `Jadual_OT_${monthName}_${yearStr}${suffix}.xlsx`;
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}