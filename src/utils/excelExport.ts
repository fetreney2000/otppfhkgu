import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import { MONTH_NAMES_MS, WEEKDAY_NAMES } from '../types';
import type { RosterRow, Holiday } from '../types';

// ============================================
// EXACT TEMPLATE LAYOUT (23 columns, A-W)
// Column A is empty spacer
// ============================================
const C = {
  EMPTY: 1,    // A - empty spacer
  TARIKH: 2,   // B - date number / BULAN
  HARI: 3,     // C - day name / TAHUN
  // HARI BEKERJA BIASA (weekday) - cols D-G
  WD_OPD_1: 4,  // D
  WD_OPD_2: 5,  // E
  WD_OPD_3: 6,  // F
  WD_IPP_1: 7,  // G
  // HARI REHAT / CUTI UMUM (offday) - cols H-S
  OD_OPD_1: 8,   // H
  OD_OPD_2: 9,   // I
  OD_OPD_3: 10,  // J
  OD_OPD_4: 11,  // K
  OD_OPD_5: 12,  // L
  OD_IPP_1: 13,  // M
  OD_IPP_2: 14,  // N
  OD_IPP_3: 15,  // O
  OD_IPP_4: 16,  // P
  OD_PP_PPF: 17, // Q
  OD_PP_PRA_1: 18, // R
  OD_PP_PRA_2: 19, // S
  // FARMASI KECEMASAN - cols T-W
  AE_GAP: 20,    // T - gap
  AE: 21,        // U - AE
  POST_AE_GAP: 22, // V - gap
  POST_AE: 23,   // W - POST-AE
} as const;

const TOTAL_COLS = 23;

// ============================================
// EXACT COLORS FROM TEMPLATE
// ============================================
const CLR = {
  // Category header fills (row 3)
  weekdayCatBg: 'FFAAE571',    // light green - HARI BEKERJA BIASA
  offdayCatBg: 'FFF6C3FF',     // light purple - HARI REHAT BIASA / CUTI UMUM
  aeCatBg: 'FFFFC6C6',         // light pink - FARMASI KECEMASAN
  // Sub-header fills (row 5)
  ambBg: 'FFFFFF00',            // yellow - FARMASI AMBULATORI
  ippBg: 'FFFFC000',            // orange - FARMASI PESAKIT DALAM
  praBg: 'FF76E3FF',            // cyan - PRABUNGKUS
  aeSubBg: 'FFFFC6C6',          // light pink - 10PM-12AM / 12AM-8AM
  // Data cells: no fill (white)
  dataBg: 'FFFFFFFF',
  // Font colors
  headerFont: 'FF000000',       // black
  dataFont: 'FF000000',         // black
  // Border
  borderColor: 'FF000000',
} as const;

// Slot-to-column mappings
const WEEKDAY_SLOT_MAP: Record<string, number> = {
  OPD_1: C.WD_OPD_1, OPD_2: C.WD_OPD_2, OPD_3: C.WD_OPD_3, IPP_1: C.WD_IPP_1,
};
const OFFDAY_SLOT_MAP: Record<string, number> = {
  OPD_1: C.OD_OPD_1, OPD_2: C.OD_OPD_2, OPD_3: C.OD_OPD_3, OPD_4: C.OD_OPD_4, OPD_5: C.OD_OPD_5,
  IPP_1: C.OD_IPP_1, IPP_2: C.OD_IPP_2, IPP_3: C.OD_IPP_3, IPP_4: C.OD_IPP_4,
  PP_PPF: C.OD_PP_PPF, PP_PRA_1: C.OD_PP_PRA_1, PP_PRA_2: C.OD_PP_PRA_2,
};

function isOffday(dateStr: string, holidayDates: Set<string>): boolean {
  if (holidayDates.has(dateStr)) return true;
  return dayjs(dateStr).day() === 0 || dayjs(dateStr).day() === 6;
}

function getDayType(dateStr: string, holidayDates: Set<string>): string {
  if (holidayDates.has(dateStr)) return 'CUTI UMUM';
  return WEEKDAY_NAMES[dayjs(dateStr).day()] || '';
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as const, color: { argb: CLR.borderColor } };
  return { top: side, left: side, bottom: side, right: side };
}

function noBorder(): Partial<ExcelJS.Borders> {
  return {};
}

