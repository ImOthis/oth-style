import { db, porNombre } from '../db.js';
import {
  fmt, esc, norm, toast, modal, hoy, leerPesos, campoPesos, stockTotal, etiquetaVariante, mostrarComprobante, METODOS,
} from '../utils.js';

// Pantalla tipo caja: buscar → elegir talla/color → cantidad → carrito → cobrar.
export async function render(el) {
  let prods = [];
  const carrito = [];
  const est = { descTipo: '$', desc: '', metodo: 'Efectivo', recibido: '', mixto: {} };
  const cargarProds = async () => { prods = (await db.list('productos')).filter((p) => p.activo !== false).sort(porNombre); };
  await cargarProds();

  el.innerHTML = `
    <h1>Nueva venta</h1>
    <input type="search" id="q" class="buscador" placeholder="Buscar producto por nombre o código" autocomplete="off">
    <div id="resultados" class="resultados"></div>
    <section class="card" id="carrito"></section>`;
  const $ = (s) => el.querySelector(s);
  const enCarrito = (pid, v) => carrito.filter((i) => i.productoId === pid && i.talla === v.talla && i.color === v.color).reduce((s, i) => s + i.cant, 0);

  // ---------- Búsqueda ----------
  const pintarResultados = () => {
    const q = norm($('#q').value);
    const lista = prods.filter((p) => !q || norm(p.nombre).includes(q) || norm(p.codigo).includes(q)).slice(0, 30);
    $('#resultados').innerHTML = lista.map((p) => {
      const t = stockTotal(p);
      return `<button class="resultado" data-p="${p.id}" ${t <= 0 ? 'disabled' : ''}>
        <span><b>${esc(p.nombre)}</b>${p.codigo ? `<small class="muted"> · ${esc(p.codigo)}</small>` : ''}</span>
        <span class="r-der"><b>${fmt(p.precio)}</b><small class="muted">${t <= 0 ? 'Agotado' : t + ' und'}</small></span></button>`;
    }).join('') || '<p class="vacio">No se encontró ningún producto activo.</p>';
  };
  $('#q').addEventListener('input', pintarResultados);
  $('#resultados').onclick = (e) => {
    const b = e.target.closest('[data-p]');
    if (b) elegirVariante(prods.find((p) => p.id === b.dataset.p));
  };

  function elegirVariante(p) {
    let sel = null;
    const vars = p.variantes || [];
    const d = modal(`
      <h2>${esc(p.nombre)}</h2>
      <p class="precio-grande">${fmt(p.precio)}</p>
      <p class="muted">Elige talla y color:</p>
      <div class="chips">${vars.map((v, i) => {
        const disp = v.stock - enCarrito(p.id, v);
        return `<button type="button" class="chip" data-v="${i}" ${disp <= 0 ? 'disabled' : ''}>${esc(etiquetaVariante(v))} <small>(${disp})</small></button>`;
      }).join('')}</div>
      <div class="stepper"><button type="button" data-d="-1" aria-label="Menos">−</button>
        <input type="number" id="cant" value="1" min="1" inputmode="numeric" aria-label="Cantidad">
        <button type="button" data-d="1" aria-label="Más">+</button></div>
      <button class="btn btn-primario grande" id="agregar">Agregar al carrito</button>`);
    const cant = d.querySelector('#cant');
    const elegir = (i) => {
      sel = i;
      d.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', +c.dataset.v === i));
    };
    const disponibles = vars.map((v, i) => [v, i]).filter(([v]) => v.stock - enCarrito(p.id, v) > 0);
    if (disponibles.length === 1) elegir(disponibles[0][1]);
    d.addEventListener('click', (e) => {
      const c = e.target.closest('[data-v]');
      if (c) elegir(+c.dataset.v);
      const s = e.target.closest('[data-d]');
      if (s) cant.value = Math.max(1, (parseInt(cant.value, 10) || 1) + +s.dataset.d);
    });
    d.querySelector('#agregar').onclick = () => {
      if (sel === null) return toast('Elige una talla/color.', 'error');
      const v = vars[sel], n = parseInt(cant.value, 10) || 0, disp = v.stock - enCarrito(p.id, v);
      if (n < 1) return toast('La cantidad debe ser mínimo 1.', 'error');
      if (n > disp) return toast(`Solo hay ${disp} disponibles de ${etiquetaVariante(v)}.`, 'error');
      const ya = carrito.find((i) => i.productoId === p.id && i.talla === v.talla && i.color === v.color);
      if (ya) ya.cant += n;
      else carrito.push({ productoId: p.id, nombre: p.nombre, categoriaId: p.categoriaId, talla: v.talla, color: v.color, cant: n, precio: p.precio, costo: p.costo || 0 });
      d.close();
      $('#q').value = ''; pintarResultados();
      pintarCarrito();
      toast('Agregado al carrito.', 'ok');
    };
  }

  // ---------- Carrito y cobro ----------
  const calcular = () => {
    const subtotal = carrito.reduce((s, i) => s + i.precio * i.cant, 0);
    const descMonto = est.descTipo === '$'
      ? Math.min(leerPesos(est.desc), subtotal)
      : Math.round(subtotal * Math.min(100, Math.max(0, parseFloat(String(est.desc).replace(',', '.')) || 0)) / 100);
    const total = subtotal - descMonto;
    const pagos = est.metodo === 'Mixto'
      ? METODOS.map((m) => ({ metodo: m, monto: leerPesos(est.mixto[m] || '') })).filter((p) => p.monto > 0)
      : [{ metodo: est.metodo, monto: total }];
    return { subtotal, descMonto, total, pagos, pagado: pagos.reduce((s, p) => s + p.monto, 0) };
  };

  const actualizarTotales = () => {
    const c = calcular(), q = (s) => $('#carrito').querySelector(s);
    if (!q('#total')) return;
    q('#subtotal').textContent = fmt(c.subtotal);
    q('#descuento').textContent = c.descMonto ? '-' + fmt(c.descMonto) : fmt(0);
    q('#total').textContent = fmt(c.total);
    q('#confirmar').textContent = 'Confirmar venta · ' + fmt(c.total);
    const falta = q('#falta');
    if (falta) {
      const dif = c.total - c.pagado;
      falta.textContent = dif === 0 ? '✓ Cuadra con el total' : dif > 0 ? 'Falta ' + fmt(dif) : 'Sobra ' + fmt(-dif);
      falta.className = dif === 0 ? 'ok-txt' : 'error-txt';
    }
    const cambio = q('#cambio');
    if (cambio) {
      const r = leerPesos(est.recibido);
      cambio.textContent = r ? (r >= c.total ? 'Cambio: ' + fmt(r - c.total) : 'Falta ' + fmt(c.total - r)) : '';
    }
  };

  function pintarCarrito() {
    if (!carrito.length) { $('#carrito').innerHTML = '<h2>Carrito</h2><p class="vacio">Busca un producto para empezar.</p>'; return; }
    $('#carrito').innerHTML = `
      <h2>Carrito (${carrito.reduce((s, i) => s + i.cant, 0)})</h2>
      <div class="lista">${carrito.map((i, k) => `
        <div class="linea">
          <div><b>${esc(i.nombre)}</b><div class="muted">${esc(etiquetaVariante(i))} · ${fmt(i.precio)} c/u</div></div>
          <div class="linea-der">
            <div class="stepper chico"><button data-menos="${k}" aria-label="Menos">−</button><span>${i.cant}</span><button data-mas="${k}" aria-label="Más">+</button></div>
            <b>${fmt(i.precio * i.cant)}</b>
          </div>
        </div>`).join('')}</div>
      <div class="totales">
        <div><span>Subtotal</span><span id="subtotal"></span></div>
        <div class="desc-fila"><span>Descuento</span>
          <div class="desc-ctrl">
            ${est.descTipo === '$' ? campoPesos('desc', leerPesos(est.desc), 'id="desc"')
              : `<input id="desc" name="desc" type="number" min="0" max="100" inputmode="decimal" placeholder="0" value="${esc(est.desc)}">`}
            <div class="seg"><button data-tipo="$" class="${est.descTipo === '$' ? 'on' : ''}">$</button><button data-tipo="%" class="${est.descTipo === '%' ? 'on' : ''}">%</button></div>
          </div></div>
        <div><span></span><span id="descuento" class="muted"></span></div>
        <div class="total"><span>Total</span><span id="total"></span></div>
      </div>
      <h3>Método de pago</h3>
      <div class="chips">${[...METODOS, 'Mixto'].map((m) => `<button class="chip ${est.metodo === m ? 'on' : ''}" data-metodo="${m}">${m}</button>`).join('')}</div>
      ${est.metodo === 'Mixto' ? `<div class="mixto">${METODOS.map((m) => `<label class="fila-cant"><span>${m}</span>${campoPesos('mx-' + m, leerPesos(est.mixto[m] || ''), `data-mixto="${m}"`)}</label>`).join('')}<p id="falta"></p></div>` : ''}
      ${est.metodo === 'Efectivo' ? `<label class="fila-cant"><span>Recibido (opcional)</span>${campoPesos('recibido', leerPesos(est.recibido), 'id="recibido"')}</label><p id="cambio" class="cambio"></p>` : ''}
      <button class="btn btn-primario grande" id="confirmar"></button>
      <button class="btn btn-link" id="vaciar">Vaciar carrito</button>`;
    actualizarTotales();
  }

  $('#carrito').addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'desc') est.desc = t.value;
    else if (t.id === 'recibido') est.recibido = t.value;
    else if (t.dataset.mixto) est.mixto[t.dataset.mixto] = t.value;
    else return;
    actualizarTotales();
  });
  $('#carrito').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mas) {
      const i = carrito[b.dataset.mas], p = prods.find((x) => x.id === i.productoId);
      const v = p?.variantes.find((v) => v.talla === i.talla && v.color === i.color);
      if (!v || enCarrito(p.id, v) >= v.stock) return toast('No hay más stock de esa variante.', 'error');
      i.cant++;
    } else if (b.dataset.menos) {
      const i = carrito[b.dataset.menos];
      if (--i.cant <= 0) carrito.splice(b.dataset.menos, 1);
    } else if (b.dataset.tipo) { est.descTipo = b.dataset.tipo; est.desc = ''; }
    else if (b.dataset.metodo) est.metodo = b.dataset.metodo;
    else if (b.id === 'vaciar') { if (!confirm('¿Vaciar el carrito?')) return; carrito.length = 0; }
    else if (b.id === 'confirmar') return confirmar(b);
    else return;
    pintarCarrito();
  });

  async function confirmar(btn) {
    const c = calcular();
    if (est.metodo === 'Mixto' && c.pagado !== c.total) return toast('En pago mixto, la suma de los pagos debe ser igual al total.', 'error');
    const venta = {
      fecha: new Date().toISOString(), dia: hoy(), usuario: db.email(),
      items: carrito.map((i) => ({ ...i })), subtotal: c.subtotal,
      descuento: c.descMonto ? { tipo: est.descTipo, valor: est.descTipo === '$' ? c.descMonto : parseFloat(String(est.desc).replace(',', '.')), monto: c.descMonto } : null,
      total: c.total, pagos: c.pagos.length ? c.pagos : [{ metodo: est.metodo, monto: 0 }], anulada: false,
    };
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      const id = await db.vender(venta);
      const r = leerPesos(est.recibido);
      carrito.length = 0;
      Object.assign(est, { descTipo: '$', desc: '', metodo: 'Efectivo', recibido: '', mixto: {} });
      await cargarProds(); pintarResultados(); pintarCarrito();
      mostrarComprobante({ ...venta, id }, `${r > venta.total && venta.pagos[0].metodo === 'Efectivo' ? `<p class="cambio">Cambio: ${fmt(r - venta.total)}</p>` : ''}
        <p class="ok-txt">✓ Venta guardada y stock descontado.</p>`);
    } catch (err) {
      toast(err.message, 'error');
      await cargarProds(); pintarResultados();
      btn.disabled = false; actualizarTotales();
    }
  }

  pintarResultados();
  pintarCarrito();
}
