export type ProcessPricing =
  | { mode: 'state'; key: string }   // precio derivado del documento del estado
  | { mode: 'fixed'; amount: number } // precio fijo
  | { mode: 'manual' }                // precio variable, lo captura el agente

export interface ProcessField {
  key: string
  label: string
  format: 'currency' | 'integer' | 'text'
}

export interface ProcessDef {
  id: string
  label: string
  pricing: ProcessPricing
  /** Campos derivados del estado que se muestran en el card informativo. */
  fields: ProcessField[]
}

export const PROCESSES: ProcessDef[] = [
  {
    id: 'registration',
    label: 'Registro de LLC',
    pricing: { mode: 'state', key: 'sale_price' },
    fields: [
      { key: 'sale_price',      label: 'Precio de venta', format: 'currency' },
      { key: 'processing_days', label: 'Días de proceso', format: 'integer' },
    ],
  },
  {
    id: 'annual_report',
    label: 'Annual Report',
    pricing: { mode: 'state', key: 'annual_report.fee' },
    fields: [
      { key: 'annual_report.fee',      label: 'Fee',                  format: 'currency' },
      { key: 'annual_report.due_date', label: 'Fecha de vencimiento', format: 'text' },
    ],
  },
  {
    id: 'dissolution',
    label: 'Dissolution',
    pricing: { mode: 'state', key: 'dissolution.fee' },
    fields: [
      { key: 'dissolution.fee',             label: 'Fee',             format: 'currency' },
      { key: 'dissolution.processing_days', label: 'Días de proceso', format: 'integer' },
    ],
  },
  {
    id: 'amendment',
    label: 'Amendment',
    pricing: { mode: 'state', key: 'amendments.fee' },
    fields: [
      { key: 'amendments.fee',       label: 'Fee',        format: 'currency' },
      { key: 'amendments.available', label: 'Disponible', format: 'text' },
    ],
  },
  {
    id: 'newspaper_research',
    label: 'Investigación de periódicos',
    pricing: { mode: 'fixed', amount: 50 },
    fields: [],
  },
  {
    id: 'newspaper_publication',
    label: 'Publicaciones en periódicos',
    pricing: { mode: 'manual' },
    fields: [],
  },
  {
    id: 'sale_tax_license',
    label: 'Sale Tax License',
    pricing: { mode: 'manual' },
    fields: [],
  },
  {
    id: 'resale_certificate',
    label: 'Resale Certificate',
    pricing: { mode: 'manual' },
    fields: [],
  },
  {
    id: 'ein',
    label: 'EIN',
    pricing: { mode: 'manual' },
    fields: [],
  },
  {
    id: 'boi',
    label: 'BOI',
    pricing: { mode: 'manual' },
    fields: [],
  },
]
