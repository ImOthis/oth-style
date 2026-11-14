import { db } from '../db.js';
import { fmt, pct, esc, hoy, periodo, fechaHora, costoVenta, metodoTexto, descargarCSV, etiquetaVariante } from '../utils.js';

let sel = 'hoy';

const barras = (pares, etiqueta = (v) => fmt(v)) => {
  const max = Math.max(1, ...pares.map((p) => p[1]));
  return pares.length ? pares.map(([n, v, extra]) => `
    <div class="barra"><div class="barra-txt"><span>${esc(n)}</span><b>${etiqueta(v, extra)}</b></div>
    <div class="barra-fondo"><div style="width:${(v / max) * 100}%"></div></div></div>`).join('') : '<p class="vacio">Sin datos en este periodo.</p>';
};
const sumar = (obj, k, v) => { obj[k] = (obj[k] || 0) + v; };
const ordenar = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

export async function render(el) {
  const [prods, cats] = await Promise.all([db.list('productos'), db.list('categorias')]);
  const catNom = Object.fromEntries(cats.map((c) => [c.id, c.nombre]));
  const [d0, d1] = periodo('mes');
  el.innerHTML = `
    <h1>Reportes</h1>
    <div class="seg ancho" id="per">
      ${[['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['rango', 'Rango']].map(([k, t]) => `<button data-p="${k}" class="${k === sel ? 'on' : ''}">${t}</button>`).join('')}
    </div>
    <div id="rango" class="filtros dos" ${sel === 'rango' ? '' : 'hidden'}>
      <label>Desde<input type="date" id="desde" value="${d0}"></label>
      <label>Hasta<input type="date" id="hasta" value="${d1}"></label>
    </div>
    <div id="contenido"></div>`;
  const $ = (s) => el.querySelector(s);

  const cargar = async () => {
    const [desde, hasta] = sel === 'rango' ? [$('#desde').value || hoy(), $('#hasta').value || hoy()] : periodo(sel);
    $('#contenido').innerHTML = '<p class="cargando">Calculando…</p>';
    const [ventas, gastos] = await Promise.all([db.list('ventas', desde, hasta), db.list('gastos', desde, hasta)]);
    const vs = ventas.filter((v) => !v.anulada);
    const total = vs.reduce((s, v) => s + v.total, 0);
    const costo = vs.reduce((s, v) => s + costoVenta(v), 0);
    const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
    const bruta = total - costo, neta = bruta - totalGastos;

    const porCat = {}, porProd = {}, porMetodo = {}, porGasto = {};
    vs.forEach((v) => {
      const f = v.subtotal ? v.total / v.subtotal : 1; // reparte el descuento entre los ítems
      v.items.forEach((i) => {
        sumar(porCat, catNom[i.categoriaId] || 'Sin categoría', i.precio * i.cant * f);
        const p = (porProd[i.productoId] ||= { nombre: i.nombre, cant: 0, valor: 0 });
        p.cant += i.cant; p.valor += i.precio * i.cant * f;
      });
      v.pagos.forEach((p) => sumar(porMetodo, p.metodo, p.monto));
    });
    gastos.forEach((g) => sumar(porGasto, g.categoria, g.monto));
    const top = Object.values(porProd).sort((a, b) => b.cant - a.cant).slice(0, 10);
    const invCosto = prods.reduce((s, p) => s + (p.costo || 0) * p.variantes.reduce((t, v) => t + Math.max(0, v.stock), 0), 0);
    const invVenta = prods.reduce((s, p) => s + (p.precio || 0) * p.variantes.reduce((t, v) => t + Math.max(0, v.stock), 0), 0);

    $('#contenido').innerHTML = `
      <p class="muted">${desde === hasta ? desde : `${desde} a ${hasta}`} · ${vs.length} ventas${ventas.length > vs.length ? ` (${ventas.length - vs.length} anuladas no cuentan)` : ''}</p>
      <div class="kpis">
        <div class="kpi"><span>Ventas totales</span><b>${fmt(total)}</b></div>
        <div class="kpi"><span>Costo mercancía vendida</span><b>${fmt(costo)}</b></div>
        <div class="kpi"><span>Ganancia bruta</span><b>${fmt(bruta)}</b><small>${pct(total ? (bruta / total) * 100 : 0)}</small></div>
        <div class="kpi"><span>Gastos</span><b>${fmt(totalGastos)}</b></div>
        <div class="kpi ${neta >= 0 ? 'positivo' : 'negativo'} ancho"><span>Ganancia neta</span><b>${fmt(neta)}</b></div>
      </div>
      <section class="card"><h2>Ventas por categoría</h2>${barras(ordenar(porCat))}</section>
      <section class="card"><h2>Productos más vendidos</h2>${barras(top.map((p) => [p.nombre, p.cant, p.valor]), (c, v) => `${c} und · ${fmt(v)}`)}</section>
      <section class="card"><h2>Ventas por método de pago</h2>${barras(ordenar(porMetodo))}</section>
      <section class="card"><h2>Gastos por categoría</h2>${barras(ordenar(porGasto))}</section>
      <section class="card">
        <h2>Valor del inventario actual</h2>
        <div class="tabla-simple">
          <div><span>A precio de costo</span><b>${fmt(invCosto)}</b></div>
          <div><span>A precio de venta</span><b>${fmt(invVenta)}</b></div>
          <div><span>Unidades en stock</span><b>${prods.reduce((s, p) => s + p.variantes.reduce((t, v) => t + Math.max(0, v.stock), 0), 0)}</b></div>
        </div>
      </section>
      <section class="card">
        <h2>Exportar a Excel (CSV)</h2>
        <div class="fila-botones">
          <button class="btn" data-csv="ventas">Ventas del periodo</button>
          <button class="btn" data-csv="gastos">Gastos del periodo</button>
          <button class="btn" data-csv="inventario">Inventario</button>
        </div>
      </section>`;

    $('#contenido').onclick = (e) => {
      const t = e.target.dataset.csv;
      if (t === 'ventas') descargarCSV(`ventas_${desde}_${hasta}.csv`, [
        ['Venta', 'Fecha', 'Usuario', 'Producto', 'Categoría', 'Talla', 'Color', 'Cantidad', 'Precio unitario', 'Costo unitario', 'Subtotal ítem', 'Descuento venta', 'Total venta', 'Pago', 'Anulada'],
        ...ventas.flatMap((v) => v.items.map((i) => [v.id.slice(-6).toUpperCase(), fechaHora(v.fecha), v.usuario, i.nombre, catNom[i.categoriaId] || '', i.talla, i.color, i.cant, i.precio, i.costo, i.precio * i.cant, v.descuento?.monto || 0, v.total, metodoTexto(v), v.anulada ? 'Sí' : 'No'])),
      ]);
      if (t === 'gastos') descargarCSV(`gastos_${desde}_${hasta}.csv`, [
        ['Fecha', 'Categoría', 'Monto', 'Método', 'Nota', 'Usuario'],
        ...gastos.map((g) => [g.dia, g.categoria, g.monto, g.metodo, g.nota, g.usuario]),
      ]);
      if (t === 'inventario') descargarCSV(`inventario_${hoy()}.csv`, [
        ['Producto', 'Código', 'Categoría', 'Variante', 'Stock', 'Costo', 'Precio', 'Valor a costo', 'Valor a venta', 'Activo'],
        ...prods.flatMap((p) => p.variantes.map((v) => [p.nombre, p.codigo, catNom[p.categoriaId] || '', etiquetaVariante(v), v.stock, p.costo, p.precio, v.stock * p.costo, v.stock * p.precio, p.activo === false ? 'No' : 'Sí'])),
      ]);
    };
  };

  $('#per').onclick = (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    sel = b.dataset.p;
    el.querySelectorAll('#per button').forEach((x) => x.classList.toggle('on', x === b));
    $('#rango').hidden = sel !== 'rango';
    cargar();
  };
  el.addEventListener('change', (e) => e.target.type === 'date' && cargar());
  await cargar();
}
