// The chosen root folder handle, persisted in the extension's IndexedDB (shared by the worker and the settings page).

declare global {
  interface FileSystemHandle {
    queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>
    requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>
  }
  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>
  }
  interface Window {
    showDirectoryPicker(o?: { mode?: 'readwrite'; id?: string }): Promise<FileSystemDirectoryHandle>
  }
}

function db(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const r = indexedDB.open('sidecar', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => fail(r.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db()
  return new Promise((ok, fail) => {
    const r = fn(d.transaction('kv', mode).objectStore('kv'))
    r.onsuccess = () => ok(r.result)
    r.onerror = () => fail(r.error)
  })
}

export const getRoot = () => tx<FileSystemDirectoryHandle | undefined>('readonly', s => s.get('root'))
export const setRoot = (h: FileSystemDirectoryHandle) => tx<void>('readwrite', s => s.put(h, 'root'))
