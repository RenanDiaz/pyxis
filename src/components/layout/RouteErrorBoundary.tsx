import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Falló la descarga del código de la página: casi siempre porque hubo un
 * deploy y el chunk viejo ya no existe (spec 10). Se arregla recargando.
 */
function isChunkLoadError(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    error.message
  )
}

/**
 * Atrapa errores de render de una página (spec 09). Sin esto, un error en una
 * sola pantalla dejaba la app en blanco. Se monta con `key` = ruta, así que
 * navegar a otra página lo reinicia.
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    if (isChunkLoadError(this.state.error)) {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
          <RefreshCw className="h-10 w-10 text-primary" />
          <p className="text-lg font-medium">Hay una nueva versión de Pyxis</p>
          <p className="text-sm text-muted-foreground">
            Recarga la página para abrir esta pantalla. Tus datos guardados no se pierden.
          </p>
          <Button onClick={() => window.location.reload()}>Recargar</Button>
        </div>
      )
    }
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-lg font-medium">Algo salió mal en esta pantalla</p>
        <p className="text-sm text-muted-foreground">
          Tus datos guardados no se perdieron. Puedes recargar la página o volver al inicio.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Recargar
          </Button>
          <Button onClick={() => window.location.assign('/')}>Volver al inicio</Button>
        </div>
      </div>
    )
  }
}
