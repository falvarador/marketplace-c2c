import type { TokenStorage } from "@mercurjs/client"

export function createSessionStorage(): TokenStorage {
  const memory = new Map<string, string>()
  let browserStorage: Storage | undefined

  try {
    if (typeof window !== "undefined") {
      browserStorage = window.sessionStorage
    }
  } catch {
    browserStorage = undefined
  }

  return {
    getItem(key) {
      try {
        return browserStorage?.getItem(key) ?? memory.get(key) ?? null
      } catch {
        return memory.get(key) ?? null
      }
    },
    setItem(key, value) {
      memory.set(key, value)
      try {
        browserStorage?.setItem(key, value)
      } catch {
        // Keep the session usable in memory when browser storage is blocked.
      }
    },
    removeItem(key) {
      memory.delete(key)
      try {
        browserStorage?.removeItem(key)
      } catch {
        // The in-memory copy has already been removed.
      }
    },
  }
}

export const sessionStorageAdapter = createSessionStorage()
