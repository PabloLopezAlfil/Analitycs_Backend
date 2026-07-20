/**
 * Punto de entrada para la Dev UI de Genkit (`npm run genkit:ui`).
 * Importa los flows para que queden registrados y puedan probarse desde la UI
 * cambiando de proveedor/modelo por variables de entorno (docs/0005 §5).
 */
import './flows/image-contains-text.flow.js';
import './flows/image-alt-review.flow.js';
import './flows/image-decorative.flow.js';