function headerFill(cell: ExcelJS.Cell, color: string) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function headerStyle(cell: ExcelJS.Cell, bgColor: string, fontSize = 19) {
  headerFill(cell, bgColor);
  cell.font = { name: 'Calibri', bold: true, size: fontSize, color: { argb: CLR.headerFont } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = noBorder();
}

function dataStyle(cell: ExcelJS.Cell, bold = true) {
  cell.font = { name: 'Calibri', bold, size: 11, color: { argb: CLR.dataFont } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = thinBorder();
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLR.dataBg } };
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
  const postAEMap = new Map<string, string>();
  for (const row of rows) {
    if (row.slotType === 'POST-AE') postAEMap.set(row.date, row.employeeName);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Jadual OT Bersepadu';
  wb.created = new Date();
  const ws = wb.addWorksheet('Jadual OT');

  // ============================================
  // COLUMN WIDTHS (exact from template)
  // ============================================
  ws.getColumn(1).width = 8.71;   // A
  ws.getColumn(2).width = 15.71;  // B
  ws.getColumn(3).width = 13.0;   // C
  ws.getColumn(4).width = 13.0;   // D
  ws.getColumn(5).width = 13.0;   // E
  ws.getColumn(6).width = 13.0;   // F
  ws.getColumn(7).width = 30.71;  // G (wider for FARMASI PESAKIT DALAM)
  ws.getColumn(8).width = 15.71;  // H
  ws.getColumn(9).width = 13.0;   // I
  ws.getColumn(10).width = 13.0;  // J
  ws.getColumn(11).width = 13.0;  // K
  ws.getColumn(12).width = 13.0;  // L
  ws.getColumn(13).width = 17.71; // M
  ws.getColumn(14).width = 15.71; // N
  ws.getColumn(15).width = 14.71; // O
  ws.getColumn(16).width = 16.14; // P
  ws.getColumn(17).width = 15.71; // Q
  ws.getColumn(18).width = 13.0;  // R
  ws.getColumn(19).width = 13.0;  // S
  ws.getColumn(20).width = 18.71; // T
  ws.getColumn(21).width = 17.71; // U
  ws.getColumn(22).width = 18.71; // V
  ws.getColumn(23).width = 18.71; // W

  // ============================================
  // ROW 1: TITLE (merged B1:W1)
  // ============================================
  ws.getRow(1).height = 39.75;
  ws.mergeCells(1, C.TARIKH, 1, TOTAL_COLS);
  const titleCell = ws.getCell(1, C.TARIKH);
  titleCell.value = 'JADUAL KERJA LEBIH MASA JABATAN FARMASI HOSPITAL KENINGAU (PPF & PA)';
  titleCell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: CLR.headerFont } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  titleCell.border = noBorder();

  // ============================================
  // ROW 2: EMPTY SPACER
  // ============================================
  ws.getRow(2).height = 15.0;

  // ============================================
  // ROW 3: CATEGORY HEADERS
  // ============================================
  ws.getRow(3).height = 51.0;

  // B3 = BULAN
  const bulanCell = ws.getCell(3, C.TARIKH);
  bulanCell.value = 'BULAN';
  headerStyle(bulanCell, CLR.weekdayCatBg);

  // C3 = TAHUN
  const tahunCell = ws.getCell(3, C.HARI);
  tahunCell.value = 'TAHUN';
  headerStyle(tahunCell, CLR.weekdayCatBg);

  // D3:G3 = HARI BEKERJA BIASA
  ws.mergeCells(3, C.WD_OPD_1, 3, C.WD_IPP_1);
  const wdCat = ws.getCell(3, C.WD_OPD_1);
  wdCat.value = 'HARI BEKERJA BIASA';
  headerStyle(wdCat, CLR.weekdayCatBg);

  // H3:S3 = HARI REHAT BIASA / CUTI UMUM
  ws.mergeCells(3, C.OD_OPD_1, 3, C.OD_PP_PRA_2);
  const odCat = ws.getCell(3, C.OD_OPD_1);
  odCat.value = 'HARI REHAT BIASA / CUTI UMUM';
  headerStyle(odCat, CLR.offdayCatBg);

  // T3:W3 = FARMASI KECEMASAN
  ws.mergeCells(3, C.AE_GAP, 3, C.POST_AE);
  const aeCat = ws.getCell(3, C.AE_GAP);
  aeCat.value = 'FARMASI KECEMASAN';
  headerStyle(aeCat, CLR.aeCatBg);

  // ============================================
  // ROW 4: TIME SHIFTS
  // ============================================
  ws.getRow(4).height = 34.5;

  // B4 = month name
  const monthCell = ws.getCell(4, C.TARIKH);
  monthCell.value = monthName;
  headerStyle(monthCell, CLR.weekdayCatBg);

  // C4 = year
  const yearCell = ws.getCell(4, C.HARI);
  yearCell.value = year;
  headerStyle(yearCell, CLR.weekdayCatBg);

  // D4:G4 = 6PM - 10PM
  ws.mergeCells(4, C.WD_OPD_1, 4, C.WD_IPP_1);
  const wdTime = ws.getCell(4, C.WD_OPD_1);
  wdTime.value = '6PM - 10PM';
  headerStyle(wdTime, CLR.weekdayCatBg);

  // H4:J4 = 8AM - 3PM (OPD morning)
  ws.mergeCells(4, C.OD_OPD_1, 4, C.OD_OPD_3);
  const odTime1 = ws.getCell(4, C.OD_OPD_1);
  odTime1.value = '8AM - 3PM';
  headerStyle(odTime1, CLR.offdayCatBg);

  // K4:L4 = 3PM - 10PM (OPD afternoon)
  ws.mergeCells(4, C.OD_OPD_4, 4, C.OD_OPD_5);
  const odTime2 = ws.getCell(4, C.OD_OPD_4);
  odTime2.value = '3PM - 10PM';
  headerStyle(odTime2, CLR.offdayCatBg);

  // M4:N4 = 8AM - 3PM (IPP morning)
  ws.mergeCells(4, C.OD_IPP_1, 4, C.OD_IPP_2);
  const odTime3 = ws.getCell(4, C.OD_IPP_1);
  odTime3.value = '8AM - 3PM';
  headerStyle(odTime3, CLR.offdayCatBg);

  // O4:P4 = 3PM - 10PM (IPP afternoon)
  ws.mergeCells(4, C.OD_IPP_3, 4, C.OD_IPP_4);
  const odTime4 = ws.getCell(4, C.OD_IPP_3);
  odTime4.value = '3PM - 10PM';
  headerStyle(odTime4, CLR.offdayCatBg);

  // Q4:S4 = 8AM - 2PM (PRABUNGKUS)
  ws.mergeCells(4, C.OD_PP_PPF, 4, C.OD_PP_PRA_2);
  const odTime5 = ws.getCell(4, C.OD_PP_PPF);
  odTime5.value = '8AM - 2PM';
  headerStyle(odTime5, CLR.praBg);

  // T4:W4 = SETIAP HARI
  ws.mergeCells(4, C.AE_GAP, 4, C.POST_AE);
  const aeTime = ws.getCell(4, C.AE_GAP);
  aeTime.value = 'SETIAP HARI';
  headerStyle(aeTime, CLR.aeCatBg);

  // ============================================
  // ROW 5: SUB-HEADERS
  // ============================================
  ws.getRow(5).height = 51.75;

  // B5 = TARIKH
  const tarikhCell = ws.getCell(5, C.TARIKH);
  tarikhCell.value = 'TARIKH';
  headerStyle(tarikhCell, CLR.weekdayCatBg);

  // C5 = HARI
  const hariCell = ws.getCell(5, C.HARI);
  hariCell.value = 'HARI';
  headerStyle(hariCell, CLR.weekdayCatBg);

  // D5:F5 = FARMASI AMBULATORI (weekday)
  ws.mergeCells(5, C.WD_OPD_1, 5, C.WD_OPD_3);
  const wdAmb = ws.getCell(5, C.WD_OPD_1);
  wdAmb.value = 'FARMASI AMBULATORI';
  headerStyle(wdAmb, CLR.ambBg);

  // G5 = FARMASI PESAKIT DALAM (weekday)
  const wdIpp = ws.getCell(5, C.WD_IPP_1);
  wdIpp.value = 'FARMASI PESAKIT DALAM';
  headerStyle(wdIpp, CLR.ippBg);

  // H5:L5 = FARMASI AMBULATORI (offday)
  ws.mergeCells(5, C.OD_OPD_1, 5, C.OD_OPD_5);
  const odAmb = ws.getCell(5, C.OD_OPD_1);
  odAmb.value = 'FARMASI AMBULATORI';
  headerStyle(odAmb, CLR.ambBg);

  // M5:P5 = FARMASI PESAKIT DALAM (offday)
  ws.mergeCells(5, C.OD_IPP_1, 5, C.OD_IPP_4);
  const odIpp = ws.getCell(5, C.OD_IPP_1);
  odIpp.value = 'FARMASI PESAKIT DALAM';
  headerStyle(odIpp, CLR.ippBg);

  // Q5:S5 = PRABUNGKUS
  ws.mergeCells(5, C.OD_PP_PPF, 5, C.OD_PP_PRA_2);
  const odPra = ws.getCell(5, C.OD_PP_PPF);
  odPra.value = 'PRABUNGKUS';
  headerStyle(odPra, CLR.praBg);

  // T5:U5 = 10PM - 12AM
  ws.mergeCells(5, C.AE_GAP, 5, C.AE);
  const aeSub1 = ws.getCell(5, C.AE_GAP);
  aeSub1.value = '10PM - 12AM';
  headerStyle(aeSub1, CLR.aeSubBg);

  // V5:W5 = 12AM - 8AM
  ws.mergeCells(5, C.POST_AE_GAP, 5, C.POST_AE);
  const aeSub2 = ws.getCell(5, C.POST_AE_GAP);
  aeSub2.value = '12AM - 8AM';
  headerStyle(aeSub2, CLR.aeSubBg);

  // ============================================
  // DATA ROWS (row 6+)
  // ============================================
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    const dayName = getDayType(dateStr, holidayDates);
    const offday = isOffday(dateStr, holidayDates);
    const dayAssignments = rosterMap.get(dateStr);
    const postAEName = postAEMap.get(dateStr);

    const rowNum = 6 + d - 1;
    const row = ws.getRow(rowNum);
    row.height = 30.0;

    // Col A (1): empty, no border
    const emptyCell = ws.getCell(rowNum, C.EMPTY);
    emptyCell.font = { name: 'Calibri', size: 11 };
    emptyCell.border = noBorder();

    // Col B (2): date number
    const dateCell = ws.getCell(rowNum, C.TARIKH);
    dateCell.value = d;
    dataStyle(dateCell);

    // Col C (3): day name
    const dayCell = ws.getCell(rowNum, C.HARI);
    dayCell.value = dayName;
    dataStyle(dayCell);

    // Weekday columns D-G (4-7)
    for (let col = C.WD_OPD_1; col <= C.WD_IPP_1; col++) {
      const cell = ws.getCell(rowNum, col);
      if (!offday) {
        const entry = Object.entries(WEEKDAY_SLOT_MAP).find(([, c]) => c === col);
        if (entry && dayAssignments) {
          const name = dayAssignments.get(entry[0]);
          if (name) cell.value = name;
        }
      }
      dataStyle(cell);
    }

    // Offday columns H-S (8-19)
    for (let col = C.OD_OPD_1; col <= C.OD_PP_PRA_2; col++) {
      const cell = ws.getCell(rowNum, col);
      if (offday) {
        const entry = Object.entries(OFFDAY_SLOT_MAP).find(([, c]) => c === col);
        if (entry && dayAssignments) {
          const name = dayAssignments.get(entry[0]);
          if (name) cell.value = name;
        }
      }
      dataStyle(cell);
    }

    // AE gap columns T (20), V (22)
    const gap1 = ws.getCell(rowNum, C.AE_GAP);
    dataStyle(gap1);
    const gap2 = ws.getCell(rowNum, C.POST_AE_GAP);
    dataStyle(gap2);

    // AE column U (21)
    const aeCell = ws.getCell(rowNum, C.AE);
    if (dayAssignments) {
      const aeName = dayAssignments.get('AE');
      if (aeName) aeCell.value = aeName;
    }
    dataStyle(aeCell);

    // POST-AE column W (23)
    const postAECell = ws.getCell(rowNum, C.POST_AE);
    if (postAEName) postAECell.value = postAEName;
    dataStyle(postAECell);
  }

  // ============================================
  // FOOTER
  // ============================================
  const footerStartRow = 6 + daysInMonth + 1;

  // "DISEDIAKAN OLEH :" (col B)
  const preparedLabel = ws.getCell(footerStartRow, C.TARIKH);
  preparedLabel.value = 'DISEDIAKAN OLEH :';
  preparedLabel.font = { name: 'Calibri', bold: true, size: 20, color: { argb: CLR.headerFont } };
  preparedLabel.alignment = { horizontal: 'left', vertical: 'middle' };
  preparedLabel.border = noBorder();

  // "DI LULUSKAN OLEH:" (col T)
  const approvedLabel = ws.getCell(footerStartRow, C.AE_GAP);
  approvedLabel.value = 'DI LULUSKAN OLEH:';
  approvedLabel.font = { name: 'Calibri', bold: true, size: 20, color: { argb: CLR.headerFont } };
  approvedLabel.alignment = { horizontal: 'left', vertical: 'middle' };
  approvedLabel.border = noBorder();

  // Prepared by name (empty for user to fill)
  const preparedName = ws.getCell(footerStartRow + 1, C.TARIKH);
  preparedName.value = '';
  preparedName.font = { name: 'Calibri', size: 11 };

  const approvedName = ws.getCell(footerStartRow + 1, C.AE_GAP);
  approvedName.value = '';
  approvedName.font = { name: 'Calibri', size: 11 };

  // Prepared by title
  const preparedTitle = ws.getCell(footerStartRow + 2, C.TARIKH);
  preparedTitle.value = '';
  preparedTitle.font = { name: 'Calibri', size: 11, italic: true };

  const approvedTitle = ws.getCell(footerStartRow + 2, C.AE_GAP);
  approvedTitle.value = '';
  approvedTitle.font = { name: 'Calibri', size: 11, italic: true };

  // Date
  const preparedDate = ws.getCell(footerStartRow + 3, C.TARIKH);
  preparedDate.value = '';
  preparedDate.font = { name: 'Calibri', size: 11 };

  const approvedDate = ws.getCell(footerStartRow + 3, C.AE_GAP);
  approvedDate.value = '';
  approvedDate.font = { name: 'Calibri', size: 11 };

  // ============================================
  // CONDITIONAL FORMATTING (exact from template)
  // ============================================

  // Range B6:W36 - All data cells
  // Rule 1: Weekend (Sabtu/Ahad) → light gray
  ws.addConditionalFormatting({
    ref: `B6:W${5 + daysInMonth}`,
    rules: [{
      type: 'expression',
      formulae: ['OR($C6="Sabtu",$C6="Ahad")'],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFECECEC' } } },
      priority: 1,
    }],
  });
  // Rule 2: Holiday (Cuti Umum) → light peach
  ws.addConditionalFormatting({
    ref: `B6:W${5 + daysInMonth}`,
    rules: [{
      type: 'expression',
      formulae: ['$C6="Cuti Umum"'],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFBE4D5' } } },
      priority: 2,
    }],
  });
  // Rule 3: Duplicate names in row → red background
  ws.addConditionalFormatting({
    ref: `B6:W${5 + daysInMonth}`,
    rules: [{
      type: 'expression',
      formulae: ['SUMPRODUCT((COUNTIF($B6:$W6,$B6:$W6)>1)*($B6:$W6<>""))>0'],
      style: {
        fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } },
        font: { color: { argb: 'FFFFFFFF' } },
      },
      priority: 3,
    }],
  });

  // Range U6:U36 - AE column
  // Rule 1: Holiday → light red
  ws.addConditionalFormatting({
    ref: `U6:U${5 + daysInMonth}`,
    rules: [{
      type: 'expression',
      formulae: ['$C7="Cuti Umum"'],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFEA9999' } } },
      priority: 4,
    }],
  });
  // Rule 2: Weekend → light green
  ws.addConditionalFormatting({
    ref: `U6:U${5 + daysInMonth}`,
    rules: [{
      type: 'expression',
      formulae: ['OR($C7="Sabtu",$C7="Ahad")'],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFB7E1CD' } } },
      priority: 5,
    }],
  });

  // Range W6:W36 - POST-AE column
  // Rule 1: Holiday → light red
  ws.addConditionalFormatting({
    ref: `W6:W${5 + daysInMonth}`,
    rules: [{
      type: 'expression',
      formulae: ['$C6="Cuti Umum"'],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFEA9999' } } },
      priority: 6,
    }],
  });
  // Rule 2: Weekend → light green
  ws.addConditionalFormatting({
    ref: `W6:W${5 + daysInMonth}`,
    rules: [{
      type: 'expression',
      formulae: ['OR($C6="Sabtu",$C6="Ahad")'],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFB7E1CD' } } },
      priority: 7,
    }],
  });

  // Page setup
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const suffix = label === 'Asal' ? '' : `_${label}`;
  const fileName = `Jadual_OT_${monthName}_${yearStr}${suffix}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
