export type ProcessPricing =
  | { mode: 'state'; key: string }   // precio derivado del documento del estado
  | { mode: 'fixed'; amount: number } // precio fijo
  | { mode: 'manual' }                // precio variable, lo captura el agente

/**
 * Costo estatal / del proveedor de un proceso (STATE FEE del reporte de ventas,
 * spec 04 P8). Mismo esquema que `pricing`. El agente puede corregirlo por
 * proceso (`ClientProcess.state_cost`).
 */
export type ProcessCost =
  | { mode: 'state'; key: string }   // del documento del estado
  | { mode: 'fixed'; amount: number } // fijo (0 = sin costo estatal)
  | { mode: 'manual' }                // lo captura el agente en el proceso

export interface ProcessField {
  key: string
  label: string
  format: 'currency' | 'integer' | 'text'
}

export interface ProcessDef {
  id: string
  label: string
  pricing: ProcessPricing
  cost: ProcessCost
  /** Campos derivados del estado que se muestran en el card informativo. */
  fields: ProcessField[]
}

export const PROCESSES: ProcessDef[] = [
  {
    id: 'registration',
    label: 'Registro de LLC',
    pricing: { mode: 'state', key: 'sale_price' },
    cost: { mode: 'state', key: 'state_fee' },
    fields: [
      { key: 'sale_price',      label: 'Precio de venta', format: 'currency' },
      { key: 'processing_days', label: 'Días de proceso', format: 'integer' },
    ],
  },
  {
    id: 'annual_report',
    label: 'Annual Report',
    pricing: { mode: 'state', key: 'annual_report.fee' },
    cost: { mode: 'state', key: 'annual_report.state_cost' },
    fields: [
      { key: 'annual_report.fee',      label: 'Fee',                  format: 'currency' },
      { key: 'annual_report.due_date', label: 'Fecha de vencimiento', format: 'text' },
    ],
  },
  {
    id: 'dissolution',
    label: 'Dissolution',
    pricing: { mode: 'state', key: 'dissolution.fee' },
    cost: { mode: 'state', key: 'dissolution.state_cost' },
    fields: [
      { key: 'dissolution.fee',             label: 'Fee',             format: 'currency' },
      { key: 'dissolution.processing_days', label: 'Días de proceso', format: 'integer' },
    ],
  },
  {
    id: 'amendment',
    label: 'Amendment',
    pricing: { mode: 'state', key: 'amendments.fee' },
    cost: { mode: 'state', key: 'amendments.state_cost' },
    fields: [
      { key: 'amendments.fee',       label: 'Fee',        format: 'currency' },
      { key: 'amendments.available', label: 'Disponible', format: 'text' },
    ],
  },
  {
    id: 'newspaper_research',
    label: 'Investigación de periódicos',
    pricing: { mode: 'fixed', amount: 50 },
    cost: { mode: 'fixed', amount: 0 },
    fields: [],
  },
  {
    id: 'newspaper_publication',
    label: 'Publicaciones en periódicos',
    pricing: { mode: 'manual' },
    cost: { mode: 'manual' },
    fields: [],
  },
  {
    id: 'sale_tax_license',
    label: 'Sale Tax License',
    pricing: { mode: 'manual' },
    cost: { mode: 'fixed', amount: 0 },
    fields: [],
  },
  {
    id: 'resale_certificate',
    label: 'Resale Certificate',
    pricing: { mode: 'manual' },
    cost: { mode: 'fixed', amount: 0 },
    fields: [],
  },
  {
    id: 'ein',
    label: 'EIN',
    pricing: { mode: 'manual' },
    cost: { mode: 'fixed', amount: 0 },
    fields: [],
  },
  {
    id: 'boi',
    label: 'BOI',
    pricing: { mode: 'manual' },
    cost: { mode: 'fixed', amount: 0 },
    fields: [],
  },
  {
    id: 'statement_of_formation',
    label: 'Statement of Formation',
    pricing: { mode: 'manual' },
    cost: { mode: 'manual' },
    fields: [],
  },
  {
    // Trámite de la persona, no de una compañía: no depende del estado.
    id: 'itin',
    label: 'ITIN',
    pricing: { mode: 'fixed', amount: 700 },
    cost: { mode: 'fixed', amount: 250 },
    fields: [],
  },
]
