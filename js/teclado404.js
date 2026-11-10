/* DCX Studio - o teclado do computador no DCX 404, so com o 404 selecionado
 *
 * O mapa e o Learn por teclado sao os do 404 novo (vendor/dcx-404/novo/js/teclado.js, sem mudar o vendor):
 * Ctrl 1-3 U/J, I/K, O/L; Volume =/-; bancos F1-F5; REC T; MFX N; CANCEL Backspace; PATTERN SELECT P,
 * LENGTH Y, QUANTIZE H, DEL G, REMAIN B, START/END/LEVEL , (virgula), TIME/BPM . (ponto). Os pads e as
 * teclas 13-16 (1-4 / Q-R / A-F, Z Hold, X Sub Pad, C/V banco -/+) sao os do solo.js do 404, refeitos aqui
 * (o solo.js e a pagina solo inteira: host, tela LIGAR, aviso, barra do Learn; nao entra no Studio).
 *
 * Regra: so age quando o 404 e a maquina selecionada (js/select.js: a ultima clicada, contorno ambar).
 * Com RJ-2000, RJ-950, RJ-42 ou RJ-1202 selecionado nenhuma tecla do 404 age e as teclas das outras
 * maquinas seguem como antes. Com o 404 selecionado, as teclas que ele usa nao chegam ao RJ-2000; as outras
 * (Espaco, setas, Enter, 5-0...) seguem para ele como antes. Campo de texto, Cmd/Ctrl/Alt + tecla: livres.
 * Shift: o do Studio (js/select.js). Perder o foco ou trocar de aba solta tudo.
 *
 * Como: este arquivo carrega ANTES do teclado.js e embrulha os listeners de keydown e roda que ele registra
 * (so os dele, pelo document.currentScript) com a checagem "404 selecionado"; o DOMContentLoaded dele fica
 * guardado e roda em start(), depois do 404 do Studio montado, com um host de mentira (on, learn, midi).
 * Mapa: "studio/dcx404/keymap" (o learn do Studio guarda "keymap" la; o midimap segue em "studio/midimap").
 * Learn: o do SET-UP 22 do RJ-2000 (ou o botao Learn do mixer / MIDI Learn da config): tocar num controle do
 * 404, apertar uma tecla, Enter salva (tecla com dono: o 1o Enter avisa no LCD e o 2o troca), Delete apaga, Esc sai.
 * Legendas: escondidas; "Teclas do 404" (config, MIDI geral) liga/desliga; segurar Alt/Option mostra.
 *
 *   RJ.studioKeys404.start({ studio, sp, d404, sel })   sel = o que RJ.padSelect devolve
 */
