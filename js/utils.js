// Utilidades compartidas: formato de pesos, fechas en Bogotá, HTML seguro, CSV, campos de dinero, stock.
const TZ = 'America/Bogota';
const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export const fmt = (n) => (n < 0 ? '-$' : '$') + nf.format(Math.abs(Math.round(n || 0)));
export const pct = (n) => (isFinite(n) ? n.toFixed(1).replace('.', ',') : '0') + '%';

// Día "YYYY-MM-DD" en hora de Colombia.
export const hoy = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
export const fechaHora = (iso) => new Date(iso).toLocaleString('es-CO', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
export const hora = (iso) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: TZ, timeStyle: 'short' });
export const diaLargo = (dia) => new Date(dia + 'T12:00:00Z').toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });

export function sumarDias(dia, n) {
  const d = new Date(dia + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function periodo(tipo) {
  const h = hoy();
  if (tipo === 'semana') { // semana de lunes a domingo
    const dow = (new Date(h + 'T00:00:00Z').getUTCDay() + 6) % 7;
    return [sumarDias(h, -dow), h];
  }
  if (tipo === 'mes') return [h.slice(0, 8) + '01', h];
  return [h, h];
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const listaTallas = (s) => s.split(',').map((t) => t.trim()).filter(Boolean);

// ---------- Dinero: "25" significa $25.000 ----------
// Cualquier valor entre 1 y 999 se multiplica por 1.000 (en esta tienda no hay precios menores a $1.000).
export function leerPesos(v) {
  const n = parseInt(String(v).replace(/\D/g, ''), 10) || 0;
  return n > 0 && n < 1000 ? n * 1000 : n;
}
export const valorPesos = (el) => leerPesos(el.value);

function pista(el) {
  let h = el.nextElementSibling;
  if (!h || !h.classList.contains('money-hint')) {
    h = document.createElement('small');
    h.className = 'money-hint';
    el.after(h);
  }
  return h;
}
export function initDinero() {
  document.addEventListener('input', (e) => {
    if (!e.target.matches('input.money')) return;
    const n = leerPesos(e.target.value);
    pista(e.target).textContent = n ? '= ' + fmt(n) : '';
  });
  document.addEventListener('focusout', (e) => {
    if (!e.target.matches('input.money')) return;
    const n = leerPesos(e.target.value);
    e.target.value = n ? nf.format(n) : '';
    pista(e.target).textContent = '';
    e.target.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
// Campo de dinero listo para insertar en un template.
export const campoPesos = (name, valor = '', extra = '') =>
  `<input class="money" name="${name}" inputmode="numeric" autocomplete="off" placeholder="$0" value="${valor ? nf.format(valor) : ''}" ${extra}>`;

// ---------- Stock ----------
// Aplica items [{talla,color,cant}] a las variantes de un producto. signo -1 = venta, +1 = devolución/entrada.
export function ajustarStock(prod, items, signo) {
  const variantes = (prod.variantes || []).map((v) => ({ ...v }));
  for (const it of items) {
    let v = variantes.find((v) => v.talla === it.talla && v.color === it.color);
    if (!v) {
      if (signo < 0) throw new Error(`La variante ${it.talla} ${it.color} de "${prod.nombre}" ya no existe.`);
      v = { talla: it.talla, color: it.color, stock: 0 };
      variantes.push(v);
    }
    if (signo < 0 && v.stock < it.cant)
      throw new Error(`No hay suficiente stock de "${prod.nombre}" (${it.talla} ${it.color}). Quedan ${v.stock}.`);
    v.stock += signo * it.cant;
  }
  return variantes;
}
export const stockTotal = (p) => (p.variantes || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
export function estadoStock(p) {
  const t = stockTotal(p);
  if (t <= 0) return 'agotado';
  if (t <= (p.stockMin || 0)) return 'bajo';
  return 'ok';
}
export const etiquetaVariante = (v) => [v.talla, v.color].filter(Boolean).join(' · ') || 'Única';

// ---------- UI ----------
export function toast(msg, tipo = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + tipo;
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}
export function modal(html) {
  const d = document.createElement('dialog');
  d.className = 'modal';
  d.innerHTML = `<button class="cerrar" aria-label="Cerrar" data-cerrar>×</button>${html}`;
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) d.close(); });
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}

// ---------- CSV (separador ; para Excel en español) ----------
export function descargarCSV(nombre, filas) {
  const txt = filas.map((f) => f.map((c) => {
    const s = String(c ?? '');
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Ventas ----------
export const METODOS = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta', 'Transferencia'];
export const costoVenta = (v) => v.items.reduce((s, i) => s + i.costo * i.cant, 0);
export const metodoTexto = (v) => v.pagos.length > 1 ? 'Mixto (' + v.pagos.map((p) => `${p.metodo} ${fmt(p.monto)}`).join(', ') + ')' : v.pagos[0]?.metodo || '';

export function textoComprobante(v) {
  const l = [
    '*OTH Style*',
    'Comprobante de venta #' + v.id.slice(-6).toUpperCase(),
    fechaHora(v.fecha),
    '------------------------',
    ...v.items.map((i) => `${i.cant} x ${i.nombre} (${etiquetaVariante(i)})  ${fmt(i.precio * i.cant)}`),
    '------------------------',
  ];
  if (v.descuento?.monto) l.push('Subtotal: ' + fmt(v.subtotal), 'Descuento: -' + fmt(v.descuento.monto));
  l.push('*Total: ' + fmt(v.total) + '*', 'Pago: ' + metodoTexto(v));
  if (v.anulada) l.push('*VENTA ANULADA*');
  l.push('', '¡Gracias por tu compra!');
  return l.join('\n');
}

export function mostrarComprobante(v, extraHtml = '') {
  const txt = textoComprobante(v);
  const d = modal(`
    <h2>Comprobante</h2>
    <pre class="recibo" id="recibo-print">${esc(txt.replace(/\*/g, ''))}</pre>
    <div class="fila-botones">
      <a class="btn btn-whatsapp" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt)}">Compartir por WhatsApp</a>
      <button class="btn" data-imprimir>Imprimir</button>
    </div>${extraHtml}`);
  d.querySelector('[data-imprimir]').onclick = () => window.print();
  return d;
}

// Vuelve a pintar la pantalla actual (crea una vista nueva, sin duplicar eventos).
export const recargar = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
