// Qué IA usar según los ajustes del iPad.
import { E } from './almacen.js';
import { crearIA } from './ia.js';

/** En el PC de pruebas (localhost) hay un puente que pone la clave desde el fichero .env. */
export const esLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

export function iaConfigurada() { return !!E.ajustes.openrouterClave?.trim() || esLocal; }
export function ia() {
  const clave = E.ajustes.openrouterClave?.trim();
  return clave ? crearIA({ clave }) : crearIA({ base: '/__openrouter' });
}
