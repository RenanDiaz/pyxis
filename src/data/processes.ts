export const PROCESSES = [
  {
    id: "registration",
    label: "Registro de LLC",
    fields: [
      { key: "sale_price",        label: "Precio de venta" },
      { key: "state_fee",         label: "Fee del estado" },
      { key: "processing_days",   label: "Días de proceso" },
    ],
  },
  {
    id: "annual_report",
    label: "Annual Report",
    fields: [
      { key: "annual_report.fee",      label: "Fee" },
      { key: "annual_report.due_date", label: "Fecha de vencimiento" },
    ],
  },
  {
    id: "dissolution",
    label: "Dissolution",
    fields: [
      { key: "dissolution.fee",             label: "Fee" },
      { key: "dissolution.processing_days", label: "Días de proceso" },
    ],
  },
  {
    id: "amendment",
    label: "Amendment",
    fields: [
      { key: "amendments.fee",       label: "Fee" },
      { key: "amendments.available", label: "Disponible" },
    ],
  },
] as const
