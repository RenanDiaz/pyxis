import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx"
import { saveAs } from "file-saver"
import type { Client } from "@/types"

const FONT = "Quattrocento Sans"
const FONT_SIZE = 24 // half-points (12pt)

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

export function exportClientDoc(client: Client): void {
  const llcName = client.llc_name?.toUpperCase() || "SIN NOMBRE DE LLC"

  const doc = new Document({
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
          field("- NOMBRE DE LA LLC", client.llc_name),
          field("- ESTADO", client.state),
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
          field("- NÚMERO TELEFÓNICO", client.phone),
          field("- CORREO ELECTRÓNICO", client.email),
          field("- DIRECCIÓN COMERCIAL DE LA EMPRESA", client.business_address),
          field("- PROPÓSITO DE LA EMPRESA", client.business_purpose),
        ],
      },
    ],
  })

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, `${llcName}.docx`)
  })
}
