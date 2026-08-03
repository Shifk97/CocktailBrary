# CocktailBrary 🍸

> **Cocktail + Library** | Gestión personal de recetas e inventario de coctelería.

---

## ⚠️ ADVERTENCIA

Este proyecto ha sido desarrollado completamente con el uso de **Inteligencia Artificial** y **no se recomienda su uso en un entorno profesional**, debido a que el código no ha sido auditado ni comprobado exhaustivamente por un ser humano.

Dicho esto, la aplicación es **completamente funcional para un uso personal** y no se han detectado *bugs* durante el uso habitual.

---

## ACERCA DEL PROYECTO

**CocktailBrary** es una Progressive Web App (PWA) diseñada para ayudarte a gestionar de forma centralizada tu recetario e inventario personal de cócteles.

---

## 🚀 MODO DE USO

1. **Gestión de Recetas:** Añade tus recetas, imágenes, enlaces de compra, método de preparación y notas personalizadas para cada bebida.
2. **Inventario Personal:** Registra todos los licores e ingredientes que tienes en casa. En la pestaña **Home** se mostrarán automáticamente todas las recetas que puedes preparar con lo que tienes disponible.
3. **Lista de la Compra:** Si te falta algún ingrediente para un cóctel, puedes agregarlo directamente a la lista con un solo clic.

---

## ✨ OTRAS FUNCIONES

* 👥 **Soporte Multiusuario:** Permite habilitar o deshabilitar el registro de nuevos usuarios mediante variables de entorno para compartir la aplicación. Cada usuario tiene sus propias recetas, notas e inventario.
* 📖 **Wiki Integrada:** Añade notas personales organizadas (ideal para documentar tipos de cristalería, técnicas de mezclado o historia).
* 📊 **Métricas e Insights:** Consulta estadísticas sencillas y útiles, como tus cócteles e ingredientes más usados, o el coste estimado por bebida.
* 💾 **Exportación de Datos:** Exporta toda tu información y base de datos en formato `JSON` en cualquier momento.

---

## 🛠️ INSTALACIÓN Y DESPLIEGUE

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/cocktailbrary.git
cd cocktailbrary
```

### 2. Configurar variables de entorno (`.env`)
Crea un archivo `.env` en la raíz del proyecto basándote en la siguiente estructura:

```env
JWT_SECRET=tu_secreto_generado_aqui
PORT=3000
EXTERNAL_PORT=3000
```

> **Tip:** Puedes generar un `JWT_SECRET` seguro ejecutando en tu terminal:
> ```bash
> openssl rand -hex 32
> ```

### 3. Levantar con Docker Compose
Para construir la imagen y levantar el contenedor en segundo plano, ejecuta:

```bash
docker compose up -d --build
```

---

## 🐳 DOCKER-COMPOSE DE EJEMPLO

A continuación se muestra la estructura del `docker-compose.yml` que utiliza el proyecto:

```yaml
services:
  cocktailbrary:
    build: .
    image: cocktailbrary:1.6
    container_name: cocktailbrary
    restart: unless-stopped
    ports:
      - "${EXTERNAL_PORT:-3000}:${PORT:-3000}"
    environment:
      JWT_SECRET: ${JWT_SECRET}
      ALLOW_REGISTRATION: "false" # "true" o "false" para permitir nuevos registros
      PORT: ${PORT:-3000}
      DB_PATH: /data/coctelaria.db
    volumes:
      - ./cocktailbrary/data:/data
```

---

### NOTAS FINALES

Este proyecto ha sido creado para satisfacer un problema personal y comprobar el rendimiento y capacidades de las herramientas de IA. No se mantendrá más allá de las necesidades personales. Si se desea ampliar o modificar, se puede hacer un fork de este proyecto.
