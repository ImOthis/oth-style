# OTH Style · Administración de la tienda

Aplicación web para manejar el inventario, las ventas, la caja, los gastos y los reportes de la tienda **OTH Style**.
Funciona en el celular y en el computador, se puede "instalar" como una app y se aloja gratis en GitHub Pages.

- **Hecha con:** HTML, CSS y JavaScript puro, sin nada que compilar.
- **Datos:** Firebase Firestore, gratis con el plan Spark.
- **Inicio de sesión:** Firebase Authentication con correo y contraseña.

> **Modo prueba:** mientras `js/firebase-config.js` tenga los valores de ejemplo, la app funciona igual, pero los datos se guardan
> solo en el navegador de ese dispositivo. Arriba aparece un aviso amarillo. Sirve para probarla antes de conectar Firebase.

> **Truco para los precios:** en cualquier campo de dinero, si escribes `25` se entiende **$25.000**.
> Cualquier número de 1 a 999 se multiplica por 1.000. Debajo del campo verás cómo va a quedar.

---

## Paso 1 · Crear el proyecto en Firebase

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google.
2. Haz clic en **Crear un proyecto**. Ponle un nombre, por ejemplo `oth-style`, y continúa.
   Google Analytics no hace falta, puedes desactivarlo. Haz clic en **Crear proyecto**.

### 1.1 Activar el inicio de sesión con correo
1. En el menú de la izquierda: **Compilación → Authentication → Comenzar**.
2. En la pestaña **Método de acceso**, elige **Correo electrónico/contraseña**, actívalo (solo el primer interruptor) y dale **Guardar**.
3. Ve a la pestaña **Usuarios → Agregar usuario** y crea los 2 usuarios (tu correo y el de tu mamá, cada uno con su contraseña).
   **No hay pantalla de registro en la app:** los usuarios solo se crean aquí.
4. (Opcional, más seguridad) En **Configuración → Acciones del usuario**, desmarca **Habilitar creación (registro)**
   para que nadie más pueda crear cuentas.

### 1.2 Crear la base de datos Firestore
1. En el menú: **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: la más cercana, por ejemplo `southamerica-east1 (São Paulo)`. Ojo: después no se puede cambiar.
3. Elige **Iniciar en modo de producción** y dale **Crear**.

### 1.3 Pegar las reglas de seguridad
1. En Firestore, abre la pestaña **Reglas**.
2. Borra lo que hay y pega todo el contenido del archivo [`firestore.rules`](firestore.rules).
3. Cambia `correo1@ejemplo.com` y `correo2@ejemplo.com` por los **2 correos reales**, en minúsculas y entre comillas.
4. Haz clic en **Publicar**.

Con esto, **solo esos dos correos** pueden ver y modificar los datos, aunque alguien logre crear otra cuenta.

---

## Paso 2 · Copiar la configuración web en la app

1. En Firebase, haz clic en el **engranaje ⚙ → Configuración del proyecto**.
2. Baja hasta **Tus apps** y haz clic en el ícono **`</>`** (Web).
3. Ponle un apodo, por ejemplo `oth-style-web`. **No** marques Firebase Hosting. Haz clic en **Registrar app**.
4. Aparece un bloque con `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`.
5. Abre el archivo `js/firebase-config.js` y reemplaza cada valor de ejemplo (`"TU_API_KEY"`, `"TU_PROYECTO..."`, etc.)
   por el tuyo. Copia solo los valores y deja intactos los nombres de los campos.

> Estos valores **no son secretos**: pueden quedar en un repositorio público. La seguridad la dan las reglas del paso 1.3.

---

## Paso 3 · Autorizar tu dominio de GitHub

1. En Firebase: **Authentication → Configuración → Dominios autorizados → Agregar dominio**.
2. Escribe `TU_USUARIO.github.io`, con tu usuario de GitHub, sin `https://` y sin nada después. Ejemplo: `othstyle.github.io`.
3. Haz clic en **Agregar**.

Sin esto, el inicio de sesión no funciona en la página publicada.

---

## Paso 4 · Subir la app a GitHub y activar GitHub Pages

1. Crea una cuenta en <https://github.com> si no tienes.
2. Arriba a la derecha: **+ → New repository**.
   - Nombre: `oth-style`.
   - Visibilidad: **Public**. GitHub Pages es gratis solo para repositorios públicos.
   - Haz clic en **Create repository**.
