// Pruebas rápidas de la lógica de dinero y stock. Ejecutar: node tests/utils.test.mjs
import assert from 'node:assert/strict';
import { leerPesos, fmt, ajustarStock, periodo, sumarDias, validarRespaldo } from '../js/utils.js';

assert.equal(leerPesos('25'), 25000);
assert.equal(leerPesos('999'), 999000);
assert.equal(leerPesos('1.500'), 1500);
assert.equal(leerPesos('45.000'), 45000);
assert.equal(leerPesos(''), 0);
assert.equal(fmt(45000), '$45.000');
assert.equal(fmt(-9000), '-$9.000');

const p = { nombre: 'X', variantes: [{ talla: 'M', color: 'Negro', stock: 2 }] };
assert.equal(ajustarStock(p, [{ talla: 'M', color: 'Negro', cant: 2 }], -1)[0].stock, 0);
assert.throws(() => ajustarStock(p, [{ talla: 'M', color: 'Negro', cant: 3 }], -1), /suficiente stock/);
assert.throws(() => ajustarStock(p, [{ talla: 'L', color: 'Negro', cant: 1 }], -1), /ya no existe/);
assert.equal(ajustarStock(p, [{ talla: 'L', color: 'Rojo', cant: 4 }], 1)[1].stock, 4); // entrada crea la variante
assert.equal(p.variantes[0].stock, 2); // no modifica el original

assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
const [lunes, hoy] = periodo('semana');
assert.equal(new Date(lunes + 'T00:00:00Z').getUTCDay(), 1);
assert.ok(lunes <= hoy);
const ok = JSON.stringify({ app: 'oth-style', datos: { productos: [{ id: 'a1', nombre: 'X' }], ventas: [] } });
assert.equal(validarRespaldo(ok).datos.productos.length, 1);
assert.throws(() => validarRespaldo('{no json'), /no es un respaldo/);
assert.throws(() => validarRespaldo(JSON.stringify({ app: 'otra', datos: {} })), /no es un respaldo de OTH/);
assert.throws(() => validarRespaldo(JSON.stringify({ app: 'oth-style', datos: { usuarios: [] } })), /dañado/);
assert.throws(() => validarRespaldo(JSON.stringify({ app: 'oth-style', datos: { productos: [{ id: 'a/b' }] } })), /dañado/);
console.log('OK: todas las pruebas pasaron');
