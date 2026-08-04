# Cocktailbrary v1.1 — despliegue con Docker

Backend real (Node + Express + SQLite, autenticación con bcrypt + JWT) sirviendo el
frontend ya compilado, todo en una sola imagen Docker basada en Alpine.

## Arrancarlo

1. Descomprime el proyecto y entra en la carpeta.
2. (Recomendado) define un secreto propio para firmar los tokens de sesión:

   ```bash
   export JWT_SECRET=$(openssl rand -hex 32)
   ```

3. Levanta todo:

   ```bash
   docker compose up --build
   ```

4. Abre `http://localhost:3000` (o `http://IP-DEL-SERVIDOR:3000` desde otro dispositivo
   en la misma red). Crea tu usuario desde la pantalla de login — cada usuario tiene su
   inventario, recetas y compra separados, sincronizados entre todos los dispositivos
   donde inicies sesión con esa cuenta.

Para pararlo: `docker compose down` (los datos persisten). Para borrar también los
datos: `docker compose down -v`.

## Qué hay dentro

- **`server/`** — API en Express. SQLite en un único fichero (`better-sqlite3`),
  contraseñas con `bcrypt`, sesiones con JWT (30 días de validez).
- **`client/`** — la app en React (Vite). En producción se compila a estático y el
  propio backend lo sirve, así que solo hay un contenedor y un puerto.
- **`Dockerfile`** — build en 3 fases: compila el frontend, instala las dependencias
  del backend (incluye las herramientas para compilar `better-sqlite3` si hiciera
  falta), y la imagen final solo lleva lo justo para ejecutar. Todo sobre
  `node:22-alpine` por tamaño y consumo de recursos.
- **`docker-compose.yml`** — expone el puerto 3000 y monta un volumen (`coctelaria-data`)
  donde vive el fichero SQLite, para que los datos sobrevivan a reinicios y
  actualizaciones del contenedor.

## Variables de entorno

| Variable     | Por defecto                | Para qué sirve                                  |
|--------------|-----------------------------|--------------------------------------------------|
| `JWT_SECRET` | valor de ejemplo (¡cámbialo!) | Firma los tokens de sesión. Si lo cambias, todos los usuarios tendrán que volver a iniciar sesión. |
| `PORT`       | `3000`                      | Puerto interno del servidor.                     |
| `DB_PATH`    | `/data/coctelaria.db`       | Ruta del fichero SQLite (dentro del volumen).    |

## Actualizar la app sin perder datos

```bash
git pull   # o copia los archivos nuevos
docker compose up --build -d
```

El volumen `coctelaria-data` no se toca al reconstruir la imagen, así que usuarios,
inventario y recetas se mantienen.

## Copias de seguridad

Todo vive en un único fichero SQLite dentro del volumen. Para sacar una copia:

```bash
docker compose exec coctelaria sh -c "cat /data/coctelaria.db" > backup-coctelaria.db
```

## Instalarla en Android (PWA)

Desde julio de 2026 la app es una PWA de verdad: manifest, iconos propios y un
service worker que cachea el "cascarón" (JS/CSS) para que cargue al instante.
Los datos (inventario, recetas...) **siempre** se piden en directo al servidor —
no hay caché de datos, así que no verás información desfasada.

Para instalarla:

1. **Requisito real, no opcional**: los service workers (la pieza que hace posible instalarla) solo funcionan en un "contexto seguro" — o sea, HTTPS, o `localhost` sin más. Una IP de tu red local por HTTP plano (`http://192.168.1.x:3000`) **no cuenta**, así que el navegador no ofrecerá instalarla así. Como ya tienes montada tu propia infraestructura de HTTPS, ponla delante de este contenedor y accede a través de ella.
2. Abre esa URL con Chrome en el móvil.
3. Chrome mostrará un banner de "Añadir a la pantalla de inicio", o desde el menú (⋮) → "Instalar aplicación".
4. Queda instalada con su propio icono, abre en su propia ventana sin barra de navegador, y aparece en el selector de apps recientes como cualquier otra app.

Si cambias el código, `registerType: "autoUpdate"` hace que la próxima vez que
se abra la app compruebe si hay una versión nueva del cascarón y la actualice
sola, sin que tengas que desinstalar/reinstalar nada.

## Nota honesta sobre las pruebas

He probado el backend (registro, login, guardado y lectura de datos, rechazo de
credenciales/tokens inválidos) y la build de producción del frontend ejecutándolos
directamente con Node fuera de Docker, y funcionan correctamente juntos (el backend
sirviendo el frontend compilado). También he comprobado que el manifest, el service
worker y los iconos se sirven con los tipos de contenido correctos. Lo que **no** he
podido probar aquí es el propio `docker build`, porque este entorno no tiene Docker
instalado. Si al construir la imagen `better-sqlite3` diera problemas para compilar
en Alpine (es la única pieza con código nativo), la alternativa más simple es cambiar
la imagen base del `Dockerfile` de `node:22-alpine` a `node:22-slim` (Debian), algo
más pesada pero con menos sorpresas de compatibilidad.
