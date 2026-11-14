// Arranque: inicio de sesión, menú y navegación por #rutas.
import { db, modoPrueba, sembrar } from './db.js';
import { initDinero, esc } from './utils.js';
import * as inicio from './views/inicio.js';
import * as venta from './views/venta.js';
import * as ventas from './views/ventas.js';
import * as productos from './views/productos.js';
import * as categorias from './views/categorias.js';
import * as caja from './views/caja.js';
import * as gastos from './views/gastos.js';
import * as reportes from './views/reportes.js';

const $ = (s) => document.querySelector(s);
const vista = $('#vista');

const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const MENU = [ // [ruta, texto, ícono, visible en la barra del celular]
  ['inicio', 'Inicio', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', true],
  ['venta', 'Vender', 'M3 4h2l2.5 11h11L21 7H6.2M9 20h.01M18 20h.01', true],
  ['productos', 'Productos', 'M20 7l-8-4-8 4v10l8 4 8-4zM4 7l8 4 8-4M12 11v10', true],
  ['caja', 'Caja', 'M3 7h18v12H3zM3 11h18M7 15h3', true],
  ['ventas', 'Ventas', 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', false],
  ['gastos', 'Gastos', 'M12 3v18M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6', false],
  ['reportes', 'Reportes', 'M4 20V10M10 20V4M16 20v-7M22 20H2', false],
  ['categorias', 'Categorías', 'M3 5h7v6H3zM14 5h7v6h-7zM3 15h7v6H3zM14 15h7v6h-7z', false],
  ['mas', 'Más', 'M4 7h16M4 12h16M4 17h16', true],
];

function pintarNav() {
  $('#nav').innerHTML = MENU.map(([r, t, d, movil]) =>
    `<a href="#${r}" data-ruta="${r}" class="${movil ? '' : 'solo-pc'} ${r === 'mas' ? 'solo-movil' : ''}">${ic(d)}<span>${t}</span></a>`).join('');
}

function mas(el) {
  el.innerHTML = `<h1>Más opciones</h1><div class="lista-menu">
    ${MENU.filter((m) => !m[3]).map(([r, t, d]) => `<a class="item-menu" href="#${r}">${ic(d)}<span>${t}</span></a>`).join('')}
    </div>`;
}

const RUTAS = {
  inicio: inicio.render, venta: venta.render, ventas: ventas.render, productos: productos.render,
  producto: productos.formulario, categorias: categorias.render, caja: caja.render,
  gastos: gastos.render, reportes: reportes.render, mas,
};

let renderActual = 0;
async function navegar() {
  const [ruta, param] = (location.hash.slice(1) || 'inicio').split('/');
  const fn = RUTAS[ruta] || RUTAS.inicio;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('activo', a.dataset.ruta === (ruta === 'producto' ? 'productos' : ruta)));
  const n = ++renderActual;
  vista.innerHTML = '<p class="cargando">Cargando…</p>';
  try {
    const el = document.createElement('div');
    await fn(el, param);
    if (n === renderActual) vista.replaceChildren(el); // evita que una vista lenta pise a la siguiente
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    vista.innerHTML = `<div class="card error"><h2>Algo salió mal</h2><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
  }
}

function login() {
  vista.innerHTML = `
    <form class="card form login" id="login">
      <img src="icons/logo.svg" alt="" class="login-logo">
      <h1>Iniciar sesión</h1>
      ${modoPrueba ? '<p class="muted">Modo prueba: escribe cualquier correo y contraseña.</p>' : ''}
      <label>Correo<input name="email" type="email" autocomplete="username" required></label>
      <label>Contraseña<input name="pass" type="password" autocomplete="current-password" required></label>
      <p class="error-txt" id="login-error"></p>
      <button class="btn btn-primario grande">Entrar</button>
    </form>`;
  $('#login').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, b = f.querySelector('button');
    b.disabled = true;
    try { await db.login(f.email.value, f.pass.value); }
    catch (err) { $('#login-error').textContent = err.message; b.disabled = false; }
  };
}

$('#aviso-prueba').hidden = !modoPrueba;
$('#salir').onclick = () => { if (confirm('¿Cerrar sesión?')) db.logout(); };
initDinero();
pintarNav();
window.addEventListener('hashchange', () => db.email() && navegar());

db.onAuth(async (u) => {
  $('#nav').hidden = $('#salir').hidden = !u;
  $('#usuario').textContent = u?.email || '';
  document.body.classList.toggle('con-sesion', !!u);
  if (!u) return login();
  try { await sembrar(); } catch (e) { console.error(e); }
  navegar();
});
