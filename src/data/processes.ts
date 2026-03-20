export const PROCESSES = [
  {
    id: "registration",
    label: "Registro de LLC",
    fields: [
      { key: "sale_price",        label: "Precio de venta",  format: "currency" as const },
      { key: "state_fee",         label: "Fee del estado",   format: "currency" as const },
      { key: "processing_days",   label: "Días de proceso",  format: "integer" as const },
    ],
  },
  {
    id: "annual_report",
    label: "Annual Report",
    fields: [
      { key: "annual_report.fee",      label: "Fee",                   format: "currency" as const },
      { key: "annual_report.due_date", label: "Fecha de vencimiento",  format: "text" as const },
    ],
  },
  {
    id: "dissolution",
    label: "Dissolution",
    fields: [
      { key: "dissolution.fee",             label: "Fee",              format: "currency" as const },
      { key: "dissolution.processing_days", label: "Días de proceso",  format: "integer" as const },
    ],
  },
  {
    id: "amendment",
    label: "Amendment",
    fields: [
      { key: "amendments.fee",       label: "Fee",        format: "currency" as const },
      { key: "amendments.available", label: "Disponible",  format: "text" as const },
    ],
  },
] as const
