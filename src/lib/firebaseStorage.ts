import { getStorage } from 'firebase/storage'
import { app } from '@/lib/firebase'

/**
 * Firebase Storage, separado de `firebase.ts` para que no entre en el bundle
 * inicial (spec 10): solo lo usan documentos de clientes y el logo del workspace.
 */
export const storage = app ? getStorage(app) : undefined
