// costos.js
// Archivo central de costos por comando.
// Ambos handler.js (para cobrar) y menu.js (para mostrar) importan de aquí,
// así nunca se desincronizan.

export const costoPorComando = {
  ag: 10,
  den: 15,
  denpla: 20,
  denuncias: 20,
  dir: 6,
  dni: 1,
  dnit: 8,
  dnivel: 5,
  dniv: 5,
  nm: 2,
  placa: 5,
  plat: 8,
  rfm: 20,
  rqh: 15,
  soat: 10,
  sueldo: 10,
  telp: 5,
  telpx: 5,
  vv: 0 // gratis
}

// Devuelve el costo de un comando. Si no está en la lista, usa el valor por defecto (2).
export function obtenerCosto(cmdName, defaultCosto = 2) {
  return costoPorComando.hasOwnProperty(cmdName) ? costoPorComando[cmdName] : defaultCosto
}
