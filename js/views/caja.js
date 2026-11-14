import { db } from '../db.js';
import { fmt, esc, hoy, hora, diaLargo, toast, campoPesos, valorPesos, METODOS } from '../utils.js';

export async function render(el) {
  el.innerHTML = `
    <h1>Caja del día</h1>
    <label class="filtros">Día<input type="date" id="dia" value="${hoy()}" max="${hoy()}"></label>
    <div id="contenido"></div>`;
  const $ = (s) => el.querySelector(s);

  const cargar = async () => {
    const dia = $('#dia').value || hoy();
    const [ventas, gastos, caja] = await Promise.all([db.list('ventas', dia, dia), db.list('gastos', dia, dia), db.get('caja', dia)]);
    const vs = ventas.filter((v) => !v.anulada);
    const porMetodo = Object.fromEntries(METODOS.map((m) => [m, 0]));
    vs.forEach((v) => v.pagos.forEach((p) => { porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + p.monto; }));
    const gastosEfectivo = gastos.filter((g) => g.metodo === 'Efectivo').reduce((s, g) => s + g.monto, 0);
    const base = caja?.base || 0;
    const esperado = base + porMetodo.Efectivo - gastosEfectivo;
    const totalVentas = vs.reduce((s, v) => s + v.total, 0);

    $('#contenido').innerHTML = `
      <p class="muted capital">${diaLargo(dia)}</p>
      <section class="card destacado">
        <span>Efectivo esperado en caja</span>
        <b class="grande-num">${fmt(esperado)}</b>
        <small>Base ${fmt(base)} + ventas en efectivo ${fmt(porMetodo.Efectivo)} − gastos en efectivo ${fmt(gastosEfectivo)}</small>
      </section>
      <section class="card">
        <h2>Base inicial de caja</h2>
        <form id="fbase" class="en-linea">${campoPesos('base', base)}<button class="btn btn-primario">Guardar</button></form>
      </section>
      <section class="card">
        <h2>Ventas por método de pago</h2>
        <div class="tabla-simple">
          ${Object.entries(porMetodo).map(([m, v]) => `<div><span>${esc(m)}</span><b>${fmt(v)}</b></div>`).join('')}
          <div class="total"><span>Total ventas (${vs.length})</span><b>${fmt(totalVentas)}</b></div>
        </div>
      </section>
      <section class="card">
        <h2>Gastos del día</h2>
        <div class="tabla-simple">
          ${gastos.map((g) => `<div><span>${esc(g.categoria)}${g.nota ? ` <small class="muted">· ${esc(g.nota)}</small>` : ''}<br><small class="muted">${esc(g.metodo)} · ${hora(g.fecha)}</small></span><b>${fmt(g.monto)}</b></div>`).join('')
            || '<p class="vacio">Sin gastos.</p>'}
          <div class="total"><span>Total gastos</span><b>${fmt(gastos.reduce((s, g) => s + g.monto, 0))}</b></div>
        </div>
      </section>`;
    $('#fbase').onsubmit = async (e) => {
      e.preventDefault();
      await db.set('caja', dia, { base: valorPesos(e.target.base), dia, usuario: db.email() });
      toast('Base guardada.', 'ok');
      cargar();
    };
  };
  $('#dia').onchange = cargar;
  await cargar();
}
