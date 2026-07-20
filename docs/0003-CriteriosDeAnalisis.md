# 0003 — Criterios de análisis de accesibilidad (AA para emails HTML)

## 1. Propósito

Esta tercera fase define **qué debe revisar la aplicación** para evaluar la
accesibilidad de nivel **AA** adaptada a **emails HTML** (objetivo descrito en
[0001](0001-Planteamiento-inicial.md)).

El análisis se aplica sobre los emails ya ingeridos en la [fase de subida](0002-SubidaDeArchivos.md):
el contenido de cada `html_document` y sus `images` asociadas. Este documento
recoge el **catálogo de criterios** a detectar, agrupados en seis categorías.

> Las referencias de contraste (`4.5:1`, `3:1`) y demás umbrales siguen las
> pautas **WCAG 2.1 nivel AA**, adaptadas a las particularidades de los clientes
> de correo (soporte de CSS limitado, maquetación con tablas, etc.).

---

## 2. Categorías de criterios

### 2.1 Estructura y maquetación

- Uso de **tablas para el layout**.
- Presencia de `role="presentation"` en las tablas de maquetación.
- Estructura clara del email.
- Presencia de **título, texto explicativo y CTA**.
- Exceso de columnas.
- Anidamientos demasiado complejos.
- Uso de layouts poco compatibles con clientes de correo.

### 2.2 Imágenes

- Imágenes **sin atributo `alt`**.
- Imágenes con `alt` **vacío** cuando no parezcan decorativas.
- Imágenes con `alt` demasiado **genérico**.
- Imágenes **rotas o no encontradas**.
- Imágenes **enlazadas sin alternativa útil**.
- Imágenes con **nombres sospechosos** de contener texto importante (p. ej.
  `banner`, `promo`, `oferta`, `cta`, `descuento`).
- Posible **texto importante dentro de imágenes**.

### 2.3 Tipografía y legibilidad

- Tamaños de fuente **inferiores a 14px**.
- Recomendación de **16px** para el cuerpo de texto.
- **Line-height** insuficiente.
- Párrafos demasiado largos.
- Bloques de texto de **más de 60-80 palabras**.
- Textos legales excesivamente pequeños.
- Uso excesivo de **mayúsculas**.
- Bloques demasiado densos.

### 2.4 Color y contraste

- Contraste entre **texto y fondo**.
- Contraste mínimo recomendado de **4.5:1** para texto normal.
- Contraste mínimo recomendado de **3:1** para texto grande.
- Texto sobre **fondos complejos**.
- Texto sobre **imágenes**.
- Uso del **color como único recurso informativo**.
- Elementos con color definido pero **sin fondo claro** (color de fondo no
  determinable → contraste no evaluable).

### 2.5 Enlaces y botones

- Enlaces con textos **genéricos** como "haz clic", "ver más", "leer más" o
  "aquí".
- Enlaces **vacíos** (sin texto ni contenido accesible).
- Enlaces **sin `href`**.
- **CTAs** poco descriptivos.
- Botones con **área clicable insuficiente**.
- Botones con **padding insuficiente**.
- Imágenes enlazadas **sin `alt` descriptivo**.

### 2.6 Responsive y zoom

La aplicación deberá analizar la compatibilidad del CSS con los clientes de
correo y su comportamiento responsive/zoom, detectando:

- **CSS habitual compatible** frente a **CSS problemático** en emails.
- **Pseudo-elementos avanzados**.
- **Fuentes externas** no seguras.
- **Estilos críticos no inline** (CSS que debería ir inline y no lo está).

---

## 3. Resumen de próximos pasos

- [ ] Definir el modelo de resultados del análisis (hallazgos por criterio, con severidad y ubicación).
- [ ] Implementar los analizadores por categoría (estructura, imágenes, tipografía, color/contraste, enlaces/botones, responsive/zoom).
- [ ] Exponer el análisis sobre los `html_documents` ya ingeridos (fase 0002).
- [ ] Tests (TDD) con Vitest.
