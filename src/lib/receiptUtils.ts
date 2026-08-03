import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { storage, isFirebaseConfigured } from '@/lib/firebase'
import { getProcessLabel, parsePaymentDate } from '@/lib/processUtils'
import { getClientDisplayName } from '@/lib/clientUtils'
import { getProcessCompanyName } from '@/lib/companyUtils'
import type { Client, ClientProcess, Payment, PaymentMethod, Workspace } from '@/types'

const METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  zelle: 'Zelle',
  transferencia: 'Transferencia',
  stripe: 'Stripe',
  otro: 'Otro',
}

// ── Logo upload ──

const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB

export interface LogoUploadResult {
  url: string
  path: string
}

export async function uploadWorkspaceLogo(
  workspaceId: string,
  file: File
): Promise<LogoUploadResult> {
  if (!isFirebaseConfigured || !storage) throw new Error('Firebase no configurado')
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    throw new Error('Formato no soportado. Usa PNG, JPG o WEBP.')
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error('El logo no puede superar los 2 MB.')
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png'
  const path = `workspaces/${workspaceId}/branding/logo_${Date.now()}.${safeExt}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  const url = await getDownloadURL(storageRef)
  return { url, path }
}

export async function deleteWorkspaceLogo(path: string): Promise<void> {
  if (!isFirebaseConfigured || !storage) return
  try {
    await deleteObject(ref(storage, path))
  } catch {
    // Ignore: file may already be gone
  }
}

// ── PDF generation ──

function fmtCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
}

/**
 * Nombre del receptor del recibo: la compañía de ESTE proceso cuando es un
 * registro de LLC (un cliente puede tener varias), la del cliente para los
 * demás procesos, y el nombre de la persona si no hay compañía.
 */
function getRecipientName(client: Client, process: ClientProcess): string {
  const company = getProcessCompanyName(client, process) || client.llc_name?.trim()
  return company || getClientDisplayName(client)
}

function getServiceLabel(process: ClientProcess): string {
  const label = getProcessLabel(process)
  return process.state ? `${label} — ${process.state}` : label
}

async function fetchImageAsDataUrl(url: string): Promise<{
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

function buildReceiptNumber(
  client: Client,
  process: ClientProcess,
  paymentIndex: number,
  payment: Payment,
): string {
  const clientPart = client.id.slice(-4).toUpperCase()
  const processPart = process.id.slice(-3).toUpperCase()
  const parsed = parsePaymentDate(payment.date)
  const datePart = parsed ? format(parsed, 'yyMMdd') : '' // YYMMDD (fecha local)
  const seq = String(paymentIndex + 1).padStart(2, '0')
  return `R-${datePart}-${clientPart}${processPart}-${seq}`
}

interface ReceiptInput {
  client: Client
  process: ClientProcess
  payment: Payment
  paymentIndex: number
  workspace: Workspace
}

export async function generatePaymentReceipt({
  client,
  process,
  payment,
  paymentIndex,
  workspace,
}: ReceiptInput): Promise<void> {
  const payments = process.payments ?? []
  const total = process.total ?? 0
  const paidUpToThis = payments
    .slice(0, paymentIndex + 1)
    .reduce((sum, p) => sum + p.amount, 0)
  const balanceAfter = Math.max(0, total - paidUpToThis)

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 48
  let y = margin

  const companyName = workspace.receipt_company_name?.trim() || workspace.name
  const accent: [number, number, number] = [37, 99, 235] // tailwind blue-600
  const muted: [number, number, number] = [107, 114, 128] // gray-500
  const text: [number, number, number] = [17, 24, 39] // gray-900

  // ── Header: logo + company name + RECIBO ──
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
  doc.text(companyName, pageW - margin, y + 18, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...accent)
  doc.text('RECIBO DE PAGO', pageW - margin, y + 38, { align: 'right' })

  doc.setTextColor(...muted)
  doc.setFontSize(9)
  const receiptNumber = buildReceiptNumber(client, process, paymentIndex, payment)
  doc.text(`N° ${receiptNumber}`, pageW - margin, y + 54, { align: 'right' })

  const parsedPaymentDate = parsePaymentDate(payment.date)
  const paymentDate = parsedPaymentDate
    ? format(parsedPaymentDate, "d 'de' MMMM 'de' yyyy", { locale: es })
    : '—'
  doc.text(`Fecha: ${paymentDate}`, pageW - margin, y + 68, { align: 'right' })

  y = Math.max(logoBottom, y + 80) + 16

  // Divider
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(1)
  doc.line(margin, y, pageW - margin, y)
  y += 22

  // ── Recipient ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text('CLIENTE', margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(...text)
  y += 18
  const recipientName = getRecipientName(client, process)
  doc.text(recipientName, margin, y)

  // Si el receptor es la compañía, se agrega abajo el nombre de la persona.
  if (recipientName !== getClientDisplayName(client) && client.first_name) {
    y += 16
    doc.setFontSize(11)
    doc.setTextColor(...muted)
    const fullName = [client.first_name, client.middle_name, client.last_name]
      .filter(Boolean)
      .join(' ')
    if (fullName.trim()) doc.text(fullName, margin, y)
  }

  y += 28

  // ── Service ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text('SERVICIO', margin, y)

  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...text)
  doc.text(getServiceLabel(process), margin, y)

  y += 28

  // ── Payment box ──
  const boxX = margin
  const boxW = pageW - margin * 2
  const boxY = y
  const rowH = 26
  const rows: Array<[string, string, boolean?]> = [
    ['Monto pagado', fmtCurrency(payment.amount), true],
    ['Forma de pago', METHOD_LABELS[payment.method] ?? payment.method],
    ['Fecha de pago', paymentDate],
  ]
  if (total > 0) {
    rows.push(['Total acordado', fmtCurrency(total)])
    rows.push([
      'Saldo pendiente',
      balanceAfter > 0 ? fmtCurrency(balanceAfter) : 'PAGADO EN SU TOTALIDAD',
    ])
  }
  if (payment.note) {
    rows.push(['Nota', payment.note])
  }

  const boxH = rowH * rows.length + 16
  doc.setFillColor(249, 250, 251) // gray-50
  doc.setDrawColor(229, 231, 235)
  doc.roundedRect(boxX, boxY, boxW, boxH, 6, 6, 'FD')

  let rowY = boxY + 22
  rows.forEach(([label, value, highlight], i) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...muted)
    doc.text(label, boxX + 16, rowY)

    doc.setFont('helvetica', highlight ? 'bold' : 'normal')
    doc.setFontSize(highlight ? 14 : 11)
    doc.setTextColor(...(highlight ? accent : text))
    const valueLines = doc.splitTextToSize(value, boxW - 200)
    doc.text(valueLines, boxX + boxW - 16, rowY, { align: 'right' })

    if (i < rows.length - 1) {
      doc.setDrawColor(229, 231, 235)
      doc.line(boxX + 16, rowY + 8, boxX + boxW - 16, rowY + 8)
    }
    rowY += rowH
  })

  y = boxY + boxH + 30

  // ── Status banner ──
  if (total > 0) {
    const isFullyPaid = balanceAfter <= 0
    const bannerColor: [number, number, number] = isFullyPaid ? [16, 185, 129] : [249, 115, 22]
    const bannerText = isFullyPaid
      ? 'COMPROBANTE DE PAGO TOTAL'
      : 'COMPROBANTE DE PAGO PARCIAL'

    doc.setFillColor(...bannerColor)
    doc.roundedRect(margin, y, pageW - margin * 2, 32, 6, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(255, 255, 255)
    doc.text(bannerText, pageW / 2, y + 21, { align: 'center' })
    y += 50
  }

  // ── Footer ──
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...muted)
  doc.text(
    `Emitido el ${format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}`,
    margin,
    pageH - margin - 14
  )
  doc.setTextColor(...text)
  doc.setFont('helvetica', 'bold')
  doc.text('Gracias por su pago.', pageW - margin, pageH - margin - 14, {
    align: 'right',
  })

  const fileBase = (workspace.receipt_company_name || workspace.name)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'recibo'
  doc.save(`${fileBase}_${receiptNumber}.pdf`)
}
