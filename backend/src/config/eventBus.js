// @ts-check
const { EventEmitter } = require('events');

/**
 * Canal interno para que la capa de negocio avise de cosas que hay que empujar
 * a los clientes, sin conocer Socket.IO.
 *
 * Antes cada servicio hacía `require('../socket').getIO()` dentro de la función,
 * porque importarlo arriba creaba un ciclo (message.service → socket → services
 * → message.service). Eso funcionaba de casualidad por el orden de carga, y en
 * TypeScript cada uno de esos require devuelve `any`, borrando los tipos de toda
 * la capa de servicios.
 *
 * Con el bus la dependencia va en un solo sentido: los servicios publican acá y
 * `socket.js` —el único que sabe de Socket.IO— se suscribe.
 *
 * Si todavía no hay servidor de sockets (arranque, CLI, tests), los eventos se
 * descartan en silencio, que es lo que ya hacía el `try/catch` de cada servicio.
 */

const CANAL = 'realtime';

const bus = new EventEmitter();
// Un solo suscriptor real (socket.js); el límite por defecto avisaría de una
// fuga si alguien registrara de más.
bus.setMaxListeners(20);

/**
 * @typedef {Object} EventoTiempoReal
 * @property {string | null} room  Sala destino, o null para emitir a todos.
 * @property {string} event        Nombre del evento que recibe el cliente.
 * @property {any} payload
 */

/** Emite a todos los miembros de una conversación. */
function toConversation(conversationId, event, payload) {
  bus.emit(CANAL, { room: `conv:${conversationId}`, event, payload });
}

/** Emite a todas las sesiones abiertas de un usuario. */
function toUser(userId, event, payload) {
  bus.emit(CANAL, { room: `user:${userId}`, event, payload });
}

/** Emite a todos los clientes conectados (de todas las instancias). */
function toAll(event, payload) {
  bus.emit(CANAL, { room: null, event, payload });
}

/** Lo usa socket.js para engancharse. @param {(e: EventoTiempoReal) => void} handler */
function onRealtime(handler) {
  bus.on(CANAL, handler);
}

module.exports = { toConversation, toUser, toAll, onRealtime };
