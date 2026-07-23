# 0002 — Subida de archivos (Backend)

## 1. Propósito

Esta segunda fase habilita la **ingesta de los emails HTML** que la aplicación
analizará posteriormente (accesibilidad nivel AA, ver [0001](0001-Planteamiento-inicial.md)).

El backend debe permitir subir emails en distintos formatos, **descomponerlos**
(HTML + imágenes), **persistirlos** en base de datos y **validar** que las
imágenes referenciadas son accesibles. Además se expone un **CRUD** para
gestionar los archivos subidos.

---

## 2. Tipos de subida

La aplicación deberá permitir **tres tipos de subida**:

| Tipo | `type` | Descripción |
|------|--------|-------------|
| HTML individual | `HTML` | El usuario sube un único archivo `.html` o `.htm`. |
| ZIP simple | `ZIP_SINGLE` | Un ZIP que contiene **una sola carpeta** con un HTML único y sus imágenes correspondientes. |
| ZIP por lotes | `ZIP_MULTIPLE` | Un ZIP con **varias carpetas**: una por cada email (HTML + imágenes). Cada carpeta representa un email independiente. |

**Diferenciación `ZIP_SINGLE` vs `ZIP_MULTIPLE`**: el `ZIP_SINGLE` trae dentro
**una única carpeta** (un solo HTML con sus imágenes); el `ZIP_MULTIPLE` trae
**varias carpetas**, cada una un email independiente.

En el caso del ZIP por lotes, la aplicación deberá:

1. **Localizar el HTML principal** de cada carpeta.
2. **Asociar las imágenes locales** con su HTML correspondiente.
3. **Procesar cada email por separado** (cada carpeta = un email independiente).

---

## 3. Tratamiento de imágenes

Las imágenes de un email pueden venir de **dos formas**, y la app debe
contemplar ambas:

1. **Imágenes incluidas en el ZIP** — referenciadas con ruta relativa, p. ej.
   `<img src="images/banner.jpg">`. La app puede analizarlas directamente al
   tenerlas disponibles dentro del propio ZIP. Estas imágenes **se guardan en
   disco**, y el campo `url` apunta a su ubicación.
2. **Imágenes en ruta pública** — referenciadas con URL absoluta, p. ej.
   `<img src="https://.../banner.jpg">`. En este caso la app deberá **intentar
   acceder a la URL pública para validar que la imagen existe**. El campo `url`
   guarda la propia URL pública.

> **Marcado de imágenes no accesibles**: cuando una imagen no sea accesible
> (URL pública que no responde o no existe), deberá quedar **marcada** mediante
> el campo `is_accesible` de la tabla `images`, para que el análisis posterior
> lo tenga en cuenta.

---

## 4. Procesamiento por tipo

| Tipo | Procesamiento |
|------|---------------|
| `HTML` | Se guarda el contenido del HTML como un único `html_document`. Sus imágenes se extraen de las etiquetas `<img>` del propio HTML (normalmente rutas públicas, que se validan). |
| `ZIP_SINGLE` | Se descomprime, se localiza el HTML de la carpeta, se guardan en disco las imágenes locales y se validan las públicas. Genera **un** `html_document`. |
| `ZIP_MULTIPLE` | Se descomprime, se recorre **cada carpeta** como email independiente, localizando su HTML principal y asociando sus imágenes. Genera **un `html_document` por carpeta**. |

---

## 5. Estructura de la base de datos

Se añaden tres tablas nuevas.

### Tabla `uploads`

Representa cada subida realizada por el usuario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `NUMBER` | Identificador único (clave primaria). |
| `type` | `string` | Tipo de subida: `HTML`, `ZIP_SINGLE` o `ZIP_MULTIPLE`. |
| `original_name` | `string` | Nombre original del archivo subido. |
| `created_at` | `date` | Fecha de creación del registro. |

### Tabla `html_documents`

Cada HTML procesado (un email). Un `upload` puede tener uno o varios.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `NUMBER` | Identificador único (clave primaria). |
| `upload_id` | `NUMBER` | Clave foránea hacia `uploads`. |
| `name` | `string` | Nombre del documento HTML. |
| `content` | `TEXT` / `LONGTEXT` | Contenido HTML del email. |
| `relative_path` | `string` | Carpeta original dentro del ZIP (si aplica). |
| `created_at` | `date` | Fecha de creación del registro. |

### Tabla `images`

Cada imagen referenciada por un HTML.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `NUMBER` | Identificador único (clave primaria). |
| `html_id` | `NUMBER` | Clave foránea hacia `html_documents`. |
| `original_name` | `string` | Nombre original de la imagen. |
| `url` | `string` | Ubicación del archivo en disco (imágenes locales del ZIP) o URL pública (imágenes remotas). |
| `relative_path` | `string` | Ruta que tenía dentro del ZIP (si aplica). |
| `mime_type` | `string` | Tipo MIME de la imagen. |
| `is_accesible` | `BOOLEAN` | Marca si la imagen es accesible. Para imágenes públicas refleja el resultado de validar su URL. |
| `created_at` | `date` | Fecha de creación del registro. |

