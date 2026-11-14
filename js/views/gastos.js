import { db, porNombre } from '../db.js';
import { fmt, esc, hoy, toast, campoPesos, valorPesos, METODOS } from '../utils.js';

export async function render(el) {
  const cats = (await db.list('categoriasGasto')).sort(porNombre);
  el.innerHTML = `
    <h1>Gastos</h1>
    <form id="f" class="card form">
      <h2>Nuevo gasto</h2>
      <div class="dos">
        <label>Fecha<input type="date" name="dia" value="${hoy()}" required></label>
        <label>Monto${campoPesos('monto')}</label>
      </div>
      <label>Categoría<select name="categoria">${cats.map((c) => `<option>${esc(c.nombre)}</option>`).join('')}</select></label>
      <a href="#categorias" class="link-chico">Editar categorías de gastos</a>
      <label>Método de pago<select name="metodo">${METODOS.map((m) => `<option>${m}</option>`).join('')}</select></label>
      <label>Nota (opcional)<input name="nota" placeholder="Ej: arriendo de noviembre"></label>
      <button class="btn btn-primario grande">Guardar gasto</button>
    </form>
    <section class="card">
      <div class="cabecera"><h2>Gastos del mes</h2><input type="month" id="mes" value="${hoy().slice(0, 7)}" aria-label="Mes"></div>
      <div id="lista"></div>
    </section>`;
  const $ = (s) => el.querySelector(s);

  const cargar = async () => {
    const mes = $('#mes').value || hoy().slice(0, 7);
    const gastos = (await db.list('gastos', mes + '-01', mes + '-31')).sort((a, b) => (b.dia + b.fecha).localeCompare(a.dia + a.fecha));
    $('#lista').innerHTML = gastos.length ? `<div class="tabla-simple">
      ${gastos.map((g) => `<div><span><b>${esc(g.categoria)}</b>${g.nota ? ' · ' + esc(g.nota) : ''}<br>
        <small class="muted">${g.dia} · ${esc(g.metodo)} · ${esc((g.usuario || '').split('@')[0])}</small></span>
        <span class="der"><b>${fmt(g.monto)}</b><button class="btn-x" data-borrar="${g.id}" aria-label="Eliminar gasto">×</button></span></div>`).join('')}
      <div class="total"><span>Total del mes</span><b>${fmt(gastos.reduce((s, g) => s + g.monto, 0))}</b></div></div>`
      : '<p class="vacio">No hay gastos este mes.</p>';
  };

  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, monto = valorPesos(f.monto);
    if (!monto) return toast('Escribe el monto.', 'error');
    if (!f.categoria.value) return toast('Crea primero una categoría de gastos.', 'error');
    f.querySelector('button').disabled = true;
    await db.add('gastos', {
      dia: f.dia.value, fecha: new Date().toISOString(), categoria: f.categoria.value,
      monto, metodo: f.metodo.value, nota: f.nota.value.trim(), usuario: db.email(),
    });
    toast('Gasto guardado.', 'ok');
    f.monto.value = ''; f.nota.value = '';
    f.querySelector('button').disabled = false;
    cargar();
  };
  $('#mes').onchange = cargar;
  $('#lista').onclick = async (e) => {
    const b = e.target.closest('[data-borrar]');
    if (b && confirm('¿Eliminar este gasto?')) { await db.remove('gastos', b.dataset.borrar); toast('Gasto eliminado.'); cargar(); }
  };
  await cargar();
}
