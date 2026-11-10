/* Studio: maquina selecionada para os pads do controlador (Arturia Minilab3).
 * Os 16 pads (canal 10, notas 36-51) tocam so na maquina selecionada: o RJ-2000
 * (pads 1-16) ou o DCX 404. Selecionada = a ultima clicada ou focada (pointerdown ou
 * foco dentro do painel dela); o padrao e o RJ-2000. Uma marca (contorno ambar,
 * classe .pad-sel) mostra qual e.
 * DCX 404 com a face nova (12 pads x 5 bancos): notas 36-47 = os 12 pads do banco atual,
 * 48 Hold, 49 Sub Pad, 50 banco anterior, 51 proximo banco (o mesmo mapa da pagina solo da
 * face nova, vendor/dcx-404/novo/js/solo.js). Com a face antiga (16 pads) as 16 notas sao pads.
 * O RJ-1202 (mixer) tambem pode ser selecionado (contorno ambar), mas nao tem pads:
 * os pads seguem na ultima maquina com pads (api.padSel) e as teclas das outras
 * maquinas nao mudam (Shift continua so do 404).
 * O mapa padrao fica sempre ligado: o MIDI Learn vem antes (host.midi.onMessage)
 * e nao desliga estas notas. Este mapa entra na frente do mapa padrao do SP.
 * A tecla Shift do computador faz o Shift do 404 (segurando) quando ele e o selecionado.
 * Notas fora de 36-51 no canal 10 seguem para o mapa padrao do RJ-2000 como antes. */
RJ.padSelect = function (o) {
  "use strict";
  const { studio, sp, d404, mixer } = o;
  const CH = 10, NOTE0 = 36;
  const boxes = { rj2000: document.querySelector(".unit .case"), dcx404: document.getElementById("d4") };
  if (mixer) boxes.rj1202 = mixer.el;
  const api = { sel: "rj2000", padSel: "rj2000", select, held: new Map() };
  function select(id) {
    if (!boxes[id]) return;
    api.sel = id;
    if (id !== "rj1202") api.padSel = id;
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

  // 404: quantos pads a face tem (12 na nova, 16 na antiga); as notas que sobram viram Hold, Sub Pad e bancos
  const P404 = d404.padEls ? d404.padEls.length : 16;
  const EXTRA = P404 < 16 ? [
    { id: "hold", name: "404 Hold" },
    { id: "subpad", name: "404 Sub Pad" },
    { bank: -1, name: "404 Bank -" },
    { bank: +1, name: "404 Bank +" },
  ] : [];
  const extraEl = x => (x.id ? d404.root.querySelector(`[data-ctrl="${x.id}"]`) : d404.root.querySelector(`[data-ctrl="bank-${"abcde"[(d404.st.bank + x.bank + 5) % 5]}"]`));
  const pressed = new Map();   // nota -> tecla da tela afundada (data-press: o motor desenha .down a partir dele)
  function extraDown(n, x) {
    if (pressed.has(n)) return;
    const el = extraEl(x);
    pressed.set(n, el);
    if (el) el.dataset.press = "1";
    if (x.id) d404.pressKey(x.id, true); else d404.bankStep(x.bank);
    d404.renderButtons();
  }
  function extraUp(n, x) {
    if (!pressed.has(n)) return;
    const el = pressed.get(n);
    pressed.delete(n);
    if (el && ![...pressed.values()].includes(el)) delete el.dataset.press;
    if (x.id) d404.pressKey(x.id, false);
    d404.renderButtons();
  }

  studio.midi.defaults.unshift(d => {
    const st = d[0] & 0xf0, n = d[1] - NOTE0;
    if (!(st === 0x90 || st === 0x80) || (d[0] & 0x0f) !== CH - 1 || n < 0 || n >= 16) return null;
    if (!studio.on) return "Off";
    const on = st === 0x90 && d[2] > 0;
    // a nota solta vai para a maquina que recebeu o toque, mesmo se a selecao mudou no meio
    const id = on ? api.padSel : (api.held.get(n) || api.padSel);
    if (on) api.held.set(n, id); else api.held.delete(n);
    if (id === "dcx404") {
      if (n >= P404) {
        const x = EXTRA[n - P404];
        if (!x) return "Def: 404 (sem pad " + (n + 1) + ")";
        if (on) extraDown(n, x); else extraUp(n, x);
        return "Def: " + x.name + (on ? "" : " Off");
      }
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