**Relaciones**: `uploads` 1—N `html_documents` 1—N `images`.

---

## 6. Gestión CRUD

Para gestionar los archivos subidos se exponen endpoints sobre los tres
recursos: `uploads`, `html_documents` (`/html`) e `images` (`/images`).

### 6.1 Subidas (`/uploads`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/uploads` | Subir un archivo (HTML o ZIP). Detecta el tipo, procesa y persiste. |
| `GET` | `/uploads` | Listar todas las subidas (resumen, sin las relaciones anidadas). |
| `GET` | `/uploads/:id` | Obtener el detalle de una subida (con sus `html_documents` e `images`). |
| `DELETE` | `/uploads/:id` | Eliminar una subida **en cascada** (sus `html_documents`, sus `images` y los ficheros en disco asociados). |

#### Borrado en cascada (`DELETE /uploads/:id`)

Al ser los archivos subidos **inmutables**, la única operación de escritura tras
la subida es su **eliminación completa**. Borrar una subida debe eliminar **todo
lo que cuelga de ella**:

1. **Base de datos** — se elimina la fila de `uploads` y, en cascada, todos sus
   `html_documents` y las `images` de cada uno. La cascada la garantiza el
   `onDelete: Cascade` definido en las relaciones de Prisma
   (`uploads` 1—N `html_documents` 1—N `images`), por lo que basta con borrar el
   `upload` para que se propague al resto.
2. **Disco** — además de los registros, se borran los **ficheros de las imágenes
   locales** que se guardaron al procesar la subida (las que tienen `url`
   apuntando a disco). Las imágenes de **URL pública** no generan fichero, por lo
   que no hay nada que borrar en disco para ellas. La limpieza en disco se acota
   siempre a la carpeta de la subida dentro del directorio de almacenamiento.

**Respuestas**:

| Situación | Código |
|-----------|--------|
| Borrado correcto | `204 No Content` (sin cuerpo). |
| La subida no existe (o `:id` no numérico) | `404 Not Found`. |
| Sin token válido | `401 Unauthorized`. |

### 6.2 Documentos HTML (`/html`)

Permite consultar los `html_documents` (cada email procesado) y sus imágenes
asociadas de forma directa, sin pasar por su `upload`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/html` | Listar todos los `html_documents` (resumen: `id`, `upload_id`, `name`, `relative_path`, `created_at`; sin el `content` ni las `images`). |
| `GET` | `/html/:id` | Obtener el detalle de un `html_document`: sus campos + `content` + sus `images` asociadas. |

### 6.3 Imágenes (`/images`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/images` | Listar todas las `images`. Filtrable por documento con `?html_id=:id` para traer solo las imágenes asociadas a un HTML. |
| `GET` | `/images/:id` | Obtener el detalle de una imagen. |

> Las **imágenes asociadas a un HTML** pueden obtenerse de dos formas
> equivalentes: incluidas en `GET /html/:id`, o filtrando `GET /images?html_id=:id`.

**Todas las rutas (`/uploads`, `/html`, `/images`) van protegidas por el
middleware `requireAuth`** (requieren un JWT válido), igual que el resto de
recursos de la aplicación.

> Los archivos subidos son **inmutables** (no se editan tras la subida), por lo
> que no se contemplan `POST`/`PUT`/`PATCH`/`DELETE` sobre `/html` ni `/images`:
> se crean y se borran a través de su `upload`. Solo se exponen operaciones de
> **lectura** (`GET`) sobre estos dos recursos. El borrado de un `html_document`
> o de una `image` ocurre **únicamente en cascada** al eliminar su `upload`
> (`DELETE /uploads/:id`, ver §6.1).

---

## 7. Dependencias necesarias

- **`formidable`** — parseo de `multipart/form-data` para recibir el archivo
  subido (misma librería que el proyecto de referencia).
- **Librería de descompresión ZIP** (p. ej. `adm-zip`) — para leer el contenido
  de los ZIP subidos.
- **`fetch` nativo** (Node.js 22) — para validar la accesibilidad de las
  imágenes con URL pública.

---

## 8. Resumen de próximos pasos

- [ ] Definir en Prisma los modelos `uploads`, `html_documents` e `images` (+ relaciones, incluido `is_accesible`) y migrar.
- [ ] Instalar dependencias (`formidable`, descompresor ZIP).
- [ ] Implementar la subida y el procesamiento de los tres tipos (`HTML`, `ZIP_SINGLE`, `ZIP_MULTIPLE`), guardando las imágenes locales en disco.
- [ ] Implementar la validación de imágenes públicas y el marcado de `is_accesible`.
- [ ] Implementar el CRUD de `uploads` bajo `requireAuth` (arquitectura hexagonal, como el módulo `auth`).
- [ ] Tests (TDD) con Vitest + SuperTest.
