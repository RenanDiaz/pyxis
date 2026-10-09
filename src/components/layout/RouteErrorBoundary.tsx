import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
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
