# 0004 — Motor de análisis de accesibilidad (Backend)

## 1. Propósito

Esta fase implementa el **motor que evalúa los criterios** definidos en
[0003](0003-CriteriosDeAnalisis.md) sobre los emails ya ingeridos en la
[fase de subida](0002-SubidaDeArchivos.md).

El análisis se ejecuta sobre un `html_document` (su `content` y sus `images`
asociadas), evalúa el catálogo de reglas por categoría y **persiste el
resultado** (histórico) para su consulta vía API.

---

## 2. Decisiones de diseño

| Decisión | Valor |
|----------|-------|
| Disparo del análisis | **Manual**, mediante endpoint (`POST /analysis`). No se analiza automáticamente al subir. |
| Histórico | **Cada análisis se guarda** como registro independiente. Permite comparar la evolución de un email tras corregirlo. |
| Resultado por criterio | Cada regla evaluada termina en uno de los **5 estados** (ver sección 3). |
| Puntuación | Cada análisis obtiene un **score de 0% a 100%** (ver sección 4). |
| Ejecución | **Síncrona** (análisis estático, milisegundos). Sin colas. |

---

## 3. Estados de evaluación

Cada regla evaluada sobre un documento produce un resultado con uno de estos
estados:

| Estado | Significado |
|--------|-------------|
| `OK` | El criterio se cumple correctamente. |
| `ERROR` | Existe un incumplimiento claro. |
| `AVISO` | No es un error bloqueante, pero puede generar problemas. |
| `VALIDADO_IA` | Validación realizada por IA en casos puntuales (se concretará en una fase posterior; ver sección 9). |
| `REVISION_PENDIENTE` | La app (o la IA) no pueden confirmar el cumplimiento con suficiente seguridad. Requiere revisión manual. |

> Mientras la validación por IA no esté implementada, las reglas que la
> requieran emitirán `REVISION_PENDIENTE`.

---

## 4. Score (0% – 100%)

Fórmula inicial (ajustable cuando haya datos reales):

- Cada regla evaluada aporta puntos según su estado:
  `OK` = 1 · `VALIDADO_IA` = 1 · `AVISO` = 0.5 · `ERROR` = 0
- Las reglas en `REVISION_PENDIENTE` **quedan fuera del cálculo** (ni suman ni
  penalizan: no se puede afirmar nada sobre ellas).

```
score = redondear( 100 × suma_de_puntos / nº_de_reglas_puntuables )
```

Si ninguna regla es puntuable, el score queda sin calcular (`null`).

---

## 5. Estructura de la base de datos

Se añaden tres tablas.

### Tabla `analyses`

Cada ejecución de análisis sobre un documento.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `NUMBER` | Identificador único (clave primaria). |
| `html_id` | `NUMBER` | FK hacia `html_documents` (cascade). |
| `score` | `NUMBER` (nullable) | Puntuación 0–100 del análisis. |
| `created_at` | `date` | Fecha de ejecución. |

### Tabla `analysis_checks`

El resultado de **cada regla evaluada** en un análisis (incluidas las que
resultan `OK`).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `NUMBER` | Identificador único (clave primaria). |
| `analysis_id` | `NUMBER` | FK hacia `analyses` (cascade). |
| `rule` | `string` | Código estable de la regla (p. ej. `IMG_NO_ALT`). |
| `category` | `string` | `STRUCTURE`, `IMAGES`, `TYPOGRAPHY`, `COLOR_CONTRAST`, `LINKS_BUTTONS`, `RESPONSIVE_CSS`. |
| `status` | `string` | Uno de los 5 estados de la sección 3. |
| `message` | `string` | Resumen en castellano (p. ej. "3 imágenes sin atributo alt"). |

### Tabla `analysis_findings`

Las **ocurrencias concretas** de los checks que no resultan `OK` (dónde está el
problema dentro del HTML).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `NUMBER` | Identificador único (clave primaria). |
| `check_id` | `NUMBER` | FK hacia `analysis_checks` (cascade). |
| `location` | `string` | Ubicación del elemento (p. ej. `table > tr > td > img[2]`). |
| `evidence` | `TEXT` | Fragmento del HTML afectado. |

**Relaciones**: `html_documents` 1—N `analyses` 1—N `analysis_checks` 1—N `analysis_findings`.

---

## 6. Arquitectura del módulo

Nuevo módulo `modules/analysis/` con el patrón ya establecido (caso de uso
orquestador + un colaborador por eje, como los parsers de la fase 0002):

