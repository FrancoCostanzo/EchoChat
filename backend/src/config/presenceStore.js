/**
 * Tracks users whose 'away' presence was set automatically by the presence
 * timeout job (as opposed to a manual choice in Settings). Activity heartbeats
 * only restore 'online' for users in this set, so a manual "away" stays put.
 * In-memory: a server restart forgets auto-away users, who then behave as if
 * they chose away manually until they change presence or reconnect.
 */

const autoAwayUsers = new Set();

module.exports = { autoAwayUsers };
