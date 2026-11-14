import { db, porNombre } from '../db.js';
import {
  fmt, pct, esc, norm, toast, modal, campoPesos, valorPesos, ajustarStock, stockTotal, estadoStock, etiquetaVariante, listaTallas, recargar,
} from '../utils.js';

const clave = (v) => v.talla + '|' + v.color;
export const margen = (p) => ({ pesos: p.precio - p.costo, pct: p.precio ? ((p.precio - p.costo) / p.precio) * 100 : 0 });

// ---------- Lista ----------
export async function render(el) {
  const [prods, cats] = await Promise.all([db.list('productos'), db.list('categorias')]);
  const catNom = Object.fromEntries(cats.map((c) => [c.id, c.nombre]));
  prods.sort(porNombre);
  el.innerHTML = `
    <div class="cabecera"><h1>Productos</h1><a class="btn btn-primario" href="#producto/nuevo">+ Nuevo</a></div>
    <div class="filtros">
      <input type="search" id="q" placeholder="Buscar por nombre o código">
      <select id="cat"><option value="">Todas las categorías</option>${cats.sort(porNombre).map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="bajo"> Solo stock bajo o agotado</label>
    </div>
    <div id="lista" class="lista"></div>`;
  const $ = (s) => el.querySelector(s);
  const pintar = () => {
    const q = norm($('#q').value), cat = $('#cat').value, bajo = $('#bajo').checked;
    const items = prods.filter((p) => (!q || norm(p.nombre).includes(q) || norm(p.codigo).includes(q))
      && (!cat || p.categoriaId === cat) && (!bajo || estadoStock(p) !== 'ok'));
    $('#lista').innerHTML = items.map((p) => {
      const m = margen(p), t = stockTotal(p), est = estadoStock(p);
      return `<article class="item ${p.activo === false ? 'inactivo' : ''}">
        <a class="item-main" href="#producto/${p.id}">
          <b>${esc(p.nombre)}</b>${p.activo === false ? ' <span class="badge">Inactivo</span>' : ''}
          <div class="muted">${esc(catNom[p.categoriaId] || 'Sin categoría')}${p.codigo ? ' · ' + esc(p.codigo) : ''}</div>
          <div class="precios">Venta <b>${fmt(p.precio)}</b> · Costo ${fmt(p.costo)}<br>Margen <b>${fmt(m.pesos)} (${pct(m.pct)})</b></div>
        </a>
        <div class="item-side">
          <span class="badge ${est}">${t} und</span>
          <button class="btn chico" data-entrada="${p.id}">+ Entrada</button>
        </div></article>`;
    }).join('') || '<p class="vacio">No hay productos que coincidan.</p>';
  };
  el.addEventListener('input', (e) => e.target.matches('#q,#cat,#bajo') && pintar());
  el.addEventListener('change', (e) => e.target.matches('#cat,#bajo') && pintar());
  $('#lista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-entrada]');
    if (b) entrada(prods.find((p) => p.id === b.dataset.entrada), cats, recargar);
  });
  pintar();
}

// ---------- Entrada de mercancía ----------
function entrada(p, cats, listo) {
  const sugeridas = cats.find((c) => c.id === p.categoriaId)?.tallas || [];
  const d = modal(`
    <h2>Entrada de mercancía</h2>
    <p><b>${esc(p.nombre)}</b></p>
    <p class="muted">Escribe cuántas unidades llegaron de cada variante.</p>
    <form id="fe" class="form">
      ${(p.variantes || []).map((v, i) => `<label class="fila-cant"><span>${esc(etiquetaVariante(v))} <small class="muted">(hay ${v.stock})</small></span>
        <input type="number" min="0" inputmode="numeric" name="v${i}" placeholder="0"></label>`).join('')}
      <details><summary>+ Llegó una talla o color nuevo</summary>
        <div class="tres">
          <input name="nt" placeholder="Talla" list="tallas-sug"><datalist id="tallas-sug">${sugeridas.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
          <input name="nc" placeholder="Color">
          <input name="nn" type="number" min="0" inputmode="numeric" placeholder="Cant.">
        </div>
      </details>
      <button class="btn btn-primario grande">Sumar al inventario</button>
    </form>`);
  d.querySelector('#fe').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const items = (p.variantes || []).map((v, i) => ({ talla: v.talla, color: v.color, cant: parseInt(f['v' + i].value, 10) || 0 }));
    const nn = parseInt(f.nn.value, 10) || 0;
    if (nn > 0) items.push({ talla: f.nt.value.trim(), color: f.nc.value.trim(), cant: nn });
    const conCant = items.filter((i) => i.cant > 0);
    if (!conCant.length) return toast('Escribe al menos una cantidad.', 'error');
    f.querySelector('button').disabled = true;
    try {
      await db.actualizar('productos', p.id, (cur) => ({ variantes: ajustarStock(cur, conCant, 1) }));
      toast(`Se sumaron ${conCant.reduce((s, i) => s + i.cant, 0)} unidades.`, 'ok');
      d.close(); listo();
    } catch (err) { toast(err.message, 'error'); f.querySelector('button').disabled = false; }
  };
}

