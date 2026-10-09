import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { describeError, errorCode, UserFacingError, DEFAULT_ERROR_MESSAGE } from '@/lib/errors'

describe('describeError', () => {
  it('un error propio se muestra tal cual', () => {
    assert.equal(describeError(new UserFacingError('El pago ya no existe.')), 'El pago ya no existe.')
  })

  it('traduce códigos de Firebase con o sin prefijo de servicio', () => {
    assert.equal(describeError({ code: 'permission-denied' }), 'No tienes permiso para hacer esto.')
    assert.equal(describeError({ code: 'auth/invalid-credential' }), 'Correo o contraseña incorrectos.')
    assert.equal(describeError({ code: 'storage/unauthorized' }), 'No tienes permiso para hacer esto.')
    assert.equal(errorCode({ code: 'auth/too-many-requests' }), 'too-many-requests')
  })

  it('nunca muestra un error técnico crudo: usa el mensaje de la acción', () => {
    assert.equal(describeError(new TypeError("Cannot read properties of undefined (reading 'x')"), 'No se pudo guardar el cliente'), 'No se pudo guardar el cliente')
    assert.equal(describeError(new Error('Firebase: Error (auth/internal-error).')), DEFAULT_ERROR_MESSAGE)
    assert.equal(describeError({ code: 'auth/algo-nuevo' }, 'X'), 'X')
    assert.equal(describeError(undefined), DEFAULT_ERROR_MESSAGE)
  })
})