```
modules/analysis/
├── analysis.module.ts                      (composition root)
├── domain/
│   ├── check.interface.ts                  (estados, categorías, Check, Finding)
│   ├── analyzer.interface.ts               (puerto: analyze(ctx) → checks)
│   ├── analyze-html-document.use-case.ts   (orquestador: contexto → analizadores → score → persistir)
│   ├── list-analyses.use-case.ts / get-analysis.use-case.ts
│   └── analyzers/
│       ├── structure.analyzer.ts
│       ├── images.analyzer.ts
│       ├── typography.analyzer.ts
│       ├── color-contrast.analyzer.ts
│       ├── links-buttons.analyzer.ts
│       └── responsive-css.analyzer.ts
└── infrastructure/
    ├── parsing/       (parser HTML → AnalysisContext: DOM + estilos + images de BD)
    ├── persistence/   (analysis.repository + impl Prisma)
    └── transport/     (analysis.router.ts)
```

Claves del diseño:

- El HTML se **parsea una sola vez** (`AnalysisContext`) y se inyecta a los
  seis analizadores.
- Cada analizador es **una función pura** (sin I/O): recibe el contexto y
  devuelve sus checks/findings → unit-testeable sin BD ni HTTP.
- El `AnalysisContext` incluye las `images` de la BD, reutilizando el
  `is_accesible` calculado en la fase 0002 (imágenes rotas).

---

## 7. Catálogo de reglas

Códigos estables por categoría (mapean los criterios del doc 0003). El estado
indicado es el que produce la regla **cuando detecta el problema**; si no
detecta nada, la regla emite `OK`.

### STRUCTURE — Estructura y maquetación

| Código | Criterio (0003 §2.1) | Resultado al fallar |
|--------|----------------------|---------------------|
| `STR_TABLE_NO_PRESENTATION` | Tabla de layout sin `role="presentation"` | `ERROR` |
| `STR_COMPLEX_NESTING` | Anidamiento de tablas demasiado profundo (> 4 niveles) | `AVISO` |
| `STR_TOO_MANY_COLUMNS` | Exceso de columnas (> 3) | `AVISO` |
| `STR_CONTENT_BLOCKS` | Falta título, texto explicativo o CTA (heurística) | `AVISO` |
| `STR_INCOMPATIBLE_LAYOUT` | Layout poco compatible con clientes de correo | `AVISO` |

### IMAGES — Imágenes

| Código | Criterio (0003 §2.2) | Resultado al fallar |
|--------|----------------------|---------------------|
| `IMG_NO_ALT` | Imagen sin atributo `alt` | `ERROR` |
| `IMG_EMPTY_ALT_SUSPECT` | `alt` vacío en imagen que no parece decorativa | `AVISO` |
| `IMG_GENERIC_ALT` | `alt` demasiado genérico ("imagen", "foto", "banner"…) | `AVISO` |
| `IMG_BROKEN` | Imagen rota o no encontrada (usa `images.is_accesible` de la fase 0002) | `ERROR` |
| `IMG_LINKED_NO_ALT` | Imagen enlazada sin alternativa útil | `ERROR` |
| `IMG_SUSPECT_NAME` | Nombre sospechoso de contener texto (`banner`, `promo`, `oferta`, `cta`, `descuento`…) | `REVISION_PENDIENTE` |
| `IMG_TEXT_IN_IMAGE` | Posible texto importante dentro de la imagen | `VALIDADO_IA` (futuro; de momento `REVISION_PENDIENTE`) |

### TYPOGRAPHY — Tipografía y legibilidad

| Código | Criterio (0003 §2.3) | Resultado al fallar |
|--------|----------------------|---------------------|
| `TYP_FONT_TOO_SMALL` | Tamaño de fuente < 14px | `ERROR` |
| `TYP_BODY_BELOW_RECOMMENDED` | Cuerpo de texto < 16px (recomendación) | `AVISO` |
| `TYP_LINE_HEIGHT` | Line-height insuficiente (< 1.4) | `AVISO` |
| `TYP_LONG_BLOCK` | Bloques de texto de más de 60-80 palabras | `AVISO` |
| `TYP_LEGAL_TOO_SMALL` | Textos legales excesivamente pequeños | `AVISO` |
| `TYP_EXCESS_CAPS` | Uso excesivo de mayúsculas | `AVISO` |
| `TYP_DENSE_BLOCK` | Bloques demasiado densos | `AVISO` |

### COLOR_CONTRAST — Color y contraste

| Código | Criterio (0003 §2.4) | Resultado al fallar |
|--------|----------------------|---------------------|
| `COL_CONTRAST_NORMAL` | Contraste < 4.5:1 en texto normal (cuando texto y fondo son determinables) | `ERROR` |
| `COL_CONTRAST_LARGE` | Contraste < 3:1 en texto grande | `ERROR` |
| `COL_TEXT_OVER_IMAGE` | Texto sobre imagen o fondo complejo | `REVISION_PENDIENTE` |
| `COL_ONLY_COLOR_INFO` | Color como único recurso informativo | `VALIDADO_IA` (futuro; de momento `REVISION_PENDIENTE`) |
| `COL_NO_BG_DEFINED` | Color de texto definido sin fondo determinable (contraste no evaluable) | `REVISION_PENDIENTE` |

