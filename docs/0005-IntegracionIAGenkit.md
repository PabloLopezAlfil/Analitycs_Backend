# 0005 — Uso de IA en el análisis (Backend)

## 1. Propósito

Esta fase concreta la **validación por IA** que quedó fuera del alcance del
[motor de análisis](0004-MotorDeAnalisis.md) (sección 9): la aplicación
integrará IA **directamente desde el backend Express** para evaluar los
criterios que no pueden resolverse de forma fiable mediante análisis estático.

---

## 2. Principios de uso

1. **La IA es el último recurso, no el primero.** Se utilizará únicamente para
   los casos imprescindibles que **no** puedan resolverse bien mediante reglas
   automáticas. Todo lo que sea determinista se resuelve con los analizadores
   estáticos de la fase 0004.
2. **Entrada mínima.** La IA **no recibirá el HTML completo por defecto**: solo
   se enviará la información imprescindible para resolver cada punto concreto
   (p. ej. una imagen y su `alt`, el texto de un CTA y su contexto inmediato,
   un fragmento del email).
3. **Salida estructurada.** La IA deberá devolver una **respuesta estructurada**
   (validada contra un schema) para que el backend pueda procesarla
   automáticamente, sin interpretar texto libre.
4. **Confianza insuficiente → revisión pendiente.** Si la IA no tiene
   suficiente confianza en su veredicto, el resultado se marcará como
   `REVISION_PENDIENTE` (nunca se inventa un veredicto).

---

## 3. Casos de uso de la IA

| Caso de uso | Regla relacionada (0004 §7) |
|-------------|------------------------------|
| Determinar si una imagen contiene **texto importante** | `IMG_TEXT_IN_IMAGE` |
| Revisar si un atributo **`alt` describe correctamente** una imagen | `IMG_GENERIC_ALT` / `IMG_LINKED_NO_ALT` |
| Determinar si una imagen es **decorativa o informativa** | `IMG_EMPTY_ALT_SUSPECT` |
| Valorar si una **llamada a la acción es clara** | `LNK_CTA_WEAK` |
| Detectar si la información **depende únicamente del color** | `COL_ONLY_COLOR_INFO` |
| Revisar **elementos visuales complejos** | `COL_TEXT_OVER_IMAGE` |
| Ayudar a **interpretar capturas parciales** del email cuando sea necesario | (apoyo general) |

---

## 4. Flujo de validación

```
analizador estático detecta un caso dudoso (candidato a IA)
        │
        ▼
se construye la entrada mínima del caso (imagen, alt, fragmento…)
        │
        ▼
flow de IA (respuesta estructurada + nivel de confianza)
        │
        ├─ confianza suficiente y cumple      → check `VALIDADO_IA`
        ├─ confianza suficiente y NO cumple   → check `ERROR` / `AVISO` (según la regla)
        └─ confianza insuficiente (o fallo)   → check `REVISION_PENDIENTE`
```

### Respuesta estructurada

Cada flow devuelve siempre esta estructura:

```json
{
  "criterio": "imagen_alt",
  "estado": "VALIDADO_IA",
  "confianza": "alta",
  "elemento": "banner-principal.jpg",
  "problema": null,
  "recomendacion": "No requiere cambios. El alt describe correctamente la imagen.",
  "requiere_revision": false
}
```

| Campo | Quién lo rellena | Descripción |
|-------|------------------|-------------|
| `criterio` | Backend (flow) | Criterio evaluado: `imagen_texto`, `imagen_alt`, `imagen_decorativa`… |
| `estado` | Backend (derivado) | `VALIDADO_IA` (cumple), `INCUMPLE` (el módulo de análisis lo traduce a `ERROR`/`AVISO` según la regla) o `REVISION_PENDIENTE`. |
| `confianza` | Modelo | `alta`, `media` o `baja` (`null` si la IA no respondió). |
| `elemento` | Backend (input) | Identificador del elemento analizado (p. ej. nombre del fichero). |
| `problema` | Modelo | Descripción del problema detectado, o `null` si cumple. |
| `recomendacion` | Modelo | Recomendación breve y accionable, en castellano. |
| `requiere_revision` | Backend (derivado) | `true` cuando la confianza no alcanza el mínimo o la IA falló. |

