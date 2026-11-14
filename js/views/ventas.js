import { db } from '../db.js';
import { fmt, esc, hoy, fechaHora, toast, mostrarComprobante, metodoTexto, recargar } from '../utils.js';

let rango = null; // recuerda el filtro mientras la app está abierta

export async function render(el) {
  rango ||= [hoy(), hoy()];
  el.innerHTML = `
    <h1>Historial de ventas</h1>
    <div class="filtros dos">
      <label>Desde<input type="date" id="desde" value="${rango[0]}"></label>
      <label>Hasta<input type="date" id="hasta" value="${rango[1]}"></label>
    </div>
    <div id="resumen" class="muted"></div>
    <div id="lista" class="lista"></div>`;
  const $ = (s) => el.querySelector(s);
  let ventas = [];

  const cargar = async () => {
    rango = [$('#desde').value || hoy(), $('#hasta').value || hoy()];
    ventas = (await db.list('ventas', rango[0], rango[1])).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const validas = ventas.filter((v) => !v.anulada);
    $('#resumen').textContent = `${validas.length} ventas · ${fmt(validas.reduce((s, v) => s + v.total, 0))}` +
      (ventas.length > validas.length ? ` · ${ventas.length - validas.length} anuladas` : '');
    $('#lista').innerHTML = ventas.map((v) => `
      <button class="item venta ${v.anulada ? 'anulada' : ''}" data-id="${v.id}">
        <div class="item-main">
          <b>${fmt(v.total)}</b> ${v.anulada ? '<span class="badge agotado">Anulada</span>' : ''}
          <div class="muted">${fechaHora(v.fecha)} · ${esc(metodoTexto(v))}</div>
          <div class="muted">${esc(v.items.map((i) => `${i.cant}× ${i.nombre}`).join(', '))}</div>
        </div>
        <small class="muted">${esc(v.usuario.split('@')[0])}</small>
      </button>`).join('') || '<p class="vacio">No hay ventas en estas fechas.</p>';
  };
  el.addEventListener('change', (e) => e.target.type === 'date' && cargar());
  $('#lista').onclick = (e) => {
    const b = e.target.closest('[data-id]');
    if (b) detalle(ventas.find((v) => v.id === b.dataset.id));
  };
  await cargar();
}

function detalle(v) {
  const d = mostrarComprobante(v, `
    <p class="muted">Vendió: ${esc(v.usuario)}</p>
    ${v.anulada ? `<p class="error-txt">Anulada por ${esc(v.anuladaPor)} el ${fechaHora(v.anuladaEn)}</p>`
      : '<button class="btn btn-peligro" data-anular>Anular venta</button>'}`);
  d.querySelector('[data-anular]')?.addEventListener('click', async (e) => {
    if (!confirm(`¿Anular esta venta de ${fmt(v.total)}?\nLos productos vuelven al inventario. La venta queda en el historial marcada como anulada.`)) return;
    e.target.disabled = true;
    try {
      await db.anular(v.id, db.email());
      toast('Venta anulada. El stock fue devuelto.', 'ok');
      d.close(); recargar();
    } catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
  });
}
