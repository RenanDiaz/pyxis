import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useUpdateState } from '@/hooks/useStates'
import { toast } from 'sonner'
import type { StateInfo } from '@/types'

interface StateEditDialogProps {
  state: StateInfo
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface StateFormValues {
  sale_price: string
  state_fee: string
  processing_days: string
  annual_report_fee: string
  annual_report_due_date: string
  dissolution_fee: string
  dissolution_processing_days: string
  amendments_available: boolean
  amendments_fee: string
  business_purpose_specific: boolean
  business_purpose_general: boolean
  name_check_link: string
  zip_code_range: string
  area_codes: string
}

function isYes(value: string): boolean {
  const upper = (value ?? '').toUpperCase()
  return upper === 'YES' || upper === 'SI' || upper === 'SÍ'
}

function toFormValues(state: StateInfo): StateFormValues {
  return {
    sale_price: state.sale_price,
    state_fee: state.state_fee,
    processing_days: state.processing_days,
    annual_report_fee: state.annual_report.fee,
    annual_report_due_date: state.annual_report.due_date,
    dissolution_fee: state.dissolution.fee,
    dissolution_processing_days: state.dissolution.processing_days,
    amendments_available: isYes(state.amendments.available),
    amendments_fee: state.amendments.fee,
    business_purpose_specific: isYes(state.business_purpose.specific),
    business_purpose_general: isYes(state.business_purpose.general),
    name_check_link: state.name_check_link,
    zip_code_range: state.zip_code_range,
    area_codes: state.area_codes.join(', '),
  }
}

function toStateData(state: StateInfo, form: StateFormValues): StateInfo {
  return {
    abbreviation: state.abbreviation,
    name: state.name,
    sale_price: form.sale_price.trim(),
    state_fee: form.state_fee.trim(),
    processing_days: form.processing_days.trim(),
    annual_report: {
      fee: form.annual_report_fee.trim(),
      due_date: form.annual_report_due_date.trim(),
    },
    dissolution: {
      fee: form.dissolution_fee.trim(),
      processing_days: form.dissolution_processing_days.trim(),
    },
    amendments: {
      available: form.amendments_available ? 'SI' : 'NO',
      fee: form.amendments_fee.trim(),
    },
    business_purpose: {
      specific: form.business_purpose_specific ? 'SI' : 'NO',
      general: form.business_purpose_general ? 'SI' : 'NO',
    },
    name_check_link: form.name_check_link.trim(),
    zip_code_range: form.zip_code_range.trim(),
    area_codes: form.area_codes
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean),
  }
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function SwitchField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
      <Label htmlFor={id} className="cursor-pointer">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-2 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
      {children}
    </p>
  )
}

export default function StateEditDialog({ state, open, onOpenChange }: StateEditDialogProps) {
  // El componente se monta al abrir el diálogo (ver StateDetail), así que el
  // formulario siempre inicia con los valores actuales del estado.
  const [form, setForm] = useState<StateFormValues>(() => toFormValues(state))
  const updateState = useUpdateState()

  const set = <K extends keyof StateFormValues>(key: K, value: StateFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    try {
      await updateState.mutateAsync({
        abbreviation: state.abbreviation,
        data: toStateData(state, form),
      })
      toast.success(`Información de ${state.name} actualizada`)
      onOpenChange(false)
    } catch {
      toast.error('Error al guardar los cambios')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Editar {state.name} ({state.abbreviation})
          </DialogTitle>
          <DialogDescription>
            Los cambios se guardan en Firestore y aplican para todos los agentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <SectionTitle>Precios y tiempos</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              id="sale_price"
              label="Precio de venta"
              value={form.sale_price}
              onChange={(v) => set('sale_price', v)}
              placeholder="$699"
            />
            <Field
              id="state_fee"
              label="Fee del estado"
              value={form.state_fee}
              onChange={(v) => set('state_fee', v)}
              placeholder="$245"
            />
            <Field
              id="processing_days"
              label="Días de proceso"
              value={form.processing_days}
              onChange={(v) => set('processing_days', v)}
              placeholder="10"
            />
          </div>

          <SectionTitle>Reporte anual</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="annual_report_fee"
              label="Fee"
              value={form.annual_report_fee}
              onChange={(v) => set('annual_report_fee', v)}
              placeholder="149"
            />
            <Field
              id="annual_report_due_date"
              label="Vencimiento"
              value={form.annual_report_due_date}
              onChange={(v) => set('annual_report_due_date', v)}
              placeholder="Annual, May 1st"
            />
          </div>

          <SectionTitle>Disolución</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="dissolution_fee"
              label="Fee"
              value={form.dissolution_fee}
              onChange={(v) => set('dissolution_fee', v)}
              placeholder="300"
            />
            <Field
              id="dissolution_processing_days"
              label="Días de proceso"
              value={form.dissolution_processing_days}
              onChange={(v) => set('dissolution_processing_days', v)}
              placeholder="7"
            />
          </div>

          <SectionTitle>Enmiendas</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <SwitchField
              id="amendments_available"
              label="Disponible"
              checked={form.amendments_available}
              onChange={(v) => set('amendments_available', v)}
            />
            <Field
              id="amendments_fee"
              label="Fee"
              value={form.amendments_fee}
              onChange={(v) => set('amendments_fee', v)}
              placeholder="325"
            />
          </div>

          <SectionTitle>Propósito del negocio</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <SwitchField
              id="business_purpose_specific"
              label="Específico"
              checked={form.business_purpose_specific}
              onChange={(v) => set('business_purpose_specific', v)}
            />
            <SwitchField
              id="business_purpose_general"
              label="General"
              checked={form.business_purpose_general}
              onChange={(v) => set('business_purpose_general', v)}
            />
          </div>

          <SectionTitle>Referencias</SectionTitle>
          <Field
            id="name_check_link"
            label="Link de verificación de nombre"
            value={form.name_check_link}
            onChange={(v) => set('name_check_link', v)}
            placeholder="https://..."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="zip_code_range"
              label="Rango de ZIP codes"
              value={form.zip_code_range}
              onChange={(v) => set('zip_code_range', v)}
              placeholder="350-369"
            />
            <Field
              id="area_codes"
              label="Códigos de área (separados por coma)"
              value={form.area_codes}
              onChange={(v) => set('area_codes', v)}
              placeholder="205, 251, 256"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={updateState.isPending}>
            {updateState.isPending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
