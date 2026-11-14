import { db, porNombre } from '../db.js';
import { esc, toast, listaTallas, norm, recargar } from '../utils.js';

export async function render(el) {
  const [cats, prods, gcats] = await Promise.all([db.list('categorias'), db.list('productos'), db.list('categoriasGasto')]);
  const usados = {};
  prods.forEach((p) => { usados[p.categoriaId] = (usados[p.categoriaId] || 0) + 1; });
  cats.sort(porNombre); gcats.sort(porNombre);

  el.innerHTML = `
    <h1>Categorías</h1>
    <section class="card">
      <h2>Nueva categoría de productos</h2>
      <form class="form" data-nueva="categorias">
        <input name="nombre" placeholder="Nombre (ej: Vestidos)" required>
        <input name="tallas" placeholder="Tallas sugeridas separadas por coma (ej: S, M, L)">
        <button class="btn btn-primario">Crear categoría</button>
      </form>
    </section>
    <section class="card">
      <h2>Categorías de productos (${cats.length})</h2>
      <div class="lista">${cats.map((c) => `
        <form class="cat-fila" data-col="categorias" data-id="${c.id}">
          <input name="nombre" value="${esc(c.nombre)}" aria-label="Nombre" required>
          <input name="tallas" value="${esc((c.tallas || []).join(', '))}" placeholder="Tallas sugeridas" aria-label="Tallas sugeridas">
          <div class="cat-acciones"><small class="muted">${usados[c.id] || 0} productos</small>
            <button class="btn chico">Guardar</button>
            <button type="button" class="btn chico btn-peligro" data-borrar>Eliminar</button></div>
        </form>`).join('')}</div>
    </section>
    <section class="card">
      <h2>Categorías de gastos</h2>
      <form class="form" data-nueva="categoriasGasto">
        <input name="nombre" placeholder="Nueva categoría de gasto" required>
        <button class="btn btn-primario">Crear</button>
      </form>
      <div class="lista">${gcats.map((c) => `
        <form class="cat-fila" data-col="categoriasGasto" data-id="${c.id}">
          <input name="nombre" value="${esc(c.nombre)}" aria-label="Nombre" required>
          <div class="cat-acciones"><button class="btn chico">Guardar</button>
            <button type="button" class="btn chico btn-peligro" data-borrar>Eliminar</button></div>
        </form>`).join('')}</div>
    </section>`;

  const datos = (f) => f.tallas ? { nombre: f.nombre.value.trim(), tallas: listaTallas(f.tallas.value) } : { nombre: f.nombre.value.trim() };
  const repetida = (col, nombre, id) => (col === 'categorias' ? cats : gcats).some((c) => c.id !== id && norm(c.nombre) === norm(nombre));

  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, col = f.dataset.nueva || f.dataset.col, d = datos(f);
    if (repetida(col, d.nombre, f.dataset.id)) return toast('Ya existe una categoría con ese nombre.', 'error');
    if (f.dataset.nueva) await db.add(col, d); else await db.set(col, f.dataset.id, d);
    toast('Categoría guardada.', 'ok');
    recargar();
  });
  el.addEventListener('click', async (e) => {
    if (!e.target.matches('[data-borrar]')) return;
    const f = e.target.closest('form'), n = usados[f.dataset.id] || 0;
    if (f.dataset.col === 'categorias' && n)
      return alert(`No se puede eliminar "${f.nombre.value}" porque tiene ${n} producto(s).\nPrimero cambia esos productos a otra categoría.`);
    if (!confirm(`¿Eliminar la categoría "${f.nombre.value}"?`)) return;
    await db.remove(f.dataset.col, f.dataset.id);
    toast('Categoría eliminada.');
    recargar();
  });
}
