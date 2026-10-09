import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Client, Workspace } from '@/types'
import type { Quote } from '@/lib/quote'
import { getProcessLabel } from '@/lib/processUtils'
import { getProcessCompanyName } from '@/lib/companyUtils'
import { getClientDisplayName } from '@/lib/clientUtils'
import { drawBrandHeader, fmtCurrency, pdfFileBase, PDF_COLORS, PDF_MARGIN } from '@/lib/pdfBranding'

const longDate = (d: Date) => format(d, "d 'de' MMMM 'de' yyyy", { locale: es })

function serviceLines(client: Client, quote: Quote): Array<{ label: string; detail?: string; price: number }> {
  return quote.lines.map(({ process, price }) => ({
    label: getProcessLabel(process) + (process.state ? ` — ${process.state}` : ''),
    detail: process.type === 'registration' ? getProcessCompanyName(client, process) || undefined : undefined,
    price,
  }))
}

/** Genera y descarga el PDF de la cotización (spec 15). No incluye pagos. */
export async function downloadQuotePdf(client: Client, quote: Quote, workspace: Workspace): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = PDF_MARGIN
  const contentW = pageW - margin * 2
  const { accent, muted, text, border, panel } = PDF_COLORS

  let y = await drawBrandHeader(doc, workspace, {
    title: 'COTIZACIÓN',
    lines: [`N° ${quote.number}`, `Fecha: ${longDate(quote.issuedAt)}`],
  })

  // ── Cliente ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text('PREPARADA PARA', margin, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(...text)
  doc.text(getClientDisplayName(client), margin, y)
  y += 30

  // ── Servicios ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text('SERVICIO', margin, y)
  doc.text('PRECIO', pageW - margin, y, { align: 'right' })
  y += 8
  doc.setDrawColor(...border)
  doc.line(margin, y, pageW - margin, y)
  y += 20

  for (const line of serviceLines(client, quote)) {
    if (y > pageH - 220) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...text)
    const labelLines: string[] = doc.splitTextToSize(line.label, contentW - 140)
    doc.text(labelLines, margin, y)
    doc.text(fmtCurrency(line.price), pageW - margin, y, { align: 'right' })
    y += labelLines.length * 14
    if (line.detail) {
      doc.setFontSize(9)
      doc.setTextColor(...muted)
      doc.text(line.detail, margin, y)
      y += 12
    }
    y += 6
    doc.setDrawColor(...border)
    doc.line(margin, y, pageW - margin, y)
    y += 18
  }

  // ── Total ──
  if (y > pageH - 260) {
    doc.addPage()
    y = margin
  }
  doc.setFillColor(...panel)
  doc.setDrawColor(...border)
  doc.roundedRect(margin, y, contentW, 44, 6, 6, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...muted)
  doc.text('TOTAL A PAGAR', margin + 16, y + 27)
  doc.setFontSize(18)
  doc.setTextColor(...accent)
  doc.text(fmtCurrency(quote.total), pageW - margin - 16, y + 28, { align: 'right' })
  y += 64

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...text)
  doc.text(`Válida hasta el ${longDate(quote.validUntil)}`, margin, y)
  y += 28

  // ── Instrucciones de pago ──
  const instructions = workspace.payment_instructions?.trim()
  if (instructions) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...muted)
    doc.text('CÓMO PAGAR', margin, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...text)
    const lines: string[] = doc.splitTextToSize(instructions, contentW)
    doc.text(lines, margin, y)
    y += lines.length * 13 + 12
    doc.setFontSize(9)
    doc.setTextColor(...muted)
    doc.text(`Al pagar, menciona la cotización N° ${quote.number}.`, margin, y)
  }

  // ── Leyenda ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...muted)
  doc.text(
    'Este documento no es un comprobante de pago. Precios sujetos a cambio después de la fecha de vigencia.',
    pageW / 2,
    pageH - margin - 14,
    { align: 'center', maxWidth: contentW },
  )

  doc.save(`${pdfFileBase(workspace, 'cotizacion')}_${quote.number}.pdf`)
}
