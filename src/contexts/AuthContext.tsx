import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth'
import { auth, db, isFirebaseConfigured } from '@/lib/firebase'
import { disablePush } from '@/lib/pushSubscription'
import { getUserProfile, createUserProfile } from '@/lib/firestore'
import { clearUserDrafts, pruneExpiredDrafts } from '@/lib/formDraft'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  /** Falló crear/leer el perfil del usuario (red, reglas): la app no puede seguir. */
  profileError: unknown
  retryProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const googleProvider = new GoogleAuthProvider()

// Mock user for development without Firebase
const DEV_USER = {
  uid: 'dev-user',
  email: 'dev@pyxis.local',
  displayName: 'Usuario Dev',
} as User

async function ensureUserProfile(user: User): Promise<void> {
  const existing = await getUserProfile(user.uid)
  if (!existing) {
    await createUserProfile({
      uid: user.uid,
      email: user.email || '',
      display_name: user.displayName || user.email || '',
    })
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(isFirebaseConfigured ? null : DEV_USER)
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [profileError, setProfileError] = useState<unknown>(null)
  const queryClient = useQueryClient()
  const lastUid = useRef<string | null>(null)

  useEffect(() => {
    pruneExpiredDrafts()
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Otro usuario (o ninguno) en este navegador: la caché del anterior no
      // debe verse ni un instante (las query keys no incluyen el uid).
      const uid = firebaseUser?.uid ?? null
      if (uid !== lastUid.current) queryClient.clear()
      lastUid.current = uid
      setProfileError(null)
      try {
        if (firebaseUser) await ensureUserProfile(firebaseUser)
      } catch (err) {
        // Antes un error aquí dejaba la app en "Cargando…" para siempre.
        console.error(err)
        setProfileError(err)
      } finally {
        setUser(firebaseUser)
        setLoading(false)
      }
    })
    return unsubscribe
  }, [queryClient])

  const retryProfile = useCallback(async () => {
    if (!user) return
    setProfileError(null)
    try {
      await ensureUserProfile(user)
    } catch (err) {
      setProfileError(err)
    }
  }, [user])

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) return
    await signInWithPopup(auth, googleProvider)
  }

  const signInWithEmail = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) return
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) return
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const signOut = async () => {
    // Los borradores tienen datos de clientes: no deben quedar en un navegador
    // compartido después de cerrar sesión.
    if (user) clearUserDrafts(user.uid)
    // Tampoco deben seguir llegando sus avisos de llamadas a este navegador
    // (spec 21 fase 2). Si falla, no impide cerrar sesión.
    if (user && db) await disablePush(db, user.uid).catch(() => {})
    queryClient.clear()
    if (!isFirebaseConfigured || !auth) {
      setUser(null)
      return
    }
    await firebaseSignOut(auth)
  }

  const resetPassword = async (email: string) => {
    if (!isFirebaseConfigured || !auth) return
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUp,
        signOut,
        resetPassword,
        profileError,
        retryProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// El hook vive junto a su Provider a propósito; solo afecta al fast refresh en dev.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