> **El modelo solo genera su parte** (`cumple`, `confianza`, `problema`,
> `recomendacion`); el `estado` y `requiere_revision` los calcula el backend a
> partir de la confianza mínima exigida (`AI_MIN_CONFIDENCE`: `alta` | `media`
> | `baja`). Así la IA no decide su propio estado.

> Cualquier error técnico (timeout, proveedor caído, respuesta no válida
> contra el schema) también resuelve en `REVISION_PENDIENTE`: la IA nunca
> bloquea el análisis estático.

---

## 5. Herramienta elegida: Genkit

Para la integración se ha decidido utilizar **Genkit**, que aporta:

- Una **buena base** para la implementación de flows de IA en el backend.
- **Cambio de modelo/proveedor rápido y cómodo**, para realizar las distintas
  pruebas de la herramienta sin reescribir la integración (los flows son
  independientes del modelo).
- **Salida estructurada nativa**: los flows definen el schema de entrada/salida
  y Genkit valida la respuesta del modelo contra él.
- Tooling de desarrollo (Dev UI, trazas) para inspeccionar y depurar los flows.

### Configuración

Los proveedores se configuran por variables de entorno (ya previstas en `.env`):

| Variable | Uso |
|----------|-----|
| `OPENAI_API_KEY` | Proveedor OpenAI. |
| `OLLAMA_API_KEY` | Proveedor Ollama (modelos locales). |

El modelo activo será configurable, de modo que pueda alternarse entre
proveedores/modelos durante las pruebas sin tocar el código de los flows.

---

## 6. Consideraciones

- **Privacidad / tamaño de contexto**: enviar solo la entrada mínima (principio 2)
  reduce coste, latencia y exposición del contenido del email.
- **Coste y límites**: la IA solo se invoca para los checks candidatos, no para
  todo el documento; el número de llamadas por análisis queda acotado por los
  casos detectados.
- **Determinismo del score**: los checks resueltos por IA participan del score
  igual que el resto (`VALIDADO_IA` = 1 punto, ver 0004 §4); los
  `REVISION_PENDIENTE` siguen quedando fuera del cálculo.
- **Arquitectura**: la IA se integra como un adaptador más de infraestructura
  (puerto en el dominio del módulo `analysis`, implementación con Genkit),
  manteniendo los analizadores estáticos puros y testeables sin IA.

### Vulnerabilidades conocidas del árbol de Genkit (julio 2026)

Al instalar Genkit, `npm audit` reporta **~64 vulnerabilidades** (moderadas y
altas). Análisis realizado en su momento:

- Son solo **2 CVEs raíz** amplificados por el árbol de dependencias que Genkit
  empaqueta de serie (`@genkit-ai/firebase` → `firebase-admin` → Google Cloud, y
  la telemetría OpenTelemetry):
  1. `uuid < 11.1.1` (moderada) — bounds-check en v3/v5/v6 con buffer propio.
  2. Exporter Prometheus de OpenTelemetry (alta) — crash vía petición HTTP
     malformada al endpoint del exporter.
- **Ninguna afecta a nuestro camino de ejecución**: no usamos Firebase,
  Firestore, Google Cloud Storage ni el exporter de Prometheus.
- **No ejecutar `npm audit fix --force`** (downgradea/rompe Genkit sin arreglar
  nada real; la mayoría figura como `fixAvailable: false` a la espera de que
  Google publique versiones parcheadas).
- Acción acordada: **aceptarlas conscientemente** y **re-auditar al actualizar
  Genkit** (`npm update` + `npm audit`).
- `genkit-cli` debe mantenerse en `devDependencies` (tooling de desarrollo).

> Nota: las 3 vulnerabilidades moderadas restantes ya existían antes de Genkit
> (árbol de `prisma`) y tienen el mismo tratamiento.

---

## 7. Resumen de próximos pasos

- [ ] Instalar y configurar Genkit (proveedores OpenAI e Ollama).
- [ ] Definir el puerto de validación por IA en el módulo `analysis` y su adaptador Genkit.
- [ ] Definir los schemas de entrada/salida estructurada (verdict, confidence, reason) y el umbral de confianza.
- [ ] Implementar los flows por caso de uso (empezando por imágenes: texto en imagen, alt correcto, decorativa/informativa).
- [ ] Conectar los flows con las reglas correspondientes (`IMG_TEXT_IN_IMAGE`, `COL_ONLY_COLOR_INFO`, …).
- [ ] Tests (TDD): flows mockeados en los tests del módulo; la IA real nunca se invoca en la suite.
