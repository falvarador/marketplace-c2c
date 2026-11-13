import { signal } from "@preact/signals"

export interface CatalogFilters {
  query: string
  categoryId: string | null
  countryCode: string | null
  region: string
  locality: string
}

export const catalogFilters = signal<CatalogFilters>({
  query: "",
  categoryId: null,
  countryCode: null,
  region: "",
  locality: "",
})

export function updateCatalogFilters(
  update: Partial<CatalogFilters>,
): void {
  catalogFilters.value = { ...catalogFilters.value, ...update }
}
