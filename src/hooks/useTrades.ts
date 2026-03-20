import { useQuery } from '@tanstack/react-query'
import type { Trade } from '@/types'
import tradesData from '@/data/trades.json'

export function useTrades() {
  return useQuery<Trade[]>({
    queryKey: ['trades'],
    queryFn: () => tradesData as Trade[],
    staleTime: Infinity,
  })
}
