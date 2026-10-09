// Dinero en centavos. Los montos se guardan en dólares (number), pero toda suma
// o comparación de saldos pasa por centavos enteros: en coma flotante
// 33.33 + 33.33 + 33.34 da 99.99999999999999 y un saldo de 1e-14 impedía
// marcar el pago completo.

export function toCents(amount: number | undefined | null): number {
  if (!amount || !Number.isFinite(amount)) return 0
  return Math.round(amount * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

/** Redondea un monto a centavos (p. ej. lo que captura el agente). */
export function roundMoney(amount: number): number {
  return fromCents(toCents(amount))
}

/** Suma montos sin arrastrar error de coma flotante. */
export function sumMoney(amounts: Iterable<number | undefined | null>): number {
  let cents = 0
  for (const amount of amounts) cents += toCents(amount)
  return fromCents(cents)
}
