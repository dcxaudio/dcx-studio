/* Studio: enquanto o foco esta num campo de texto (nome do projeto, nome do pad...),
 * os atalhos de teclado das maquinas ficam desligados. Ao sair do campo, voltam.
 * Os atalhos de todas as maquinas ficam em listeners da window (bubble), registrados
 * depois deste. Aqui o listener corta a propagacao so no nivel da window: o campo
 * ainda recebe a tecla e os handlers dele (Enter, Esc) ainda rodam.
 * Carregar ANTES dos scripts das maquinas. */
(function () {
  "use strict";
  const typing = el => {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    const t = el.tagName;
    if (t === "TEXTAREA" || t === "SELECT") return true;
    if (t !== "INPUT") return false;
    return !/^(button|checkbox|radio|range|file|submit|reset|color|image)$/i.test(el.type || "text");
  };
  const guard = e => { if (typing(e.target)) e.stopImmediatePropagation(); };
  window.addEventListener("keydown", guard);
  window.addEventListener("keyup", guard);
})();
