# 0001 — Planteamiento inicial (Backend)

## 1. Propósito de la aplicación

La aplicación tiene como objetivo permitir la realización de **análisis de accesibilidad de nivel AA** sobre **emails en formato HTML**.

Este documento recoge la información y los **primeros pasos** a llevar a cabo para el desarrollo del **backend**. Se centra en dejar preparada la base del proyecto: dependencias, estructura del servidor, esquema de base de datos y las rutas iniciales de autenticación.

---

## 2. Stack tecnológico

| Área | Tecnología |
|------|------------|
| Lenguaje | **TypeScript** |
| Runtime / Framework | **Node.js** + **Express** |
| Base de datos | **MySQL** con **Prisma** (ORM) |
| Testing (TDD) | **Vitest** + **SuperTest** |

La metodología de desarrollo será **TDD (Test-Driven Development)**: se escribirán primero las pruebas y a continuación el código que las satisface.

---

## 3. Alcance de la primera fase

En esta primera fase se abordarán las siguientes tareas:

1. **Instalación de las dependencias necesarias** para el stack (TypeScript, Express, Prisma, Vitest, SuperTest y sus tipos).
2. **Definición de los schemas de la base de datos** con Prisma.
3. **Separación de la estructura del servidor y su inicialización** en dos archivos:
   - `app.ts` → construcción y configuración de la aplicación Express (middlewares, rutas). No arranca el servidor.
   - `server.ts` → punto de arranque: importa `app` y pone el servidor a escuchar en un puerto.
4. **Definición de las rutas iniciales de autenticación** (`login` y `logout`).

> El objetivo de separar `app.ts` de `server.ts` es poder **importar la app en los tests** (con SuperTest) sin necesidad de levantar un servidor real escuchando en un puerto.

---

## 4. Dependencias necesarias

### Dependencias de producción
- `express` — framework HTTP.
- `@prisma/client` — cliente de acceso a datos generado por Prisma.

### Dependencias de desarrollo
- `typescript` — compilador de TypeScript.
- `prisma` — CLI de Prisma (migraciones y generación del cliente).
- `vitest` — framework de testing.
- `supertest` — pruebas de endpoints HTTP.
- `@types/node`, `@types/express`, `@types/supertest` — tipados.
- `ts-node` / `tsx` — ejecución de TypeScript en desarrollo.

---

## 5. Estructura de la base de datos

### Tabla `users`

Los usuarios estarán compuestos por los siguientes campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `NUMBER` | Identificador único del usuario (clave primaria). |
| `name` | `string` | Nombre del usuario. |
| `email` | `string` | Correo electrónico del usuario. |
| `password_hash` | `string` | Hash de la contraseña del usuario. |
| `created_at` | `date` | Fecha de creación del registro. |

---

## 6. Estructura del servidor

Se separará la definición de la aplicación de su inicialización:

- **`app.ts`**
  - Crea la instancia de Express.
  - Registra los middlewares globales.
  - Monta las rutas (entre ellas, las de autenticación).
  - Exporta la aplicación configurada.

- **`server.ts`**
  - Importa la aplicación desde `app.ts`.
  - Arranca el servidor escuchando en el puerto configurado.

---

## 7. Rutas de autenticación (Auth)

Para la funcionalidad de autenticación se utilizarán las siguientes rutas:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/login` | Autenticar al usuario. |
| `POST` | `/auth/logout` | Cerrar la sesión del usuario. |

---

## 8. Resumen de próximos pasos

- [ ] Instalar las dependencias necesarias.
- [ ] Definir el schema de Prisma con la tabla `users`.
- [ ] Crear `app.ts` (configuración de la aplicación).
- [ ] Crear `server.ts` (inicialización del servidor).
- [ ] Definir las rutas `POST /auth/login` y `POST /auth/logout`.