3. En la página del repositorio nuevo, haz clic en **uploading an existing file**.
   Arrastra **todo el contenido** de esta carpeta: `index.html`, `manifest.json`, `firestore.rules`, `README.md`
   y las carpetas `css`, `js` e `icons`. Luego haz clic en **Commit changes**.
4. Ve a **Settings → Pages**. En **Source** elige **Deploy from a branch**, rama **main** y carpeta **/ (root)**. Haz clic en **Save**.
5. Espera 1 o 2 minutos y recarga. Arriba aparece la dirección de tu app:
   `https://TU_USUARIO.github.io/oth-style/`

Para actualizar la app más adelante, sube de nuevo los archivos que cambiaron (**Add file → Upload files**).

---

## Paso 5 · Instalar la app en la pantalla de inicio del celular

**Android (Chrome)**
1. Abre `https://TU_USUARIO.github.io/oth-style/` en Chrome.
2. Toca el menú **⋮** y luego **Instalar app** o **Agregar a la pantalla principal**.
3. Aparece el ícono dorado de OTH Style, como una app más.

**iPhone (Safari)**
1. Abre la dirección en **Safari**.
2. Toca el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Toca **Agregar a inicio** y luego **Agregar**.

---

## Cómo se usa (resumen)

| Pantalla | Para qué sirve |
|---|---|
| **Inicio** | Resumen del día: ventas, número de ventas, ganancia, gastos y alertas de stock. Accesos rápidos. |
| **Vender** | Buscas el producto, eliges talla/color y cantidad, se va al carrito. Descuento en $ o %, método de pago (o mixto) y **Confirmar**. Sale el comprobante para WhatsApp o para imprimir. |
| **Productos** | Lista con buscador y filtro. **+ Entrada** suma la mercancía que llega. Al tocar un producto lo editas, ves su margen y manejas sus tallas y colores. |
| **Caja** | Base inicial, ventas del día por método de pago, gastos y **efectivo esperado en caja**. |
| **Ventas** (en *Más*) | Historial. Toca una venta para ver el comprobante o **anularla**: el stock vuelve al inventario y la venta queda marcada, no se borra. |
| **Gastos** (en *Más*) | Registrar arriendo, mercancía, servicios, etc. |
| **Reportes** (en *Más*) | Hoy / semana / mes / rango: ganancia bruta y neta, gráficas, valor del inventario y **exportar a CSV** (se abre en Excel). |
| **Categorías** (en *Más*) | Crear, renombrar y eliminar categorías de productos (con sus tallas sugeridas) y de gastos. |

**Seguridad de las ventas:** si las dos venden el mismo producto al mismo tiempo, Firestore usa una *transacción*.
El inventario nunca queda negativo y no se puede vender más de lo que hay.

**Copia de seguridad:** de vez en cuando exporta ventas, gastos e inventario a CSV desde **Reportes**.

---

## Datos en Firestore (para curiosos)

| Colección | Qué guarda |
|---|---|
| `categorias` | nombre, tallas sugeridas |
| `productos` | nombre, categoría, código, costo, precio, stock mínimo, notas, activo, variantes (talla, color, stock) |
| `ventas` | fecha, día, usuario, ítems (con precio y costo del momento), subtotal, descuento, total, pagos, anulada |
| `gastos` | día, fecha, categoría, monto, método, nota, usuario |
| `categoriasGasto` | nombre |
| `caja` | base inicial de cada día (el id es la fecha) |
| `config` | marca que ya se crearon las categorías iniciales |

## Archivos

```
index.html            página principal
manifest.json         para instalarla como app
icons/                logo e íconos
css/styles.css        diseño
js/firebase-config.js TU configuración de Firebase (paso 2)
js/db.js              elige Firebase o modo prueba
js/db-firebase.js     guardado en Firestore
js/db-local.js        guardado local (modo prueba)
js/utils.js           formatos de pesos, fechas, CSV
js/app.js             menú, inicio de sesión y navegación
js/views/*.js         cada pantalla
firestore.rules       reglas de seguridad (paso 1.3)
```

Para probarla en el computador antes de subirla, abre una terminal en esta carpeta y ejecuta:

```bash
python -m http.server 8000
```

Luego abre <http://localhost:8000>. Abrir `index.html` con doble clic no funciona, porque los módulos necesitan un servidor.