(function () {
  "use strict";
  const RJ = (window.RJ = window.RJ || {});
  const add0 = window.addEventListener;
  const KEY = "dcx404/keymap";
  const held = [];
  let gate = () => false, after = () => {};
  const fromTeclado = () => { const s = document.currentScript; return !!(s && /\/novo\/js\/teclado\.js(\?|$)/.test(s.src)); };
  function hook(type, fn, opt) {
    if (typeof fn === "function" && fromTeclado()) {
      if (type === "DOMContentLoaded") { held.push(fn); return; }
      if (type === "keydown" || type === "wheel") {
        const f = fn;
        fn = function (e) { if (!gate(e)) return; const r = f.call(this, e); after(e); return r; };
      }
    }
    return add0.call(this, type, fn, opt);
  }
  window.addEventListener = hook;

  const PAD_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyA", "KeyS", "KeyD", "KeyF"];
  const EXTRA = [{ code: "KeyZ", id: "hold" }, { code: "KeyX", id: "subpad" }, { code: "KeyC", bank: -1 }, { code: "KeyV", bank: +1 }];
  // o mesmo criterio do js/keyguard.js
  const typing = el => {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    const t = el.tagName;
    if (t === "TEXTAREA" || t === "SELECT") return true;
    if (t !== "INPUT") return false;
    return !/^(button|checkbox|radio|range|file|submit|reset|color|image)$/i.test(el.type || "text");
  };
  const mod = e => e.metaKey || e.ctrlKey || e.altKey;

  RJ.studioKeys404 = {
    start(o) {
      const { studio, sp, d404, sel } = o;
      if (window.addEventListener === hook) window.addEventListener = add0;
      const K = RJ.d4Keys, L = studio.learn;
      if (!K || !held.length || !d404 || !d404.root || !sel) { held.length = 0; return false; }
      const root = d404.root;
      const active = () => sel.sel === "dcx404";
      const mine = id => { const t = id && L.targets.get(id); return !!(t && root.contains(t.el)); };
      // no Learn, o teclado.js so ve as teclas quando o controle escolhido e do 404 (ou nenhum ainda)
      gate = e => active() && (e.type !== "keydown" || !L.learning || !L.sel || mine(L.sel));
      after = e => { if (e.type === "keydown" && L.learning) sp.renderLCD(); };

      // o mapa de teclado fica em studio/dcx404/keymap (o resto do store do learn nao muda)
      const st = L.store;
      if (st && !st.keys404) {
        const k = n => (n === "keymap" ? KEY : n);
        L.store = Object.assign({}, st, { keys404: true, get: n => st.get(k(n)), put: (n, v) => st.put(k(n), v) });
      }
      // o host que o teclado.js espera (RJ.solo): so on, learn e midi
      const host = { get on() { return studio.on; }, learn: L, midi: studio.midi };
      const solo0 = RJ.solo;
      RJ.solo = host;
      try { held.splice(0).forEach(fn => { try { fn.call(window, new Event("DOMContentLoaded")); } catch (e) { console.warn("Teclado do 404 nao ligou", e); } }); }
      finally { if (solo0 === undefined) delete RJ.solo; else RJ.solo = solo0; }

      /* ------------------------------------------------ pads e teclas 13-16 (como o solo.js do 404) */
      const N = d404.padEls.length;
      const pads = new Set(), extras = new Map();   // code -> elemento da tela afundado
      const extraEl = x => (x.id ? root.querySelector(`[data-ctrl="${x.id}"]`) : root.querySelector(`[data-ctrl="bank-${"abcde"[(d404.st.bank + x.bank + 5) % 5]}"]`));
      function extraDown(x) {
        if (extras.has(x.code)) return;
        const el = extraEl(x);
        extras.set(x.code, el);
        if (el) el.dataset.press = "1";
        if (x.id) d404.pressKey(x.id, true); else d404.bankStep(x.bank);
        d404.renderButtons();
      }
      function extraUp(x) {
        if (!extras.has(x.code)) return false;
        const el = extras.get(x.code);
        extras.delete(x.code);
        if (el && ![...extras.values()].includes(el)) delete el.dataset.press;
        if (x.id) d404.pressKey(x.id, false);
        d404.renderButtons();
        return true;
      }
      const padUp = i => { if (!pads.delete(i)) return false; d404.padEls[i].classList.remove("down"); d404.padUp(i); return true; };
      const releaseAll = () => { [...pads].forEach(padUp); EXTRA.forEach(extraUp); };

      // na captura, depois do teclado.js (as teclas do mapa dele ja pararam la): o RJ-2000 nao ve estas
      add0.call(window, "keydown", e => {
        if (!active() || !studio.on || mod(e) || typing(e.target)) return;
        if (L.learning) {
          // Enter com uma tecla esperando num controle do 404: salva no teclado (o RJ-2000 salvaria so o MIDI)
          if ((e.code === "Enter" || e.code === "NumpadEnter") && K.ready && K.cand && mine(L.sel)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.repeat) return;
            const n = K.save();
            if (n) sp.flash("Saved Key", K.after ? lossLine(K.after) : n, K.after ? 2500 : 1000);
            else sp.renderLCD();
          }
          return;
        }
        const i = PAD_KEYS.indexOf(e.code);
        if (i >= 0 && i < N) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (e.repeat || pads.has(i)) return;
          pads.add(i);
          d404.padEls[i].classList.add("down");
          d404.padDown(i, 1);
          return;
        }
        const x = EXTRA.find(k => k.code === e.code);
        if (!x) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) extraDown(x);
      }, true);
      // soltar sempre solta (mesmo se a selecao mudou no meio), e o RJ-2000 nao recebe o keyup de uma tecla do 404
      add0.call(window, "keyup", e => {
        const i = PAD_KEYS.indexOf(e.code);
        if (i >= 0 && padUp(i)) { e.stopImmediatePropagation(); return; }
        const x = EXTRA.find(k => k.code === e.code);
        if (x && extraUp(x)) e.stopImmediatePropagation();
      }, true);
      add0.call(window, "blur", releaseAll);
      document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });

      /* ------------------------------------------------ LCD do Learn (SET-UP 22) com o teclado */
      const fit = s => String(s).slice(0, 16);
      const keyTxt = (t, codes) => codes.map(c => K.label(c)).join(K.isValue(t) ? "/" : " ");
      // "Rec ficou sem tecla" -> "Rec: no key"; "Ctrl 2 ficou só com K" -> "Ctrl 2: only K"
      function lossLine(s) {
        const p = s.split("; ")[0];
        return fit(p.replace(/ ficou sem tecla$/, ": no key").replace(/ ficou só com (.+)$/, ": only $1"));
      }
      const lp0 = sp.learnPage.bind(sp);
      sp.learnPage = function () {
        const page = lp0(), r0 = page.render;
        page.render = () => {
          const t = L.sel && L.targets.get(L.sel);
          if (!K.ready || L.cand || !(mine(L.sel) || (!t && K.cand && active()))) return r0();
          if (!t) return ["MIDI Learn", fit("Key " + K.label(K.cand[0]) + ": Touch")];
          if (K.note) {
            const fixed = /tecla fixa/.test(K.note), swap = /troca$/.test(K.note);
            return [fit(t.name), fixed ? "Fixed Key: Other" : swap ? "Taken: Ent=Swap" : "1 Key: Ent=Save"];
          }
          if (K.cand) return [fit(t.name), fit("Key " + keyTxt(t, K.cand) + (K.isValue(t) && K.cand.length === 1 ? " +Dn" : " Ent"))];
          const ks = K.keysOf(t.id), b = L.bound(t.id);
          if (ks.length) return [fit(t.name), fit("Key " + keyTxt(t, ks) + (b ? " +MIDI" : ""))];
          return [fit(t.name), b ? fit("Now " + RJ.MidiMap.label(b)) : "Key or MIDI..."];
        };
        return page;
      };
      K.isValue = t => !!t && (t.kind === "value" || t.kind === "encoder");

      /* ------------------------------------------------ "Teclas do 404" (config, MIDI geral) */
      const row = document.querySelector("#cfg .btnrow");
      if (row) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "one keys404"; b.dataset.ctrl = "teclas-404"; b.textContent = "Teclas do 404";
        b.setAttribute("aria-pressed", "false");
        b.title = "Mostra ou esconde, no DCX 404, a tecla do computador de cada controle (segurar Alt/Option tambem mostra). As teclas so tocam com o 404 selecionado.";
        b.addEventListener("click", () => { if (!K.ready) return; K.show = !K.show; K.persist(); K.renderHints(); });
        row.appendChild(b);
        K.btn = b;
        if (K.ready) K.renderHints();
      }
      return true;
    },
  };
})();
