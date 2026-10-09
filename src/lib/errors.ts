// Mensajes de error para el usuario (spec 09). Nunca se muestra un error
// técnico crudo ("Firebase: Error (auth/…)", un TypeError en inglés): o es un
// error propio pensado para el usuario, o se traduce su código, o se usa el
// mensaje de la acción.

/** Error con un mensaje en español pensado para mostrarse tal cual. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

export const DEFAULT_ERROR_MESSAGE = 'No se pudo completar la acción. Intenta de nuevo.'

const CODE_MESSAGES: Record<string, string> = {
  // Firestore / Storage (los de Storage vienen con prefijo `storage/`)
  'permission-denied': 'No tienes permiso para hacer esto.',
  unauthorized: 'No tienes permiso para hacer esto.',
  unauthenticated: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  unavailable: 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.',
  'deadline-exceeded': 'El servidor tardó demasiado en responder. Intenta de nuevo.',
  'retry-limit-exceeded': 'El servidor tardó demasiado en responder. Intenta de nuevo.',
  'network-request-failed': 'Sin conexión. Revisa tu internet e intenta de nuevo.',
  'not-found': 'El registro ya no existe. Recarga la página.',
  'object-not-found': 'El archivo ya no existe. Recarga la página.',
  aborted: 'Alguien más modificó este registro al mismo tiempo. Intenta de nuevo.',
  'failed-precondition': 'Alguien más modificó este registro al mismo tiempo. Intenta de nuevo.',
  'resource-exhausted': 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
  'quota-exceeded': 'Se alcanzó el límite de almacenamiento. Avisa al administrador.',
  // Auth
  'invalid-credential': 'Correo o contraseña incorrectos.',
  'wrong-password': 'Correo o contraseña incorrectos.',
  'user-not-found': 'Correo o contraseña incorrectos.',
  'invalid-email': 'El correo no es válido.',
  'user-disabled': 'Esta cuenta está deshabilitada. Avisa al administrador.',
  'too-many-requests': 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
  'email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
  'weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
  'cancelled-popup-request': 'Se cerró la ventana de Google antes de terminar.',
  'popup-blocked': 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes.',
  'account-exists-with-different-credential': 'Ese correo ya está registrado con otro método de acceso.',
}

/** Código del error sin prefijo de servicio (`auth/`, `storage/`, `firestore/`). */
export function errorCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code
  if (typeof code !== 'string') return null
  return code.includes('/') ? code.slice(code.indexOf('/') + 1) : code
}

/**
 * Mensaje para el usuario: el de un `UserFacingError`, el de un código
 * conocido, o `fallback` (el mensaje de la acción que falló).
 */
export function describeError(err: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): string {
  if (err instanceof UserFacingError) return err.message
  const code = errorCode(err)
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code]
  return fallback
}
