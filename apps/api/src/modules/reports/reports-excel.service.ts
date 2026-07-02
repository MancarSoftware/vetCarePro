import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { ReportSection } from './dto/reports-query.dto';
import type { ReportsSummary } from './reports.service';

interface ReportRow {
  section: string;
  indicator: string;
  detail: string;
  value: string | number | Date;
}

interface SheetRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

const palette = {
  teal: '009688',
  tealDark: '006C67',
  tealSoft: 'E6FFFA',
  slate: '0F172A',
  muted: '64748B',
  blue: '2563EB',
  amber: 'F59E0B',
  rose: 'E11D48',
  violet: '7C3AED',
  emerald: '10B981',
  border: 'D9E2EC',
  panel: 'F8FAFC',
  white: 'FFFFFF',
};

@Injectable()
export class ReportsExcelService {
  async buildWorkbook(
    summary: ReportsSummary,
    section: ReportSection,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VetCare Pro';
    workbook.lastModifiedBy = 'VetCare Pro';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    const rows = this.reportRows(summary, section);
    this.buildDashboard(workbook, summary);
    this.buildFinancialSheet(workbook, summary);
    this.buildAppointmentsSheet(workbook, summary);
    this.buildClinicalSheet(workbook, summary);
    this.buildInventorySheet(workbook, summary);
    this.buildDataSheet(workbook, rows);

    const output = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(output) ? output : Buffer.from(output);
  }

  filename(summary: ReportsSummary, section: ReportSection) {
    return `vetcare_reportes_${section}_${summary.range.from}_${summary.range.to}.xlsx`;
  }

