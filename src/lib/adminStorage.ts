import type { DeleteFile } from '@/lib/workspaceAdmin'

/**
 * `DeleteFile` real para las cascadas de la spec 06. Importa Storage recién al
 * usarse, para no meterlo en el bundle de las pantallas que solo lo referencian
 * (spec 10).
 */
export const deleteFileFromStorage: DeleteFile = async (path) => {
  const { deleteStoragePath } = await import('@/lib/storageUtils')
  await deleteStoragePath(path)
}
