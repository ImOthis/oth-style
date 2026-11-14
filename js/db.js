// Elige la capa de datos: Firebase si ya pegaste tu configuración, si no MODO PRUEBA (localStorage).
import { firebaseConfig } from './firebase-config.js';
import { slug } from './utils.js';

export const modoPrueba = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('TU_');
export const db = modoPrueba
  ? (await import('./db-local.js')).crear()
  : (await import('./db-firebase.js')).crear(firebaseConfig);

const ROPA = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PANT = ['28', '30', '32', '34', '36', '38', '40'];
const ZAP = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'];
const BASICA = ['S', 'M', 'L', 'XL'];
const CATEGORIAS = [
  ...['Camisetas', 'Camisas', 'Polos', 'Blusas', 'Buzos/Hoodies', 'Chaquetas', 'Sudaderas'].map((n) => [n, ROPA]),
  ...['Pantalones', 'Jeans', 'Joggers'].map((n) => [n, PANT]),
  ...['Bermudas', 'Shorts', 'Pantalonetas de baño'].map((n) => [n, [...BASICA, '28', '30', '32', '34', '36', '38']]),
  ...['Zapatos', 'Tenis', 'Sandalias', 'Chanclas'].map((n) => [n, ZAP]),
  ...['Gorras', 'Sombreros', 'Medias'].map((n) => [n, ['Única']]),
  ...['Ropa interior', 'Pijamas', 'Ropa deportiva'].map((n) => [n, BASICA]),
  ...['Correas', 'Billeteras', 'Gafas', 'Morrales', 'Relojes', 'Cadenas'].map((n) => [n, ['Única']]),
];
const GASTOS = ['Arriendo', 'Compra de mercancía', 'Servicios', 'Transporte', 'Bolsas', 'Publicidad', 'Nómina', 'Otros'];

// Crea las categorías iniciales una sola vez. Los ids fijos hacen que sea seguro si los dos entran a la vez.
export async function sembrar() {
  if (await db.get('config', 'inicial')) return;
  await Promise.all([
    ...CATEGORIAS.map(([nombre, tallas]) => db.set('categorias', slug(nombre), { nombre, tallas })),
    ...GASTOS.map((nombre) => db.set('categoriasGasto', slug(nombre), { nombre })),
  ]);
  await db.set('config', 'inicial', { fecha: new Date().toISOString() });
}

export const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
