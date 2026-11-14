import { db } from '../db.js';
import { fmt, hoy, diaLargo, esc, estadoStock, stockTotal, costoVenta, etiquetaVariante } from '../utils.js';

export async function render(el) {
  const d = hoy();
  const [ventas, productos, gastos] = await Promise.all([db.list('ventas', d, d), db.list('productos'), db.list('gastos', d, d)]);
  const vs = ventas.filter((v) => !v.anulada);
  const total = vs.reduce((s, v) => s + v.total, 0);
  const ganancia = total - vs.reduce((s, v) => s + costoVenta(v), 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const alertas = productos
    .filter((p) => p.activo !== false && estadoStock(p) !== 'ok')
    .sort((a, b) => stockTotal(a) - stockTotal(b));

  el.innerHTML = `
    <h1>Resumen de hoy</h1>
    <p class="muted capital">${diaLargo(d)}</p>
    <div class="acciones">
      <a class="btn btn-primario grande" href="#venta">+ Nueva venta</a>
      <a class="btn grande" href="#producto/nuevo">+ Nuevo producto</a>
      <a class="btn grande" href="#gastos">+ Nuevo gasto</a>
    </div>
    <div class="kpis">
      <div class="kpi"><span>Ventas de hoy</span><b>${fmt(total)}</b></div>
      <div class="kpi"><span>N.º de ventas</span><b>${vs.length}</b></div>
      <div class="kpi"><span>Ganancia bruta</span><b>${fmt(ganancia)}</b></div>
      <div class="kpi"><span>Gastos de hoy</span><b>${fmt(totalGastos)}</b></div>
    </div>
    <section class="card">
      <h2>Alertas de stock ${alertas.length ? `<span class="badge bajo">${alertas.length}</span>` : ''}</h2>
      ${alertas.length ? `<div class="lista">${alertas.map((p) => {
        const t = stockTotal(p), agot = (p.variantes || []).filter((v) => v.stock <= 0).map(etiquetaVariante);
        return `<a class="item" href="#producto/${p.id}">
          <div class="item-main"><b>${esc(p.nombre)}</b>
            <div class="muted">${t <= 0 ? 'Agotado' : `Quedan ${t} (mínimo ${p.stockMin})`}${t > 0 && agot.length ? ' · Agotado: ' + esc(agot.join(', ')) : ''}</div></div>
          <span class="badge ${estadoStock(p)}">${t <= 0 ? 'Agotado' : 'Bajo'}</span></a>`;
      }).join('')}</div>` : '<p class="vacio">Todo el inventario está bien surtido.</p>'}
    </section>`;
}
