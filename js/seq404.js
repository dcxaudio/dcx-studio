/* DCX Studio - o Pattern Sequencer do DCX 404 (vendor/dcx-404/novo/js/sequencer-ui.js) dentro do Studio
 *
 * O sequencer-ui.js do 404 se liga no DOMContentLoaded e le RJ.d404 na hora. No Studio o 404 so existe
 * depois (o index.html espera a face nova entrar, RJ.face404.ready, e entao monta o d404). Este arquivo,
 * carregado logo ANTES do sequencer-ui.js, guarda o listener de DOMContentLoaded que aquele script registra
 * (so o dele, pelo document.currentScript) e o roda quando o Studio chama RJ.studioSeq404.start(), depois
 * do d404.build() e de RJ.d404 = d404. Nada do vendor muda; o resto dos listeners passa direto.
 * Sem o sequencer-ui.js (submodulo antigo) o start() nao faz nada e o 404 segue sem patterns.
 */
(function () {
  "use strict";
  window.RJ = window.RJ || {};
  const add0 = window.addEventListener;
  const held = [];
  const mine = () => { const s = document.currentScript; return !!(s && /\/sequencer-ui\.js(\?|$)/.test(s.src)); };
  window.addEventListener = function (type, fn, opt) {
    if (type === "DOMContentLoaded" && mine()) { held.push(fn); return; }
    return add0.call(this, type, fn, opt);
  };
  RJ.studioSeq404 = {
    start() {
      window.addEventListener = add0;
      const fns = held.splice(0);
      fns.forEach(fn => { try { fn.call(window, new Event("DOMContentLoaded")); } catch (e) { console.warn("Pattern Sequencer do 404 nao ligou", e); } });
      return fns.length > 0;
    },
  };
})();