### LINKS_BUTTONS — Enlaces y botones

| Código | Criterio (0003 §2.5) | Resultado al fallar |
|--------|----------------------|---------------------|
| `LNK_GENERIC_TEXT` | Texto genérico ("haz clic", "ver más", "leer más", "aquí") | `ERROR` |
| `LNK_EMPTY` | Enlace vacío (sin texto ni contenido accesible) | `ERROR` |
| `LNK_NO_HREF` | Enlace sin `href` | `ERROR` |
| `LNK_CTA_WEAK` | CTA poco descriptivo (heurística) | `AVISO` |
| `LNK_SMALL_TARGET` | Área clicable / padding insuficiente | `AVISO` |
| `LNK_IMG_NO_ALT` | Imagen enlazada sin `alt` descriptivo (ver `IMG_LINKED_NO_ALT`) | `ERROR` |

### RESPONSIVE_CSS — Responsive y zoom

| Código | Criterio (0003 §2.6) | Resultado al fallar |
|--------|----------------------|---------------------|
| `CSS_PROBLEMATIC_PROPERTY` | CSS problemático en clientes de correo (position, flex/grid…) | `AVISO` |
| `CSS_ADVANCED_PSEUDO` | Pseudo-elementos avanzados | `AVISO` |
| `CSS_EXTERNAL_FONTS` | Fuentes externas no seguras | `AVISO` |
| `CSS_CRITICAL_NOT_INLINE` | Estilos críticos no inline | `AVISO` |

---

## 8. API

Todas las rutas van protegidas por `requireAuth` (JWT), como el resto de la
aplicación.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/analysis` | Body `{ htmlId }`. Ejecuta el análisis del documento y devuelve `201` con el análisis completo (score + checks + findings). |
| `GET` | `/analysis` | Listado resumen (id, htmlId, score, fecha). Filtrable con `?html_id=:id`. |
| `GET` | `/analysis/:id` | Detalle de un análisis: score + todos los checks con sus findings. |

---

## 9. Validación por IA (fase posterior)

Algunas reglas (`IMG_TEXT_IN_IMAGE`, `COL_ONLY_COLOR_INFO`, y otras que se
identifiquen) no son evaluables de forma fiable con análisis estático. El plan
es delegarlas en una **validación por IA** puntual que produzca `VALIDADO_IA`
o confirme un incumplimiento.

**Queda fuera del alcance de esta fase.** Se concretará más adelante (modelo,
proveedor, coste y límites). Hasta entonces, esas reglas emiten
`REVISION_PENDIENTE`.

---

## 10. Dependencias necesarias

- **Parser de HTML** (p. ej. `node-html-parser`) — el análisis del DOM no es
  viable con expresiones regulares.
- **Cálculo de contraste propio** (fórmula de luminancia relativa WCAG +
  parseo de colores hex/rgb/nombres). Sin dependencia externa.
- Sin OCR ni navegador headless en esta fase.

---

## 11. Plan de implementación (incrementos TDD)

Cada incremento sigue el ciclo ya establecido: test rojo → implementación →
verde. Los analizadores, al ser funciones puras, se cubren con unit tests
(fixture HTML → checks esperados); los endpoints, con SuperTest.

1. **Base**: modelos Prisma (`analyses`, `analysis_checks`, `analysis_findings`) + migración; esqueleto del módulo; `POST /analysis` con el analizador de **imágenes** (el más determinista y reutiliza `is_accesible`); cálculo del score.
2. **Enlaces/botones** + **estructura** (análisis de DOM, sin CSS).
3. **Infraestructura de estilos** (inline + `<style>`) + **tipografía**.
4. **Color/contraste** (parseo de color, luminancia, herencia de fondos).
5. **Responsive/CSS** (catálogo de compatibilidad).
6. **Consulta**: `GET /analysis` y `GET /analysis/:id`.

---

## 12. Resumen de próximos pasos

- [ ] Definir los modelos Prisma (`analyses`, `analysis_checks`, `analysis_findings`) y migrar.
- [ ] Instalar el parser de HTML.
- [ ] Implementar el módulo `analysis` (contexto + orquestador + score).
- [ ] Implementar los 6 analizadores por incrementos (empezando por imágenes).
- [ ] Exponer `POST /analysis`, `GET /analysis`, `GET /analysis/:id` bajo `requireAuth`.
- [ ] Tests (TDD) con Vitest + SuperTest.
- [ ] (Futuro) Concretar la validación por IA (`VALIDADO_IA`).
