/* Studio: maquina selecionada para os pads do controlador (Arturia Minilab3).
 * Os 16 pads (canal 10, notas 36-51) tocam so na maquina selecionada: o RJ-2000
 * (pads 1-16) ou o DCX 404 (pads 1-16). Selecionada = a ultima clicada ou focada
 * (pointerdown ou foco dentro do painel dela); o padrao e o RJ-2000. Uma marca
 * (contorno ambar, classe .pad-sel) mostra qual e.
 * O mapa padrao fica sempre ligado: o MIDI Learn vem antes (host.midi.onMessage)
 * e nao desliga estas notas. Este mapa entra na frente do mapa padrao do SP.
 * A tecla Shift do computador faz o Shift do 404 (segurando) quando ele e o selecionado.
 * Notas fora de 36-51 no canal 10 seguem para o mapa padrao do RJ-2000 como antes. */
RJ.padSelect = function (o) {
  "use strict";
  const { studio, sp, d404 } = o;
  const CH = 10, NOTE0 = 36;
  const boxes = { rj2000: document.querySelector(".studio-top > .case"), dcx404: document.getElementById("d4") };
  const api = { sel: "rj2000", select, held: new Map() };
  function select(id) {
    if (!boxes[id]) return;
    api.sel = id;
    if (id !== "dcx404") d404.setShiftKey(false);   // trocou de maquina com Shift apertado: solta o do 404
    Object.keys(boxes).forEach(k => boxes[k] && boxes[k].classList.toggle("pad-sel", k === id));
  }
  const which = t => Object.keys(boxes).find(k => boxes[k] && t && t.nodeType && boxes[k].contains(t));
  const pick = e => { const k = which(e.target); if (k) select(k); };
  window.addEventListener("pointerdown", pick, true);
  window.addEventListener("focusin", pick, true);
  select("rj2000");

  // Shift do teclado = Shift do 404 (segurando), so com o 404 selecionado. O keyguard corta o
  // keydown na window quando o foco esta num campo de texto; o keyup e a perda de foco sempre
  // soltam, para o Shift nunca ficar preso.
  const isShift = e => e.code === "ShiftLeft" || e.code === "ShiftRight";
  window.addEventListener("keydown", e => {
    if (isShift(e) && api.sel === "dcx404" && !e.metaKey && !e.ctrlKey && !e.altKey) d404.setShiftKey(true);
  });
  window.addEventListener("keyup", e => { if (isShift(e) || e.key === "Shift") d404.setShiftKey(false); }, true);
  window.addEventListener("blur", () => d404.setShiftKey(false));
  document.addEventListener("visibilitychange", () => { if (document.hidden) d404.setShiftKey(false); });

  studio.midi.defaults.unshift(d => {
    const st = d[0] & 0xf0, n = d[1] - NOTE0;
    if (!(st === 0x90 || st === 0x80) || (d[0] & 0x0f) !== CH - 1 || n < 0 || n >= 16) return null;
    if (!studio.on) return "Off";
    const on = st === 0x90 && d[2] > 0;
    // a nota solta vai para a maquina que recebeu o toque, mesmo se a selecao mudou no meio
    const id = on ? api.sel : (api.held.get(n) || api.sel);
    if (on) api.held.set(n, id); else api.held.delete(n);
    if (id === "dcx404") {
      const el = d404.padEls[n];
      if (on) { el.classList.add("down"); d404.padDown(n, d[2] / 127); return "Def: 404 Pad " + (n + 1); }
      el.classList.remove("down"); d404.padUp(n); return "Def: 404 Pad " + (n + 1) + " Off";
    }
    // RJ-2000: o mesmo caminho do mapa padrao dele, mas sem desligar com o Learn
    sp.midiDefs.onNote(n, on ? d[2] / 127 : 0, on);
    return "Def: Sound " + "ABCD"[n >> 3] + ((n & 7) + 1) + (on ? "" : " Off");
  });
  return api;
};
