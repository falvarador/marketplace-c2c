import { useEffect, useState } from 'preact/hooks'
import { useLocation } from 'preact-iso'
import {
  LISTING_CONDITIONS,
  LISTING_SPACES,
  PROVINCES_CR,
  type ListingRecord,
} from '../lib/constants'
import {
  authModalOpen,
  categoriesList,
  currentUser,
  getListingImageUrl,
  isAuthenticated,
  loadCategories,
  pb,
} from '../lib/pb'

interface ListingFormProps {
  id?: string
}

interface NewFilePreview {
  file: File
  url: string
}

export function ListingForm({ id }: ListingFormProps) {
  const location = useLocation()
  const loggedIn = isAuthenticated.value
  const user = currentUser.value
  const categories = categoriesList.value
  const isEditing = Boolean(id)

  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState<string>(LISTING_CONDITIONS[1])
  const [space, setSpace] = useState<string>(LISTING_SPACES[0])
  const [province, setProvince] = useState<string>(
    (user?.province as string) || PROVINCES_CR[0],
  )
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<string>('active')

  // Existing images (when editing) and newly selected files with previews
  const [existingRecord, setExistingRecord] = useState<ListingRecord | null>(null)
  const [keptImages, setKeptImages] = useState<string[]>([])
  const [removedImages, setRemovedImages] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<NewFilePreview[]>([])

  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(Boolean(id))
  const [error, setError] = useState('')

  useEffect(() => {
    void loadCategories().then((cats) => {
      if (!category && cats.length > 0) {
        setCategory(cats[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!id) return
    void loadExisting(id)
  }, [id])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const item of newFiles) {
        URL.revokeObjectURL(item.url)
      }
    }
  }, [newFiles])

  const loadExisting = async (listingId: string) => {
    setLoadingRecord(true)
    setError('')
    try {
      const rec = await pb.collection('listings').getOne<ListingRecord>(listingId)
      setExistingRecord(rec)
      setTitle(rec.title)
      setPrice(String(rec.price))
      setCategory(rec.category)
      setCondition(rec.condition)
      setSpace(rec.space)
      setProvince(rec.province)
      setDescription(rec.description.replace(/<[^>]*>/g, ''))
      setStatus(rec.status)
      setKeptImages(rec.images || [])
      setRemovedImages([])
    } catch (err) {
      console.error('Error cargando anuncio para editar:', err)
      setError('No se pudo cargar el anuncio o no tenés permiso para editarlo.')
    } finally {
      setLoadingRecord(false)
    }
  }

  if (!loggedIn) {
    return (
      <div class="container section">
        <div class="empty-state">
          <h2>Iniciá sesión para publicar o editar un mueble</h2>
          <p>
            Necesitás una cuenta para que los compradores puedan contactarte por
            WhatsApp.
          </p>
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              authModalOpen.value = true
            }}
          >
            Iniciar Sesión / Registrarme
          </button>
        </div>
      </div>
    )
  }

  if (loadingRecord) {
    return (
      <div class="container section">
        <div class="loading-box">Cargando datos del anuncio...</div>
      </div>
    )
  }

  const totalImagesCount = keptImages.length + newFiles.length

  const handleFilesSelected = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (!input.files) return
    const selected = Array.from(input.files)
    const remainingSlots = 8 - totalImagesCount

    if (selected.length > remainingSlots) {
      setError(`Podés subir un máximo de 8 fotos en total (${remainingSlots} disponibles).`)
    } else {
      setError('')
    }

    const allowed = selected.slice(0, Math.max(0, remainingSlots))
    const previews: NewFilePreview[] = allowed.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }))

    setNewFiles((prev) => [...prev, ...previews])
    input.value = ''
  }

  const removeNewFile = (idx: number) => {
    setNewFiles((prev) => {
      const target = prev[idx]
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const removeExistingImage = (imgName: string) => {
    setKeptImages((prev) => prev.filter((name) => name !== imgName))
    setRemovedImages((prev) => [...prev, imgName])
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!user?.id) {
      authModalOpen.value = true
      return
    }
    if (title.trim().length < 5) {
      setError('El título debe tener al menos 5 caracteres.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('description', description.trim())
      formData.append('price', String(Number(price) || 0))
      formData.append('condition', condition)
      formData.append('space', space)
      formData.append('province', province)
      formData.append('category', category || categories[0]?.id || '')
      formData.append('seller', user.id)
      formData.append('status', status || 'active')

      for (const removed of removedImages) {
        formData.append('images-', removed)
      }
      for (const item of newFiles) {
        formData.append('images', item.file)
      }

      let saved: ListingRecord
      if (isEditing && id) {
        saved = await pb.collection('listings').update<ListingRecord>(id, formData)
      } else {
        saved = await pb.collection('listings').create<ListingRecord>(formData)
      }

      location.route(`/anuncio/${saved.slug || saved.id}`)
    } catch (err: any) {
      const msg =
        err?.response?.message ||
        err?.message ||
        'No se pudo guardar el anuncio. Verificá los campos obligatorios.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="container section form-page">
      <div class="form-card">
        <div class="form-card-header">
          <h1>{isEditing ? 'Editar Anuncio de Mueble' : 'Publicar un Mueble en Venta'}</h1>
          <p>
            Completá los detalles y subí hasta 8 fotografías claras para vender más
            rápido en Costa Rica.
          </p>
        </div>

        {error && (
          <div class="alert-error" role="alert" aria-live="polite">
            ⚠️ {error}
          </div>
        )}

        <form method="post" onSubmit={handleSubmit} class="listing-form">
          <div class="form-group">
            <label for="listing-title">Título del anuncio (mínimo 5 caracteres) *</label>
            <input
              id="listing-title"
              name="title"
              type="text"
              minLength={5}
              maxLength={200}
              required
              value={title}
              onInput={(e) => {
                setTitle((e.target as HTMLInputElement).value)
                setError('')
              }}
              placeholder="Ej. Juego de Comedor 6 Sillas en Madera de Cedro"
            />
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label for="listing-price">Precio en Colones (₡ CRC) *</label>
              <input
                id="listing-price"
                name="price"
                type="number"
                min={0}
                step={500}
                required
                value={price}
                onInput={(e) => {
                  setPrice((e.target as HTMLInputElement).value)
                  setError('')
                }}
                placeholder="Ej. 195000"
              />
            </div>

            <div class="form-group">
              <label for="listing-category">Categoría *</label>
              <select
                id="listing-category"
                name="category"
                required
                value={category}
                onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label for="listing-condition">Estado del mueble *</label>
              <select
                id="listing-condition"
                name="condition"
                required
                value={condition}
                onChange={(e) => setCondition((e.target as HTMLSelectElement).value)}
              >
                {LISTING_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div class="form-group">
              <label for="listing-space">Espacio *</label>
              <select
                id="listing-space"
                name="space"
                required
                value={space}
                onChange={(e) => setSpace((e.target as HTMLSelectElement).value)}
              >
                {LISTING_SPACES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div class="form-group">
              <label for="listing-province">Provincia *</label>
              <select
                id="listing-province"
                name="province"
                required
                value={province}
                onChange={(e) => setProvince((e.target as HTMLSelectElement).value)}
              >
                {PROVINCES_CR.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="listing-description">Descripción detallada *</label>
            <textarea
              id="listing-description"
              name="description"
              rows={5}
              required
              value={description}
              onInput={(e) => {
                setDescription((e.target as HTMLTextAreaElement).value)
                setError('')
              }}
              placeholder="Describí las medidas, tipo de madera o material, detalles de uso y si ofrecés transporte..."
            />
          </div>

          <div class="form-group">
            <label for="listing-images">
              Fotografías del mueble ({totalImagesCount}/8 fotos — formatos JPG, PNG o WebP)
            </label>
            <input
              id="listing-images"
              name="images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={totalImagesCount >= 8}
              onChange={handleFilesSelected}
            />

            {(keptImages.length > 0 || newFiles.length > 0) && (
              <div class="image-previews-grid">
                {existingRecord &&
                  keptImages.map((imgName) => {
                    const idx = existingRecord.images.indexOf(imgName)
                    const url = getListingImageUrl(existingRecord, idx, '300x300f')
                    return (
                      <div key={imgName} class="image-preview-item">
                        <img src={url} alt="Foto actual" />
                        <button
                          type="button"
                          class="preview-remove-btn"
                          aria-label="Eliminar foto"
                          onClick={() => removeExistingImage(imgName)}
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}

                {newFiles.map((item, idx) => (
                  <div key={item.url} class="image-preview-item">
                    <img src={item.url} alt={`Previsualización ${idx + 1}`} />
                    <button
                      type="button"
                      class="preview-remove-btn"
                      aria-label="Quitar foto seleccionada"
                      onClick={() => removeNewFile(idx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div class="form-actions-row">
            <a href="/mis-anuncios" class="btn btn-ghost">
              Cancelar
            </a>
            <button type="submit" class="btn btn-primary" disabled={loading}>
              {loading
                ? 'Guardando anuncio...'
                : isEditing
                  ? 'Guardar Cambios'
                  : 'Publicar Anuncio Ahora'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
