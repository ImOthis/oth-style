// Capa de datos real: Firebase Auth + Firestore. Misma interfaz que db-local.js.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, query, where, runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { ajustarStock } from './utils.js';

const ERRORES = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'Esta cuenta está desactivada.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión a internet.',
  'permission-denied': 'Tu cuenta no tiene permiso para usar esta app.',
  'unavailable': 'Sin conexión a internet. Intenta de nuevo.',
};
const traducir = (e) => { const m = ERRORES[e.code]; return m ? new Error(m) : e; };
const conError = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw traducir(e); } };

export function crear(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const fs = getFirestore(app);
  const conId = (s) => ({ id: s.id, ...s.data() });

  // Suma o resta stock de todos los productos de una lista de items dentro de la transacción tx.
  // Firestore exige hacer todas las lecturas antes de las escrituras.
  async function moverStock(tx, items, signo) {
    const ids = [...new Set(items.map((i) => i.productoId))];
    const refs = ids.map((id) => doc(fs, 'productos', id));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    return () => snaps.forEach((s, k) => {
      if (!s.exists()) { if (signo < 0) throw new Error('Un producto del carrito ya no existe.'); return; }
      tx.update(refs[k], { variantes: ajustarStock(s.data(), items.filter((i) => i.productoId === ids[k]), signo) });
    });
  }

  return {
    modo: 'firebase',
    onAuth(cb) { onAuthStateChanged(auth, (u) => cb(u ? { email: u.email } : null)); },
    login: conError((email, pass) => signInWithEmailAndPassword(auth, email.trim(), pass)),
    logout: () => signOut(auth),
    email: () => auth.currentUser?.email || '',

    list: conError(async (c, desde, hasta) => {
      const q = desde ? query(collection(fs, c), where('dia', '>=', desde), where('dia', '<=', hasta)) : collection(fs, c);
      return (await getDocs(q)).docs.map(conId);
    }),
    get: conError(async (c, id) => { const s = await getDoc(doc(fs, c, id)); return s.exists() ? conId(s) : null; }),
    add: conError(async (c, data) => (await addDoc(collection(fs, c), data)).id),
    set: conError((c, id, data) => setDoc(doc(fs, c, id), data, { merge: true })),
    remove: conError((c, id) => deleteDoc(doc(fs, c, id))),
    actualizar: conError((c, id, fn) => runTransaction(fs, async (tx) => {
      const ref = doc(fs, c, id), s = await tx.get(ref);
      if (!s.exists()) throw new Error('El documento ya no existe.');
      tx.update(ref, fn(conId(s)));
    })),
    // Transacción: si dos personas venden lo mismo a la vez, Firestore reintenta y nunca deja stock negativo.
    vender: conError((venta) => runTransaction(fs, async (tx) => {
      const escribir = await moverStock(tx, venta.items, -1);
      escribir();
      const ref = doc(collection(fs, 'ventas'));
      tx.set(ref, venta);
      return ref.id;
    })),
    anular: conError((id, email) => runTransaction(fs, async (tx) => {
      const ref = doc(fs, 'ventas', id), s = await tx.get(ref);
      if (!s.exists() || s.data().anulada) throw new Error('La venta ya estaba anulada.');
      const escribir = await moverStock(tx, s.data().items, 1);
      escribir();
      tx.update(ref, { anulada: true, anuladaPor: email, anuladaEn: new Date().toISOString() });
    })),
  };
}
