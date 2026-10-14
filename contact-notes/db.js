// Local storage only. Nothing here talks to a network.
// With a passphrase set, every record except settings is stored encrypted (AES-GCM,
// key derived from the passphrase with PBKDF2). The key lives only in memory.
const DB = (() => {
  const NAME = 'contact-notes';
  const STORES = ['contacts', 'spaces', 'notes', 'ideas', 'entries', 'syntheses', 'pieces', 'debriefs', 'settings'];
  const RECORDS = STORES.filter((s) => s !== 'settings');
  const CHECK = 'contact-notes';
  let dbp;
  let key = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, 2);
      req.onupgradeneeded = () => {
        for (const s of STORES) {
          if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
    });
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  async function seal(store, obj, k = key) {
    if (!k || store === 'settings') return obj;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj)));
    return { id: obj.id, sealed: true, iv, data };
  }

  async function unseal(rec) {
    if (!rec || !rec.sealed) return rec;
    if (!key) throw new Error('locked');
    return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, key, rec.data)));
  }

  async function deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  const raw = {
    all: (store) => tx(store, 'readonly', (s) => s.getAll()),
    get: (store, id) => tx(store, 'readonly', (s) => s.get(id)),
    put: (store, obj) => tx(store, 'readwrite', (s) => s.put(obj)),
  };

  async function rewriteAll(newKey) {
    for (const store of RECORDS) {
      const recs = await Promise.all((await raw.all(store)).map(unseal));
      for (const r of recs) await raw.put(store, await seal(store, r, newKey));
    }
  }

  return {
    STORES,
    RECORDS,
    all: async (store) => Promise.all((await raw.all(store)).map(unseal)),
    get: async (store, id) => unseal(await raw.get(store, id)),
    put: async (store, obj) => raw.put(store, await seal(store, obj)),
    del: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),

    canLock: () => !!(window.crypto && crypto.subtle),
    hasLock: async () => !!(await raw.get('settings', 'lock')),
    isOpen: () => !!key,
    forget: () => { key = null; },

    async unlock(pass) {
      const lock = await raw.get('settings', 'lock');
      const k = await deriveKey(pass, lock.salt);
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: lock.iv }, k, lock.check);
        if (dec.decode(pt) !== CHECK) return false;
      } catch (e) {
        return false;
      }
      key = k;
      return true;
    },

    // Writes the lock first, so an interrupted change leaves records readable after unlock.
    async setLock(pass) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const k = await deriveKey(pass, salt);
      const check = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(CHECK));
      await raw.put('settings', { id: 'lock', salt, iv, check });
      await rewriteAll(k);
      key = k;
    },

    async removeLock() {
      await rewriteAll(null);
      key = null;
      await tx('settings', 'readwrite', (s) => s.delete('lock'));
    },
  };
})();

function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
