export const PROCESSES = [
  {
    id: "registration",
    label: "Registro de LLC",
    priceKey: "sale_price",
    fields: [
      { key: "sale_price",        label: "Precio de venta",  format: "currency" as const },
      { key: "processing_days",   label: "Días de proceso",  format: "integer" as const },
    ],
  },
  {
    id: "annual_report",
    label: "Annual Report",
    priceKey: "annual_report.fee",
    fields: [
      { key: "annual_report.fee",      label: "Fee",                   format: "currency" as const },
      { key: "annual_report.due_date", label: "Fecha de vencimiento",  format: "text" as const },
    ],
  },
  {
    id: "dissolution",
    label: "Dissolution",
    priceKey: "dissolution.fee",
    fields: [
      { key: "dissolution.fee",             label: "Fee",              format: "currency" as const },
      { key: "dissolution.processing_days", label: "Días de proceso",  format: "integer" as const },
    ],
  },
  {
    id: "amendment",
    label: "Amendment",
    priceKey: "amendments.fee",
    fields: [
      { key: "amendments.fee",       label: "Fee",        format: "currency" as const },
      { key: "amendments.available", label: "Disponible",  format: "text" as const },
    ],
  },
] as const
