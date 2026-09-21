/**
 * A one-object IndexedDB store for the uploaded GIF. Settings live in localStorage,
 * which is a ~5MB budget shared by everything — a GIF would blow it out, and a
 * failed write there is silent.
 */
const DB_NAME = 'clockit'
const STORE = 'blobs'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = work(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  await run('readwrite', (store) => store.put(blob, key))
}

export async function getBlob(key: string): Promise<Blob | null> {
  try {
    return (await run<Blob | undefined>('readonly', (store) => store.get(key))) ?? null
  } catch {
    return null
  }
}

export async function deleteBlob(key: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(key))
  } catch {
    // nothing to clean up
  }
}
