import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx"
import { saveAs } from "file-saver"
import type { Client, ClientProcess } from "@/types"
import { getPrimaryPhoneNumber } from "@/lib/clientUtils"

const FONT = "Quattrocento Sans"
const FONT_SIZE = 24 // half-points (12pt)

/** Pausa entre descargas consecutivas para que el navegador no las descarte. */
const MULTI_DOWNLOAD_DELAY_MS = 500

/** Datos de la compañía (LLC) que se imprimen en el documento. */
interface CompanyInfo {
  llc_name?: string
  state?: string
  business_address?: string
  business_purpose?: string
}

function field(label: string, value?: string, tabbed?: boolean): Paragraph {
  const prefix = tabbed ? "\t" : ""
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 40 },
    children: [
      new TextRun({ text: `${prefix}${label}: `, bold: true, font: FONT, size: FONT_SIZE }),
      new TextRun({ text: value || "", font: FONT, size: FONT_SIZE }),
    ],
  })
}

function partnerSection(partners: Client["partners"]): Paragraph[] {
  if (!partners || partners.length === 0) return []

  const paragraphs: Paragraph[] = [
    new Paragraph({ spacing: { after: 100 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `- SOCIOS DE LA LLC (${partners.length}):`, bold: true, font: FONT, size: FONT_SIZE }),
      ],
    }),
  ]

  partners.forEach((partner, i) => {
    paragraphs.push(
      new Paragraph({ spacing: { after: 60 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `\tSOCIO ${i + 1}:`, bold: true, font: FONT, size: FONT_SIZE }),
        ],
      }),
      field("● NOMBRE", partner.first_name, true),
      field("● APELLIDOS", partner.last_name, true),
    )
    if (partner.ssn_itin) {
      paragraphs.push(field("● SSN O ITIN", partner.ssn_itin, true))
    }
    if (partner.address) {
      paragraphs.push(field("● DIRECCIÓN", partner.address, true))
    }
    if (partner.ownership_percentage) {
      paragraphs.push(field("● PARTICIPACIÓN", `${partner.ownership_percentage}%`, true))
    }
  })

  return paragraphs
}

function buildDoc(client: Client, company: CompanyInfo): Document {
  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, bottom: 900, left: 1080, right: 1080 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "📄 INFORMACIÓN REGISTRADA:", bold: true, font: FONT, size: FONT_SIZE }),
            ],
          }),
          new Paragraph({ spacing: { after: 100 }, children: [] }),
          field("- NOMBRE DE LA LLC", company.llc_name),
          field("- ESTADO", company.state),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 40 },
            children: [
              new TextRun({ text: "- NOMBRES Y APELLIDOS DEL CLIENTE:", bold: true, font: FONT, size: FONT_SIZE }),
            ],
          }),
          new Paragraph({ spacing: { after: 40 }, children: [] }),
          field("● PRIMER NOMBRE", client.first_name, true),
          field("● SEGUNDO NOMBRE", client.middle_name, true),
          field("● APELLIDOS", client.last_name, true),
          field("- SSN O ITIN", client.ssn_itin),
          field("- NÚMERO TELEFÓNICO", getPrimaryPhoneNumber(client)),
          field("- CORREO ELECTRÓNICO", client.email),
          field("- DIRECCIÓN COMERCIAL DE LA EMPRESA", company.business_address),
          field("- PROPÓSITO DE LA EMPRESA", company.business_purpose),
          ...partnerSection(client.partners),
        ],
      },
    ],
  })
}

/** Caracteres que Windows/macOS no aceptan en nombres de archivo. */
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim()
}

async function saveDoc(doc: Document, fileName: string): Promise<void> {
  const blob = await Packer.toBlob(doc)
  saveAs(blob, fileName)
}

// ── Compañías del cliente ──

/** Los procesos de registro de LLC del cliente: una compañía por proceso. */
export function getRegistrationProcesses(client: Client): ClientProcess[] {
  return (client.processes ?? []).filter((p) => p.type === "registration")
}

/**
 * Nombre de la compañía de un proceso de registro. Cae al `llc_name` del
 * cliente cuando el proceso todavía no tiene nombre propio (datos previos a
 * los registros múltiples).
 */
export function getProcessCompanyName(client: Client, process: ClientProcess): string {
  return (process.llc_name || "").trim() || (client.llc_name || "").trim()
}

function companyFromProcess(client: Client, process: ClientProcess): CompanyInfo {
  return {
    llc_name: getProcessCompanyName(client, process),
    state: process.state || client.state,
    business_address: (process.business_address || "").trim() || client.business_address,
    business_purpose: (process.business_purpose || "").trim() || client.business_purpose,
  }
}

function companyFromClient(client: Client): CompanyInfo {
  return {
    llc_name: client.llc_name,
    state: client.state,
    business_address: client.business_address,
    business_purpose: client.business_purpose,
  }
}

function baseFileName(company: CompanyInfo): string {
  return sanitizeFileName(company.llc_name?.toUpperCase() || "SIN NOMBRE DE LLC")
}

// ── Exportación ──

/** Exporta el .docx de UNA compañía (un proceso de registro). */
export async function exportRegistrationDoc(
  client: Client,
  process: ClientProcess,
): Promise<void> {
  const company = companyFromProcess(client, process)
  await saveDoc(buildDoc(client, company), `${baseFileName(company)}.docx`)
}

/**
 * Exporta un .docx por cada proceso de registro del cliente: una compañía, un
 * documento. Si el cliente no tiene procesos de registro, exporta un único
 * documento con los datos de LLC del cliente (comportamiento anterior).
 * Devuelve cuántos documentos se generaron.
 */
export async function exportClientDoc(client: Client): Promise<number> {
  const registrations = getRegistrationProcesses(client)

  if (registrations.length === 0) {
    const company = companyFromClient(client)
    await saveDoc(buildDoc(client, company), `${baseFileName(company)}.docx`)
    return 1
  }

  // Dos registros pueden compartir nombre (o no tenerlo aún): numeramos los
  // repetidos para que el navegador no sobreescriba ni renombre a ciegas.
  const usedNames = new Map<string, number>()

  for (let i = 0; i < registrations.length; i++) {
    const company = companyFromProcess(client, registrations[i])
    const base = baseFileName(company)
    const seen = usedNames.get(base) ?? 0
    usedNames.set(base, seen + 1)
    const fileName = seen === 0 ? `${base}.docx` : `${base} (${seen + 1}).docx`

    await saveDoc(buildDoc(client, company), fileName)

    if (i < registrations.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, MULTI_DOWNLOAD_DELAY_MS))
    }
  }

  return registrations.length
}
