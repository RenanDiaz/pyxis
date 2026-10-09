import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { describeError } from '@/lib/errors'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Mensaje si falla (p. ej. "No se pudo guardar el cliente"). */
      errorMessage?: string
      /** El componente muestra su propio error: no mostrar el toast global. */
      silent?: boolean
    }
  }
}

// Spec 09: toda mutación que falla avisa al usuario. Antes muchas acciones
// fallaban sin decir nada y el agente creía que se había guardado.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error(error)
      if (mutation.meta?.silent) return
      toast.error(describeError(error, mutation.meta?.errorMessage))
    },
  }),
  queryCache: new QueryCache({
    // Las lecturas no muestran toast (un refetch en segundo plano no debe
    // interrumpir): cada pantalla muestra su estado de error con "Reintentar".
    onError: (error) => console.error(error),
  }),
})
