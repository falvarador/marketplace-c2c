import { useEffect, useRef, useState } from 'preact/hooks'
import { PROVINCES_CR } from '../lib/constants'
import { authModalOpen, pb, syncFavorites } from '../lib/pb'

export function AuthModal() {
  const isOpen = authModalOpen.value
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pressedOutsideRef = useRef(false)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [province, setProvince] = useState<string>(PROVINCES_CR[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  const closeModal = () => {
    authModalOpen.value = false
    setError('')
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'register') {
        await pb.collection('users').create({
          name: name.trim(),
          email: email.trim(),
          password,
          passwordConfirm: password,
          phone: phone.trim(),
          province,
        })
      }

      await pb.collection('users').authWithPassword(email.trim(), password)
      await syncFavorites()
      closeModal()
    } catch (err: any) {
      const msg =
        err?.response?.message ||
        err?.message ||
        'No se pudo completar la autenticación. Revisá tus datos.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth2 = async (provider: 'google' | 'facebook') => {
    setError('')
    setLoading(true)
    try {
      await pb.collection('users').authWithOAuth2({ provider })
      await syncFavorites()
      closeModal()
    } catch (err: any) {
      setError(
        err?.message ||
          `No se pudo iniciar sesión con ${provider === 'google' ? 'Google' : 'Facebook'}. Verificá que el proveedor OAuth2 esté configurado en PocketBase.`,
      )
    } finally {
      setLoading(false)
    }
  }

  const isOutsideDialog = (e: PointerEvent, dialog: HTMLDialogElement) => {
    const r = dialog.getBoundingClientRect()
    return (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
  }

  return (
    <dialog
      ref={dialogRef}
      class="auth-dialog"
      aria-labelledby="auth-dialog-title"
      {...({ closedby: 'any' } as any)}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = ''
        }
        authModalOpen.value = false
      }}
      onPointerDown={(e) => {
        if (dialogRef.current) {
          pressedOutsideRef.current = isOutsideDialog(
            e as unknown as PointerEvent,
            dialogRef.current,
          )
        }
      }}
      onPointerUp={(e) => {
        if (
          dialogRef.current &&
          pressedOutsideRef.current &&
          isOutsideDialog(e as unknown as PointerEvent, dialogRef.current)
        ) {
          closeModal()
        }
        pressedOutsideRef.current = false
      }}
    >
      <div class="auth-dialog-header">
        <h2 id="auth-dialog-title">
          {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta en Costa Rica'}
        </h2>
        <button
          type="button"
          class="dialog-close-btn"
          aria-label="Cerrar ventana de acceso"
          onClick={closeModal}
        >
          ✕
        </button>
      </div>

      <div class="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          class={`auth-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => {
            setMode('login')
            setError('')
          }}
        >
          Ingresar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          class={`auth-tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => {
            setMode('register')
            setError('')
          }}
        >
          Registrarme
        </button>
      </div>

      {error && (
        <div class="alert-error" role="alert" aria-live="polite">
          ⚠️ {error}
        </div>
      )}

      <form class="auth-form" method="post" onSubmit={handleSubmit}>
        {mode === 'register' && (
          <div class="form-group">
            <label for="auth-name">Nombre completo *</label>
            <input
              id="auth-name"
              name="name"
              type="text"
              autocomplete="name"
              required
              value={name}
              onInput={(e) => {
                setName((e.target as HTMLInputElement).value)
                setError('')
              }}
              placeholder="Ej. María Fernández"
            />
          </div>
        )}

        <div class="form-group">
          <label for="auth-email">Correo electrónico *</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autocomplete="email"
            autocorrect="off"
            autocapitalize="off"
            spellcheck={false}
            required
            value={email}
            onInput={(e) => {
              setEmail((e.target as HTMLInputElement).value)
              setError('')
            }}
            placeholder="correo@ejemplo.cr"
          />
        </div>

        <div class="form-group">
          <label for="auth-password">Contraseña (mín. 8 caracteres) *</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
            value={password}
            onInput={(e) => {
              setPassword((e.target as HTMLInputElement).value)
              setError('')
            }}
            placeholder="••••••••"
          />
        </div>

        {mode === 'register' && (
          <>
            <div class="form-group">
              <label for="auth-phone">Teléfono / WhatsApp (Costa Rica) *</label>
              <input
                id="auth-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autocomplete="tel"
                required
                value={phone}
                onInput={(e) => {
                  setPhone((e.target as HTMLInputElement).value)
                  setError('')
                }}
                placeholder="Ej. 8888-8888"
              />
            </div>

            <div class="form-group">
              <label for="auth-province">Provincia *</label>
              <select
                id="auth-province"
                name="province"
                required
                value={province}
                onChange={(e) =>
                  setProvince((e.target as HTMLSelectElement).value)
                }
              >
                {PROVINCES_CR.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <button
          type="submit"
          class="btn btn-primary btn-block"
          disabled={loading}
        >
          {loading
            ? 'Procesando...'
            : mode === 'login'
              ? 'Entrar a mi cuenta'
              : 'Crear mi cuenta'}
        </button>
      </form>

      <div class="auth-divider">
        <span>o continuar con</span>
      </div>

      <div class="oauth-buttons">
        <button
          type="button"
          class="btn btn-oauth"
          disabled={loading}
          onClick={() => void handleOAuth2('google')}
        >
          <span>G</span> Continuar con Google
        </button>
        <button
          type="button"
          class="btn btn-oauth btn-oauth-fb"
          disabled={loading}
          onClick={() => void handleOAuth2('facebook')}
        >
          <span>f</span> Continuar con Facebook
        </button>
      </div>
    </dialog>
  )
}
