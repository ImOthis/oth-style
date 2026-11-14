// MODO PRUEBA: misma interfaz que db-firebase.js, pero guarda en localStorage (solo este dispositivo).
import { ajustarStock } from './utils.js';

const K = (c) => 'oth_' + c;
const cargar = (c) => JSON.parse(localStorage.getItem(K(c)) || '{}');
const guardar = (c, m) => localStorage.setItem(K(c), JSON.stringify(m));
const usuario = () => { const e = localStorage.getItem('oth_usuario'); return e ? { email: e } : null; };
const clon = (o) => JSON.parse(JSON.stringify(o));

export function crear() {
  const oyentes = [];
  const avisar = () => oyentes.forEach((f) => f(usuario()));
  return {
    modo: 'local',
    onAuth(cb) { oyentes.push(cb); cb(usuario()); },
    async login(email, pass) {
      if (!email || !pass) throw new Error('Escribe correo y contraseña.');
      localStorage.setItem('oth_usuario', email.trim().toLowerCase());
      avisar();
    },
    async logout() { localStorage.removeItem('oth_usuario'); avisar(); },
    email: () => usuario()?.email || '',

    async list(c, desde, hasta) {
      return Object.entries(cargar(c)).map(([id, d]) => ({ id, ...d }))
        .filter((d) => !desde || (d.dia >= desde && d.dia <= hasta));
    },
    async get(c, id) { const d = cargar(c)[id]; return d ? { id, ...d } : null; },
    async add(c, data) {
      const m = cargar(c), id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
      m[id] = data; guardar(c, m); return id;
    },
    async set(c, id, data) { const m = cargar(c); m[id] = { ...m[id], ...data }; guardar(c, m); },
    async remove(c, id) { const m = cargar(c); delete m[id]; guardar(c, m); },
    // Lee-modifica-escribe un documento (en Firebase es una transacción).
    async actualizar(c, id, fn) {
      const m = cargar(c);
      if (!m[id]) throw new Error('El documento ya no existe.');
      m[id] = { ...m[id], ...fn(clon({ id, ...m[id] })) }; guardar(c, m);
    },
    async vender(venta) {
      const prods = cargar('productos');
      for (const pid of new Set(venta.items.map((i) => i.productoId))) {
        if (!prods[pid]) throw new Error('Un producto del carrito ya no existe.');
        prods[pid].variantes = ajustarStock(prods[pid], venta.items.filter((i) => i.productoId === pid), -1);
      }
      guardar('productos', prods);
      return this.add('ventas', venta);
    },
    async anular(id, email) {
      const ventas = cargar('ventas'), v = ventas[id], prods = cargar('productos');
      if (!v || v.anulada) throw new Error('La venta ya estaba anulada.');
      for (const pid of new Set(v.items.map((i) => i.productoId))) {
        if (prods[pid]) prods[pid].variantes = ajustarStock(prods[pid], v.items.filter((i) => i.productoId === pid), 1);
      }
      Object.assign(v, { anulada: true, anuladaPor: email, anuladaEn: new Date().toISOString() });
      guardar('productos', prods); guardar('ventas', ventas);
    },
  };
}
