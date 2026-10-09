import type { jsPDF } from 'jspdf'
import type { Workspace } from '@/types'

// Diseño compartido de los PDF que se entregan al cliente (recibo y
// cotización): encabezado con logo y emisor, colores y formato de moneda.

export const PDF_MARGIN = 48

export const PDF_COLORS = {
  accent: [37, 99, 235] as [number, number, number], // tailwind blue-600
  muted: [107, 114, 128] as [number, number, number], // gray-500
  text: [17, 24, 39] as [number, number, number], // gray-900
  border: [229, 231, 235] as [number, number, number], // gray-200
  panel: [249, 250, 251] as [number, number, number], // gray-50
}

export function fmtCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
}

export async function fetchImageAsDataUrl(url: string): Promise<{
  dataUrl: string
  width: number
  height: number
} | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = reject
      img.src = dataUrl
    })
    return { dataUrl, ...dimensions }
  } catch {
    return null
  }
}

/** Nombre comercial que emite el documento. */
export function issuerName(workspace: Workspace): string {
  return workspace.receipt_company_name?.trim() || workspace.name
}

/** Base segura para el nombre del archivo PDF. */
export function pdfFileBase(workspace: Workspace, fallback: string): string {
  return (
    issuerName(workspace)
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || fallback
  )
}

/**
 * Encabezado: logo a la izquierda; emisor, título y líneas (número, fecha) a
 * la derecha; luego un divisor. Devuelve la `y` donde sigue el contenido.
 */
export async function drawBrandHeader(
  doc: jsPDF,
  workspace: Workspace,
  { title, lines }: { title: string; lines: string[] },
): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth()
  const margin = PDF_MARGIN
  const { accent, muted, text, border } = PDF_COLORS
  let y = margin

  let logoBottom = y
  if (workspace.receipt_logo_url) {
    const img = await fetchImageAsDataUrl(workspace.receipt_logo_url)
    if (img) {
      const maxW = 110
      const maxH = 70
      const ratio = img.width / img.height
      let w = maxW
      let h = w / ratio
      if (h > maxH) {
        h = maxH
        w = h * ratio
      }
      const fmt = img.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      try {
        doc.addImage(img.dataUrl, fmt, margin, y, w, h)
        logoBottom = y + h
      } catch {
        // fall through if format unsupported
      }
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...text)
  doc.text(issuerName(workspace), pageW - margin, y + 18, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...accent)
  doc.text(title, pageW - margin, y + 38, { align: 'right' })

  doc.setTextColor(...muted)
  doc.setFontSize(9)
  lines.forEach((line, i) => doc.text(line, pageW - margin, y + 54 + i * 14, { align: 'right' }))

  y = Math.max(logoBottom, y + 52 + lines.length * 14) + 16

  doc.setDrawColor(...border)
  doc.setLineWidth(1)
  doc.line(margin, y, pageW - margin, y)
  return y + 22
}

/**
 * "CÓMO PAGAR" con las instrucciones del workspace (si hay) y la referencia del
 * documento. Devuelve la `y` siguiente.
 */
export function drawPaymentInstructions(doc: jsPDF, workspace: Workspace, y: number, reference: string): number {
  const instructions = workspace.payment_instructions?.trim()
  if (!instructions) return y
  const margin = PDF_MARGIN
  const contentW = doc.internal.pageSize.getWidth() - margin * 2
  const { muted, text } = PDF_COLORS
  if (y > doc.internal.pageSize.getHeight() - 160) {
    doc.addPage()
    y = margin
  }
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
  doc.text(`Al pagar, menciona el documento N° ${reference}.`, margin, y)
  return y + 20
}

/** Leyenda al pie de la última página. */
export function drawFooterNote(doc: jsPDF, note: string): void {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...PDF_COLORS.muted)
  doc.text(note, pageW / 2, pageH - PDF_MARGIN - 14, { align: 'center', maxWidth: pageW - PDF_MARGIN * 2 })
}