// ---------- Crear / editar ----------
export async function formulario(el, id) {
  const nuevo = !id || id === 'nuevo';
  const [cats, p0] = await Promise.all([db.list('categorias'), nuevo ? null : db.get('productos', id)]);
  cats.sort(porNombre);
  if (!nuevo && !p0) { el.innerHTML = '<p class="vacio">Este producto ya no existe. <a href="#productos">Volver</a></p>'; return; }
  const p = p0 || { nombre: '', categoriaId: cats[0]?.id, codigo: '', costo: 0, precio: 0, stockMin: 2, notas: '', activo: true, variantes: [] };
  const original = Object.fromEntries((p.variantes || []).map((v) => [clave(v), v.stock]));
  let variantes = (p.variantes || []).map((v) => ({ ...v }));
  let elegidas = new Set();

  el.innerHTML = `
    <a href="#productos" class="volver">← Productos</a>
    <h1>${nuevo ? 'Nuevo producto' : 'Editar producto'}</h1>
    <form id="f" class="form">
      <label>Nombre<input name="nombre" required value="${esc(p.nombre)}"></label>
      <label>Categoría<select name="categoriaId">${cats.map((c) => `<option value="${c.id}" ${c.id === p.categoriaId ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
      <label>Código / referencia (opcional)<input name="codigo" value="${esc(p.codigo)}"></label>
      <div class="dos">
        <label>Precio de costo${campoPesos('costo', p.costo)}</label>
        <label>Precio de venta${campoPesos('precio', p.precio)}</label>
      </div>
      <p class="margen" id="margen"></p>
      <div class="dos">
        <label>Stock mínimo (alerta)<input name="stockMin" type="number" min="0" inputmode="numeric" value="${p.stockMin ?? 0}"></label>
        <label class="check"><input type="checkbox" name="activo" ${p.activo !== false ? 'checked' : ''}> Activo (se puede vender)</label>
      </div>
      <label>Notas<textarea name="notas" rows="2">${esc(p.notas)}</textarea></label>

      <fieldset class="card">
        <legend>Tallas, colores y stock</legend>
        <p class="muted">1. Toca las tallas · 2. Escribe los colores · 3. Agrega</p>
        <div class="chips" id="chips"></div>
        <input id="colores" placeholder="Colores separados por coma (ej: Negro, Blanco)">
        <div class="dos">
          <label>Cantidad de cada una<input id="cantIni" type="number" min="0" inputmode="numeric" value="1"></label>
          <button type="button" class="btn" id="generar">Agregar variantes</button>
        </div>
        <div id="variantes"></div>
        <button type="button" class="btn chico" id="fila">+ Agregar fila a mano</button>
      </fieldset>

      <div class="fila-botones">
        <button class="btn btn-primario grande">Guardar producto</button>
        ${nuevo ? '' : '<button type="button" class="btn btn-peligro" id="borrar">Eliminar</button>'}
      </div>
    </form>`;
  const f = el.querySelector('#f'), $ = (s) => el.querySelector(s);

  const pintarMargen = () => {
    const m = margen({ costo: valorPesos(f.costo), precio: valorPesos(f.precio) });
    $('#margen').innerHTML = f.precio.value ? `Margen de ganancia: <b>${fmt(m.pesos)}</b> (${pct(m.pct)})` : '';
  };
  const pintarChips = () => {
    const tallas = cats.find((c) => c.id === f.categoriaId.value)?.tallas || [];
    elegidas = new Set(tallas.length === 1 ? tallas : []);
    $('#chips').innerHTML = tallas.map((t) => `<button type="button" class="chip ${elegidas.has(t) ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')
      || '<span class="muted">Esta categoría no tiene tallas sugeridas. Usa "Agregar fila a mano".</span>';
  };
  const pintarVariantes = () => {
    $('#variantes').innerHTML = variantes.length ? `<table class="tabla-var"><thead><tr><th>Talla</th><th>Color</th><th>Stock</th><th></th></tr></thead><tbody>
      ${variantes.map((v, i) => `<tr>
        <td><input data-i="${i}" data-k="talla" value="${esc(v.talla)}" aria-label="Talla"></td>
        <td><input data-i="${i}" data-k="color" value="${esc(v.color)}" aria-label="Color"></td>
        <td><input data-i="${i}" data-k="stock" type="number" min="0" inputmode="numeric" value="${v.stock}" aria-label="Stock"></td>
        <td><button type="button" class="btn-x" data-quitar="${i}" aria-label="Quitar">×</button></td></tr>`).join('')}
      </tbody></table><p class="muted">Total: ${stockTotal({ variantes })} unidades</p>` : '<p class="vacio">Aún no hay variantes.</p>';
  };

  f.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k) variantes[t.dataset.i][t.dataset.k] = t.dataset.k === 'stock' ? Math.max(0, parseInt(t.value, 10) || 0) : t.value.trim();
    if (t.name === 'costo' || t.name === 'precio') pintarMargen();
  });
  f.categoriaId.onchange = pintarChips;
  $('#chips').onclick = (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    elegidas.has(b.dataset.t) ? elegidas.delete(b.dataset.t) : elegidas.add(b.dataset.t);
    b.classList.toggle('on');
  };
  $('#generar').onclick = () => {
    const colores = listaTallas($('#colores').value);
    const cant = Math.max(0, parseInt($('#cantIni').value, 10) || 0);
    if (!elegidas.size) return toast('Toca al menos una talla.', 'error');
    let n = 0;
    for (const talla of elegidas) for (const color of colores.length ? colores : ['']) {
      if (!variantes.some((v) => v.talla === talla && v.color === color)) { variantes.push({ talla, color, stock: cant }); n++; }
    }
    pintarVariantes();
    toast(n ? `Se agregaron ${n} variantes.` : 'Esas variantes ya existían.');
  };
  $('#fila').onclick = () => { variantes.push({ talla: '', color: '', stock: 0 }); pintarVariantes(); };
  $('#variantes').onclick = (e) => {
    const b = e.target.closest('[data-quitar]');
    if (b) { variantes.splice(+b.dataset.quitar, 1); pintarVariantes(); }
  };
  $('#borrar')?.addEventListener('click', async () => {
    if (!confirm(`¿Eliminar "${p.nombre}"? Las ventas pasadas no se borran.\nSi solo dejaste de venderlo, mejor márcalo como inactivo.`)) return;
    await db.remove('productos', id);
    toast('Producto eliminado.'); location.hash = '#productos';
  });

  f.onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      nombre: f.nombre.value.trim(), categoriaId: f.categoriaId.value, codigo: f.codigo.value.trim(),
      costo: valorPesos(f.costo), precio: valorPesos(f.precio), stockMin: parseInt(f.stockMin.value, 10) || 0,
      notas: f.notas.value.trim(), activo: f.activo.checked,
    };
    const filas = variantes.filter((v) => v.talla || v.color);
    if (!data.nombre) return toast('Escribe el nombre.', 'error');
    if (!data.precio) return toast('Escribe el precio de venta.', 'error');
    if (!filas.length) return toast('Agrega al menos una talla/color.', 'error');
    if (new Set(filas.map(clave)).size !== filas.length) return toast('Hay variantes repetidas (misma talla y color).', 'error');
    const btn = f.querySelector('.btn-primario'); btn.disabled = true;
    try {
      if (nuevo) await db.add('productos', { ...data, variantes: filas, creado: new Date().toISOString() });
      // Al editar se guarda la DIFERENCIA de stock, así no se pierde una venta que la otra persona hizo mientras tanto.
      else await db.actualizar('productos', id, (cur) => {
        const actual = Object.fromEntries((cur.variantes || []).map((v) => [clave(v), v.stock]));
        const nuevas = filas.map((v) => ({ talla: v.talla, color: v.color,
          stock: Math.max(0, (actual[clave(v)] ?? 0) + v.stock - (original[clave(v)] ?? 0)) }));
        for (const v of cur.variantes || []) if (!(clave(v) in original) && !nuevas.some((n) => clave(n) === clave(v))) nuevas.push(v);
        return { ...data, variantes: nuevas };
      });
      toast('Producto guardado.', 'ok');
      location.hash = '#productos';
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  };

  pintarMargen(); pintarChips(); pintarVariantes();
}
