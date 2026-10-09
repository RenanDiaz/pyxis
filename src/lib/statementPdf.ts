import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { PaymentMethod, Workspace } from '@/types'
import type { AccountStatement, StatementPayment } from '@/lib/accountStatement'
import {
  drawBrandHeader,
  drawFooterNote,
  drawPaymentInstructions,
  fmtCurrency,
  pdfFileBase,
  PDF_COLORS,
  PDF_MARGIN,
} from '@/lib/pdfBranding'

const METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  zelle: 'Zelle',
  transferencia: 'Transferencia',
  stripe: 'Stripe',
  otro: 'Otro',
}

const longDate = (d: Date) => format(d, "d 'de' MMMM 'de' yyyy", { locale: es })
const paymentDate = (p: StatementPayment) =>
  p.date ? format(p.date, p.dateOnly ? 'dd/MM/yyyy' : 'dd/MM/yyyy h:mm a', { locale: es }) : '—'

/** Genera y descarga el estado de cuenta (spec 16). */
export async function downloadStatementPdf(statement: AccountStatement, workspace: Workspace): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = PDF_MARGIN
  const contentW = pageW - margin * 2
  const right = pageW - margin
  const { accent, muted, text, border, panel } = PDF_COLORS
  const ensureSpace = (needed: number, y: number) => {
    if (y + needed <= pageH - 80) return y
    doc.addPage()
    return margin
  }

  let y = await drawBrandHeader(doc, workspace, {
    title: 'ESTADO DE CUENTA',
    lines: [`N° ${statement.number}`, `Fecha: ${longDate(statement.issuedAt)}`],
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text('CLIENTE', margin, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(...text)
  doc.text(statement.recipient, margin, y)
  y += 30

  // ── Un bloque por proceso ──
  for (const line of statement.lines) {
    y = ensureSpace(90 + line.payments.length * 14, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...text)
    doc.text(line.label, margin, y)
    y += 14
    if (line.detail) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...muted)
      doc.text(line.detail, margin, y)
      y += 12
    }
    y += 4

    // Total / Pagado / Saldo
    const colW = contentW / 3
    const cells: Array<[string, string, boolean]> = [
      ['Total acordado', fmtCurrency(line.total), false],
      ['Pagado', fmtCurrency(line.paid), false],
      [line.balance < 0 ? 'Saldo a favor' : 'Saldo', fmtCurrency(Math.abs(line.balance)), line.balance > 0],
    ]
    doc.setFillColor(...panel)
    doc.setDrawColor(...border)
    doc.roundedRect(margin, y, contentW, 40, 4, 4, 'FD')
    cells.forEach(([label, value, strong], i) => {
      const x = margin + colW * i + 12
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...muted)
      doc.text(label.toUpperCase(), x, y + 15)
      doc.setFont('helvetica', strong ? 'bold' : 'normal')
      doc.setFontSize(11)
      doc.setTextColor(...(strong ? accent : text))
      doc.text(value, x, y + 31)
    })
    y += 54

    // Pagos
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    if (line.payments.length === 0) {
      doc.setTextColor(...muted)
      doc.text('Sin pagos registrados.', margin, y)
      y += 14
    } else {
      for (const p of line.payments) {
        doc.setTextColor(...muted)
        doc.text(`${paymentDate(p)} · ${METHOD_LABELS[p.method] ?? p.method} · Recibo N° ${p.receiptNumber}`, margin, y)
        doc.setTextColor(...text)
        doc.text(fmtCurrency(p.amount), right, y, { align: 'right' })
        y += 14
      }
    }
    y += 10
    doc.setDrawColor(...border)
    doc.line(margin, y, right, y)
    y += 22
  }

  // ── Resumen ──
  y = ensureSpace(120, y)
  const summary: Array<[string, string]> = [
    ['Total de servicios', fmtCurrency(statement.total)],
    ['Total pagado', fmtCurrency(statement.paid)],
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const [label, value] of summary) {
    doc.setTextColor(...muted)
    doc.text(label, margin, y)
    doc.setTextColor(...text)
    doc.text(value, right, y, { align: 'right' })
    y += 16
  }
  y += 6
  const owes = statement.balance > 0
  doc.setFillColor(...panel)
  doc.setDrawColor(...border)
  doc.roundedRect(margin, y, contentW, 44, 6, 6, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...muted)
  doc.text(owes ? 'SALDO PENDIENTE' : statement.balance < 0 ? 'SALDO A FAVOR' : 'CUENTA AL DÍA', margin + 16, y + 27)
  doc.setFontSize(18)
  doc.setTextColor(...(owes ? accent : text))
  doc.text(fmtCurrency(Math.abs(statement.balance)), right - 16, y + 28, { align: 'right' })
  y += 70

  if (owes) drawPaymentInstructions(doc, workspace, y, statement.number)
  drawFooterNote(
    doc,
    `Este documento no es un recibo ni un comprobante de pago. Saldos al ${longDate(statement.issuedAt)}.`,
  )

  doc.save(`${pdfFileBase(workspace, 'estado_de_cuenta')}_${statement.number}.pdf`)
}
