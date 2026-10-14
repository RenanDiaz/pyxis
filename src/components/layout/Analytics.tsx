import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { identifyUser, initAnalytics, track } from '@/lib/analytics'
import { routePattern } from '@/lib/routePattern'
import { useUserProfile } from '@/hooks/useUserProfile'

/** Analítica de uso (spec 24): identidad y páginas vistas; no dibuja nada. */
export default function Analytics() {
  const { pathname } = useLocation()
  const { wsCtx } = useUserProfile()
  const uid = wsCtx?.uid
  const workspaceId = wsCtx?.workspaceId
  const role = wsCtx?.role
  const subteamId = wsCtx?.subteamId ?? null

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    if (uid && workspaceId && role) {
      identifyUser(uid, { role, workspace_id: workspaceId, subteam_id: subteamId })
    }
  }, [uid, workspaceId, role, subteamId])

  useEffect(() => {
    track('$pageview', { route_pattern: routePattern(pathname) })
  }, [pathname])

  return null
}