  private buildDashboard(workbook: ExcelJS.Workbook, summary: ReportsSummary) {
    const sheet = workbook.addWorksheet('Dashboard', {
      views: [{ showGridLines: false }],
      properties: { defaultRowHeight: 22 },
    });
    sheet.columns = [
      { width: 16 },
      { width: 18 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
      { width: 18 },
    ];

    this.title(sheet, 'A1:H1', 'VetCare Pro | Reporte ejecutivo');
    this.subtitle(
      sheet,
      'A2:H2',
      `Periodo ${summary.range.from} a ${summary.range.to} | Generado ${this.formatDateTime(summary.generatedAt)}`,
    );

    this.kpi(sheet, 'A4:B7', 'Ingresos cobrados', summary.financial.income, 'money', palette.teal);
    this.kpi(sheet, 'C4:D7', 'Saldo por cobrar', summary.financial.outstanding, 'money', palette.amber);
    this.kpi(sheet, 'E4:F7', 'Citas atendidas', summary.appointments.completed, 'number', palette.blue);
    this.kpi(sheet, 'G4:H7', 'Vacunas pendientes', summary.clinical.vaccinesPending, 'number', palette.rose);

    this.sectionTitle(sheet, 'A9:D9', 'Ingresos por mes');
    const monthRows = summary.financial.incomeByMonth.length
      ? summary.financial.incomeByMonth
      : [{ month: 'Sin datos', total: 0 }];
    sheet.getCell('A10').value = 'Mes';
    sheet.getCell('B10').value = 'Ingresos';
    sheet.getCell('C10').value = 'Visual';
    this.header(sheet, 'A10:C10');
    monthRows.forEach((item, index) => {
      const row = 11 + index;
      sheet.getCell(row, 1).value = item.month;
      sheet.getCell(row, 2).value = item.total;
      sheet.getCell(row, 2).numFmt = '$#,##0.00';
      sheet.getCell(row, 3).value = {
        formula: `REPT("█",MAX(1,ROUND(B${row}/MAX($B$11:$B$${10 + monthRows.length})*24,0)))`,
      };
      sheet.getCell(row, 3).font = { color: { argb: palette.teal }, bold: true };
    });
    this.tableFrame(sheet, `A10:C${10 + monthRows.length}`);

    this.sectionTitle(sheet, 'E9:H9', 'Agenda y operación');
    const agenda = [
      ['Total de citas', summary.appointments.total, palette.slate],
      ['Atendidas', summary.appointments.completed, palette.emerald],
      ['Confirmadas', summary.appointments.confirmed, palette.blue],
      ['Pendientes', summary.appointments.pending, palette.amber],
      ['Canceladas', summary.appointments.cancelled, palette.rose],
      ['No asistió', summary.appointments.noShow, palette.rose],
    ];
    agenda.forEach((item, index) => {
      const row = 10 + index;
      sheet.getCell(row, 5).value = item[0] as string;
      sheet.getCell(row, 6).value = item[1] as number;
      sheet.getCell(row, 7).value = {
        formula: `IF($F$10=0,"",REPT("█",ROUND(F${row}/$F$10*18,0)))`,
      };
      sheet.getCell(row, 7).font = { color: { argb: item[2] as string }, bold: true };
    });
    this.tableFrame(sheet, 'E10:G15');

    this.sectionTitle(sheet, 'A20:D20', 'Top productos vendidos');
    const products = summary.inventory.productsSold.length
      ? summary.inventory.productsSold
      : [{ name: 'Sin ventas', quantity: 0, total: 0, productId: null }];
    this.setValues(sheet, 'A21', [['Producto', 'Cantidad', 'Total', 'Visual']]);
    this.header(sheet, 'A21:D21');
    products.forEach((item, index) => {
      const row = 22 + index;
      sheet.getCell(row, 1).value = item.name;
      sheet.getCell(row, 2).value = item.quantity;
      sheet.getCell(row, 3).value = item.total;
      sheet.getCell(row, 3).numFmt = '$#,##0.00';
      sheet.getCell(row, 4).value = {
        formula: `REPT("█",MAX(1,ROUND(C${row}/MAX($C$22:$C$${21 + products.length})*18,0)))`,
      };
      sheet.getCell(row, 4).font = { color: { argb: palette.violet }, bold: true };
    });
    this.tableFrame(sheet, `A21:D${21 + products.length}`);

    this.sectionTitle(sheet, 'E20:H20', 'Alertas clínicas e inventario');
    const alerts = [
      ['Vacunas vencidas', summary.clinical.vaccinesOverdue],
      ['Desparasitaciones vencidas', summary.clinical.dewormingsOverdue],
      ['Stock bajo', summary.inventory.lowStock],
      ['Sin existencias', summary.inventory.outOfStock],
      ['Lotes por vencer', summary.inventory.expiringSoon],
      ['Tratamientos activos', summary.clinical.treatmentsActive],
    ];
    alerts.forEach((item, index) => {
      const row = 21 + index;
      sheet.getCell(row, 5).value = item[0] as string;
      sheet.getCell(row, 6).value = item[1] as number;
      sheet.getCell(row, 6).font = {
        bold: true,
        color: { argb: Number(item[1]) > 0 ? palette.rose : palette.emerald },
      };
    });
    this.tableFrame(sheet, 'E21:F26');
    sheet.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }];
  }

  private buildFinancialSheet(workbook: ExcelJS.Workbook, summary: ReportsSummary) {
    const sheet = this.moduleSheet(workbook, 'Finanzas', 'Finanzas y cobranza');
    const rows: Array<[string, number]> = [
      ['Ingresos cobrados', summary.financial.income],
      ['Saldo por cobrar', summary.financial.outstanding],
      ['Saldo vencido', summary.financial.overdueAmount],
      ['Documentos pagados', summary.financial.paidDocuments],
      ['Documentos pendientes', summary.financial.pendingDocuments],
      ['Ticket promedio', summary.financial.averageTicket],
    ];
    this.writeMetricTable(sheet, 'A4:B10', ['Indicador', 'Valor'], rows, 'moneyMixed');

    this.setValues(sheet, 'D4', [['Mes', 'Ingresos', 'Visual']]);
    this.header(sheet, 'D4:F4');
    summary.financial.incomeByMonth.forEach((item, index) => {
      const row = 5 + index;
      sheet.getCell(row, 4).value = item.month;
      sheet.getCell(row, 5).value = item.total;
      sheet.getCell(row, 5).numFmt = '$#,##0.00';
      sheet.getCell(row, 6).value = {
        formula: `REPT("█",MAX(1,ROUND(E${row}/MAX($E$5:$E$${4 + summary.financial.incomeByMonth.length})*22,0)))`,
      };
      sheet.getCell(row, 6).font = { color: { argb: palette.teal }, bold: true };
    });
    this.tableFrame(sheet, `D4:F${Math.max(5, 4 + summary.financial.incomeByMonth.length)}`);
  }

  private buildAppointmentsSheet(workbook: ExcelJS.Workbook, summary: ReportsSummary) {
    const sheet = this.moduleSheet(workbook, 'Citas', 'Agenda y citas');
    const rows: Array<[string, number]> = [
      ['Total', summary.appointments.total],
      ['Atendidas', summary.appointments.completed],
      ['Confirmadas', summary.appointments.confirmed],
      ['Pendientes', summary.appointments.pending],
      ['Canceladas', summary.appointments.cancelled],
      ['No asistió', summary.appointments.noShow],
    ];
    this.writeMetricTable(sheet, 'A4:B10', ['Estado', 'Cantidad'], rows, 'number');
    this.writeSimpleTable(
      sheet,
      'D4:F4',
      ['Tipo', 'Cantidad', 'Visual'],
      summary.appointments.byType.map((item) => [item.type, item.count]),
      palette.blue,
    );
    this.writeSimpleTable(
      sheet,
      'H4:J4',
      ['Estado', 'Cantidad', 'Visual'],
      summary.appointments.byStatus.map((item) => [item.status, item.count]),
      palette.emerald,
    );
  }

  private buildClinicalSheet(workbook: ExcelJS.Workbook, summary: ReportsSummary) {
    const sheet = this.moduleSheet(workbook, 'Clinica', 'Actividad clínica');
    this.writeMetricTable(sheet, 'A4:B14', ['Indicador', 'Cantidad'], [
      ['Historiales creados', summary.clinical.medicalRecords],
      ['Vacunas aplicadas', summary.clinical.vaccinesApplied],
      ['Vacunas pendientes', summary.clinical.vaccinesPending],
      ['Vacunas vencidas', summary.clinical.vaccinesOverdue],
      ['Desparasitaciones aplicadas', summary.clinical.dewormingsApplied],
      ['Desparasitaciones pendientes', summary.clinical.dewormingsPending],
      ['Desparasitaciones vencidas', summary.clinical.dewormingsOverdue],
      ['Tratamientos activos', summary.clinical.treatmentsActive],
      ['Tratamientos en control', summary.clinical.treatmentsFollowUp],
      ['Tratamientos finalizados', summary.clinical.treatmentsCompleted],
    ], 'number');
  }

  private buildInventorySheet(workbook: ExcelJS.Workbook, summary: ReportsSummary) {
    const sheet = this.moduleSheet(workbook, 'Inventario', 'Inventario y productos');
    this.writeMetricTable(sheet, 'A4:B8', ['Indicador', 'Valor'], [
      ['Stock bajo', summary.inventory.lowStock],
      ['Sin existencias', summary.inventory.outOfStock],
      ['Lotes por vencer', summary.inventory.expiringSoon],
      ['Valor estimado', summary.inventory.inventoryValue],
    ], 'moneyMixed');
    this.writeSimpleTable(
      sheet,
      'D4:G4',
      ['Producto', 'Cantidad', 'Total', 'Visual'],
      summary.inventory.productsSold.map((item) => [
        item.name,
        item.quantity,
        item.total,
      ]),
      palette.violet,
      true,
    );
  }

  private buildDataSheet(workbook: ExcelJS.Workbook, rows: ReportRow[]) {
    const sheet = workbook.addWorksheet('Datos auditables', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    });
    sheet.columns = [
      { header: 'Seccion', key: 'section', width: 18 },
      { header: 'Indicador', key: 'indicator', width: 30 },
      { header: 'Detalle', key: 'detail', width: 34 },
      { header: 'Valor', key: 'value', width: 18 },
    ];
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).height = 24;
    this.header(sheet, 'A1:D1');
    this.tableFrame(sheet, `A1:D${rows.length + 1}`);
    sheet.autoFilter = `A1:D${rows.length + 1}`;
  }

  private moduleSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    title: string,
  ) {
    const sheet = workbook.addWorksheet(name, {
      views: [{ showGridLines: false }],
      properties: { defaultRowHeight: 22 },
    });
    sheet.columns = Array.from({ length: 10 }, () => ({ width: 18 }));
    this.title(sheet, 'A1:J1', `VetCare Pro | ${title}`);
    this.subtitle(sheet, 'A2:J2', 'Reporte exportado en formato Excel profesional');
    sheet.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }];
    return sheet;
  }

  private writeMetricTable(
    sheet: ExcelJS.Worksheet,
    headerRange: string,
    headers: string[],
    rows: Array<[string, number]>,
    format: 'number' | 'moneyMixed',
  ) {
    const start = this.parseRange(headerRange);
    this.setValues(sheet, this.address(start.top, start.left), [headers]);
    this.header(sheet, headerRange);
    rows.forEach(([label, value], index) => {
      const row = start.top + 1 + index;
      const col = start.left;
      sheet.getCell(row, col).value = label;
      sheet.getCell(row, col + 1).value = value;
      sheet.getCell(row, col + 1).numFmt =
        format === 'number' || Number.isInteger(value) ? '#,##0' : '$#,##0.00';
    });
    this.tableFrame(sheet, this.rangeByIndexes(start.top, start.left, rows.length + 1, headers.length));
  }

  private writeSimpleTable(
    sheet: ExcelJS.Worksheet,
    headerRange: string,
    headers: string[],
    rows: Array<Array<string | number>>,
    color: string,
    currencyTotal = false,
  ) {
    const start = this.parseRange(headerRange);
    this.setValues(sheet, this.address(start.top, start.left), [headers]);
    this.header(sheet, headerRange);
    const safeRows = rows.length ? rows : [['Sin datos', 0, 0].slice(0, headers.length - 1)];
    safeRows.forEach((values, index) => {
      const row = start.top + 1 + index;
      const col = start.left;
      values.forEach((value, valueIndex) => {
        sheet.getCell(row, col + valueIndex).value = value;
      });
      const numericCol = col + 1;
      const visualCol = col + headers.length - 1;
      if (currencyTotal && headers.length >= 4) {
        sheet.getCell(row, col + 2).numFmt = '$#,##0.00';
      }
      sheet.getCell(row, visualCol).value = {
        formula: `REPT("█",MAX(1,ROUND(${sheet.getCell(row, numericCol).address}/MAX(${sheet.getCell(start.top + 1, numericCol).address}:${sheet.getCell(start.top + safeRows.length, numericCol).address})*18,0)))`,
      };
      sheet.getCell(row, visualCol).font = { color: { argb: color }, bold: true };
    });
    this.tableFrame(sheet, this.rangeByIndexes(start.top, start.left, safeRows.length + 1, headers.length));
  }

  private title(sheet: ExcelJS.Worksheet, range: string, value: string) {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = value;
    cell.font = { bold: true, size: 18, color: { argb: palette.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.tealDark } };
    sheet.getRow(Number(cell.row)).height = 34;
  }

  private subtitle(sheet: ExcelJS.Worksheet, range: string, value: string) {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = value;
    cell.font = { size: 10, color: { argb: palette.muted } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.tealSoft } };
  }

  private sectionTitle(sheet: ExcelJS.Worksheet, range: string, value: string) {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = value;
    cell.font = { bold: true, size: 12, color: { argb: palette.slate } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.panel } };
    cell.border = { bottom: { style: 'thin', color: { argb: palette.border } } };
  }

  private kpi(
    sheet: ExcelJS.Worksheet,
    range: string,
    label: string,
    value: number,
    format: 'money' | 'number',
    color: string,
  ) {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = `${label}\n${format === 'money' ? '$' : ''}${format === 'money' ? value.toLocaleString('en-US', { minimumFractionDigits: 2 }) : value.toLocaleString('en-US')}`;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.font = { bold: true, size: 13, color: { argb: color } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.white } };
    cell.border = {
      top: { style: 'medium', color: { argb: color } },
      left: { style: 'thin', color: { argb: palette.border } },
      bottom: { style: 'thin', color: { argb: palette.border } },
      right: { style: 'thin', color: { argb: palette.border } },
    };
  }

  private header(sheet: ExcelJS.Worksheet, rangeAddress: string) {
    this.eachCell(sheet, rangeAddress, (cell) => {
      cell.font = { bold: true, color: { argb: palette.white } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.teal } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: palette.tealDark } } };
    });
  }

  private tableFrame(sheet: ExcelJS.Worksheet, rangeAddress: string) {
    this.eachCell(sheet, rangeAddress, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: palette.border } },
        left: { style: 'thin', color: { argb: palette.border } },
        bottom: { style: 'thin', color: { argb: palette.border } },
        right: { style: 'thin', color: { argb: palette.border } },
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  }

  private setValues(
    sheet: ExcelJS.Worksheet,
    topLeft: string,
    values: Array<Array<string | number | Date | null>>,
  ) {
    const start = this.parseCell(topLeft);
    values.forEach((rowValues, rowIndex) => {
      rowValues.forEach((value, colIndex) => {
        sheet.getCell(start.row + rowIndex, start.col + colIndex).value = value;
      });
    });
  }

  private eachCell(
    sheet: ExcelJS.Worksheet,
    rangeAddress: string,
    callback: (cell: ExcelJS.Cell) => void,
  ) {
    const range = this.parseRange(rangeAddress);
    for (let row = range.top; row <= range.bottom; row += 1) {
      for (let col = range.left; col <= range.right; col += 1) {
        callback(sheet.getCell(row, col));
      }
    }
  }

  private parseRange(rangeAddress: string): SheetRange {
    const [start, end = start] = rangeAddress.split(':');
    const topLeft = this.parseCell(start);
    const bottomRight = this.parseCell(end);
    return {
      top: Math.min(topLeft.row, bottomRight.row),
      left: Math.min(topLeft.col, bottomRight.col),
      bottom: Math.max(topLeft.row, bottomRight.row),
      right: Math.max(topLeft.col, bottomRight.col),
    };
  }

  private parseCell(address: string): { row: number; col: number } {
    const match = /^([A-Z]+)(\d+)$/i.exec(address);
    if (!match) {
      throw new Error(`Direccion de celda invalida: ${address}`);
    }
    return {
      col: this.columnNumber(match[1].toUpperCase()),
      row: Number(match[2]),
    };
  }

  private columnNumber(column: string): number {
    return column
      .split('')
      .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
  }

  private columnName(column: number): string {
    let value = column;
    let name = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  }

  private address(row: number, col: number): string {
    return `${this.columnName(col)}${row}`;
  }

  private rangeByIndexes(
    top: number,
    left: number,
    rowCount: number,
    colCount: number,
  ): string {
    return `${this.address(top, left)}:${this.address(
      top + rowCount - 1,
      left + colCount - 1,
    )}`;
  }

  private reportRows(summary: ReportsSummary, section: ReportSection): ReportRow[] {
    const rows: ReportRow[] = [
      {
        section: 'Rango',
        indicator: 'Periodo',
        detail: `${summary.range.from} a ${summary.range.to}`,
        value: new Date(summary.generatedAt),
      },
    ];
    const include = (target: ReportSection) =>
      section === 'all' || section === target;

    if (include('financial')) {
      rows.push(
        { section: 'Finanzas', indicator: 'Ingresos cobrados', detail: '', value: summary.financial.income },
        { section: 'Finanzas', indicator: 'Saldo por cobrar', detail: '', value: summary.financial.outstanding },
        { section: 'Finanzas', indicator: 'Saldo vencido', detail: '', value: summary.financial.overdueAmount },
        { section: 'Finanzas', indicator: 'Documentos pagados', detail: '', value: summary.financial.paidDocuments },
        { section: 'Finanzas', indicator: 'Documentos pendientes', detail: '', value: summary.financial.pendingDocuments },
        { section: 'Finanzas', indicator: 'Ticket promedio', detail: '', value: summary.financial.averageTicket },
        ...summary.financial.incomeByMonth.map((item) => ({
          section: 'Finanzas',
          indicator: 'Ingresos por mes',
          detail: item.month,
          value: item.total,
        })),
      );
    }
    if (include('appointments')) {
      rows.push(
        { section: 'Citas', indicator: 'Total', detail: '', value: summary.appointments.total },
        { section: 'Citas', indicator: 'Atendidas', detail: '', value: summary.appointments.completed },
        { section: 'Citas', indicator: 'Confirmadas', detail: '', value: summary.appointments.confirmed },
        { section: 'Citas', indicator: 'Pendientes', detail: '', value: summary.appointments.pending },
        { section: 'Citas', indicator: 'Canceladas', detail: '', value: summary.appointments.cancelled },
        { section: 'Citas', indicator: 'No asistió', detail: '', value: summary.appointments.noShow },
        ...summary.appointments.byType.map((item) => ({
          section: 'Citas',
          indicator: 'Por tipo',
          detail: item.type,
          value: item.count,
        })),
      );
    }
    if (include('clinical')) {
      rows.push(
        { section: 'Clínica', indicator: 'Historiales creados', detail: '', value: summary.clinical.medicalRecords },
        { section: 'Clínica', indicator: 'Vacunas aplicadas', detail: '', value: summary.clinical.vaccinesApplied },
        { section: 'Clínica', indicator: 'Vacunas pendientes', detail: '', value: summary.clinical.vaccinesPending },
        { section: 'Clínica', indicator: 'Vacunas vencidas', detail: '', value: summary.clinical.vaccinesOverdue },
        { section: 'Clínica', indicator: 'Desparasitaciones aplicadas', detail: '', value: summary.clinical.dewormingsApplied },
        { section: 'Clínica', indicator: 'Tratamientos activos', detail: '', value: summary.clinical.treatmentsActive },
        { section: 'Clínica', indicator: 'Tratamientos en control', detail: '', value: summary.clinical.treatmentsFollowUp },
      );
    }
    if (include('inventory')) {
      rows.push(
        { section: 'Inventario', indicator: 'Stock bajo', detail: '', value: summary.inventory.lowStock },
        { section: 'Inventario', indicator: 'Sin existencias', detail: '', value: summary.inventory.outOfStock },
        { section: 'Inventario', indicator: 'Lotes por vencer', detail: '', value: summary.inventory.expiringSoon },
        { section: 'Inventario', indicator: 'Valor estimado', detail: '', value: summary.inventory.inventoryValue },
        ...summary.inventory.productsSold.map((item) => ({
          section: 'Inventario',
          indicator: 'Productos vendidos',
          detail: `${item.name} (${item.quantity})`,
          value: item.total,
        })),
      );
    }
    if (section === 'all') {
      rows.push(
        { section: 'Clientes', indicator: 'Dueños registrados', detail: '', value: summary.clients.ownersRegistered },
        { section: 'Clientes', indicator: 'Mascotas registradas', detail: '', value: summary.clients.petsRegistered },
      );
    }
    return rows;
  }

  private formatDateTime(value: string) {
    return new Intl.DateTimeFormat('es-EC', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}
