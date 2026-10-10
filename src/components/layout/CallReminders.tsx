import { useCallReminders } from '@/hooks/useCallReminders'

/** Monta los avisos de llamadas (spec 21); no dibuja nada. */
export default function CallReminders() {
  useCallReminders()
  return null
}
