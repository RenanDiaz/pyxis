import { useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageIcon, Upload, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useUpdateWorkspace } from '@/hooks/useWorkspace'
import { uploadWorkspaceLogo, deleteWorkspaceLogo } from '@/lib/receiptUtils'
import type { Workspace } from '@/types'

interface Props {
  workspace: Workspace
  workspaceId: string
}

export default function ReceiptBrandingSection({ workspace, workspaceId }: Props) {
  const updateWs = useUpdateWorkspace()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [companyName, setCompanyName] = useState(workspace.receipt_company_name ?? '')
  const [uploading, setUploading] = useState(false)

  const initialName = workspace.receipt_company_name ?? ''
  const dirty = companyName.trim() !== initialName

  const handleSaveName = async () => {
    await updateWs.mutateAsync({
      id: workspaceId,
      data: { receipt_company_name: companyName.trim() },
    })
    toast.success('Nombre del emisor guardado')
  }

  const handleSelectFile = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const { url, path } = await uploadWorkspaceLogo(workspaceId, file)
      // Delete previous logo if any
      if (workspace.receipt_logo_path && workspace.receipt_logo_path !== path) {
        await deleteWorkspaceLogo(workspace.receipt_logo_path)
      }
      await updateWs.mutateAsync({
        id: workspaceId,
        data: { receipt_logo_url: url, receipt_logo_path: path },
      })
      toast.success('Logo actualizado')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir el logo'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!workspace.receipt_logo_path) return
    if (!confirm('¿Eliminar el logo actual?')) return
    try {
      await deleteWorkspaceLogo(workspace.receipt_logo_path)
      await updateWs.mutateAsync({
        id: workspaceId,
        data: { receipt_logo_url: '', receipt_logo_path: '' },
      })
      toast.success('Logo eliminado')
    } catch {
      toast.error('Error al eliminar el logo')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comprobantes de pago</CardTitle>
        <p className="text-sm text-muted-foreground">
          Esta información aparecerá en los recibos PDF que emitas a tus clientes.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-md border bg-muted/30 overflow-hidden">
              {workspace.receipt_logo_url ? (
                <img
                  src={workspace.receipt_logo_url}
                  alt="Logo"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectFile}
                disabled={uploading || updateWs.isPending}
              >
                <Upload className="mr-2 h-3 w-3" />
                {uploading ? 'Subiendo...' : workspace.receipt_logo_url ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              {workspace.receipt_logo_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleRemoveLogo}
                  disabled={uploading || updateWs.isPending}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG o WEBP. Máximo 2 MB. Se ajusta automáticamente al recibo.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="receipt-company">Nombre del emisor</Label>
          <Input
            id="receipt-company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={workspace.name}
            className="max-w-sm"
          />
          <p className="text-xs text-muted-foreground">
            Nombre comercial que aparecerá en los recibos. Si lo dejas vacío se usará el nombre del workspace.
          </p>
          <Button
            size="sm"
            onClick={handleSaveName}
            disabled={updateWs.isPending || !dirty}
          >
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
