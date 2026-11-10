/* DCX Studio - barra inferior, config de audio e MIDI, projeto em disquetes
 *
 * RJ.studioBar({ studio, sp, s950, r42, d404 }) liga o que o index.html tem na barra e no painel:
 *   - master: um ganho depois do limitador (o limitador e do dcx-core; aqui so troca a curva para
 *     reta quando fica OFF) e o VU, que le esse mesmo ponto. Nada muda no caminho dos aparelhos.
 *   - entrada de audio: escolhe o dispositivo que a Line do 404 (e o sampler) abrem, trocando o
 *     getUserMedia do navegador por um que ja pede o dispositivo escolhido.
 *   - saida de audio: AudioContext.setSinkId, quando o navegador tem.
 *   - MIDI geral: atalhos para o que o RJ-2000 ja faz no SET-UP 22 (o mapa e a chave
 *     studio/midimap continuam os mesmos, no dcx-core).
 *   - projeto: .zip com um disquete JSON por aparelho + projeto.json (indice).
 * Cada aparelho entrega e recebe o proprio estado pela serializacao que ja tem.
 */
(function () {
  "use strict";
  window.RJ = window.RJ || {};

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // o disquete do RJ-1202 entra na lista so quando o mixer esta no Studio (m.mixer)
  const DISKS = [
    { id: "rj2000", label: "RJ-2000", file: "rj-2000.json" },
    { id: "rj950", label: "RJ-950", file: "rj-950.json" },
    { id: "rj42", label: "RJ-42", file: "rj-42.json" },
    { id: "dcx404", label: "DCX 404", file: "dcx-404.json" },
  ];
  const NUM = ["zero", "um", "dois", "tres", "quatro", "cinco", "seis"];
  const slug = s => (String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()) || "projeto";

  RJ.studioBar = function (m) {
    const { studio, sp, s950, r42, d404, mixer } = m;
    const diskLi1202 = $("[data-disk=rj1202]"), projEm = $("#h-proj em"), projFoot = $("#h-proj ~ .foot");
    const diskCount = () => {
      if (projEm) projEm.textContent = "um arquivo .zip, " + NUM[DISKS.length] + " disquetes";
      if (projFoot) projFoot.textContent = "Cada par de botoes salva ou carrega so aquela maquina (um arquivo .json). Salvar projeto junta " + (DISKS.length === 4 ? "os quatro" : "os " + NUM[DISKS.length]) + " mais o indice num .zip.";
    };
    if (mixer) {
      DISKS.push({ id: "rj1202", label: "RJ-1202", file: "rj-1202.json" });
      diskLi1202.hidden = false; diskCount();
      // se o mixer nao ligou, o projeto segue sem o disquete dele
      mixer.whenWorking.then(ok => {
        if (ok) return;
        const i = DISKS.findIndex(d => d.id === "rj1202");
        if (i >= 0) DISKS.splice(i, 1);
        diskLi1202.hidden = true; diskCount();
      });
    }
    const eng = studio.engine;
    const cfgEl = $("#cfg"), cfgBtn = $("#cfg-btn");

    /* ================================================================ configuracao salva */
    const cfg = { master: 100, limiter: true, input: "", output: "", tape: 0 };
    const saveCfg = () => { studio.store.put("bar", JSON.stringify(cfg)); };
    const loaded = studio.store.get("bar").then(v => {
      try { Object.assign(cfg, JSON.parse(v) || {}); } catch (e) { /* sem config salva */ }
      cfg.master = clamp(+cfg.master || 0, 0, 100); cfg.tape = clamp(Math.round(+cfg.tape || 0), 0, 100);
      syncUI(); applyAudio();
    });

    /* ================================================================ painel */
    function panel(open) {
      cfgEl.classList.toggle("open", open);
      cfgBtn.setAttribute("aria-expanded", open);
      if (open) { if (nameField) nameField.value = projName; refreshDevices(); refreshDisks(); refreshMidi(); }
    }
    cfgBtn.addEventListener("click", () => panel(!cfgEl.classList.contains("open")));
    document.addEventListener("keydown", e => { if (e.key === "Escape" && cfgEl.classList.contains("open") && !e.target.closest("input[type=text]")) panel(false); });
    document.addEventListener("pointerdown", e => {
      if (cfgEl.classList.contains("open") && !e.target.closest("#cfg, .sbar")) panel(false);
    });

    /* ================================================================ master, limitador, VU */
    let master = null, tape = null, anL = null, anR = null;
    let mixerOn = false;      // o RJ-1202 ligou: o slider TAPE da barra sai e o Tape e o do mixer
    const identity = new Float32Array([-1, 1]);
    function buildAudio(ctx) {
      if (master && master.context === ctx) return;
      const lim = eng.limiter;
      lim.rjCurve = lim.rjCurve || lim.curve;
      master = ctx.createGain();
      try { lim.disconnect(); } catch (e) { /* ja solto */ }
      // fita no master: limitador -> Tape -> ganho master. Tape 0 = copia a entrada (som igual).
      if (tape) tape.disconnect();
      tape = RJ.Tape ? new RJ.Tape(ctx, { drive: cfg.tape / 100 }) : null;
      if (tape) { lim.connect(tape.input); tape.output.connect(master); } else lim.connect(master);
      master.connect(ctx.destination);
      const sp2 = ctx.createChannelSplitter(2);
      anL = ctx.createAnalyser(); anR = ctx.createAnalyser();
      anL.fftSize = anR.fftSize = 1024;
      master.connect(sp2); sp2.connect(anL, 0); sp2.connect(anR, 1);
      applyAudio();
    }
    const ens = eng.ensure.bind(eng);
    eng.ensure = function () { const ctx = ens(); if (!master || master.context !== ctx) buildAudio(ctx); return ctx; };
    if (eng.ctx) buildAudio(eng.ctx);

    function applyAudio() {
      // com o RJ-1202 funcionando, o Tape e o do master do mixer: o da barra fica em 0 (a copia exata do som)
      if (tape) tape.setDrive(mixerOn ? 0 : cfg.tape / 100);
      if (master) master.gain.setTargetAtTime(cfg.master / 100, master.context.currentTime, 0.01);
      if (eng.limiter && eng.limiter.rjCurve) eng.limiter.curve = cfg.limiter ? eng.limiter.rjCurve : identity;
      applyOutput();
    }
    async function applyOutput() {
      const ctx = eng.ctx, msg = $("#audio-msg");
      if (!ctx) return;
      if (typeof ctx.setSinkId !== "function") return;
      try { await ctx.setSinkId(cfg.output || ""); if (msg && msg.dataset.k === "out") msg.textContent = ""; }
      catch (e) {
        console.warn("Saida de audio nao trocou", e);
        if (msg) { msg.dataset.k = "out"; msg.textContent = "Nao foi possivel usar essa saida; voltou a do sistema."; }
        cfg.output = ""; saveCfg(); syncUI();
        try { await ctx.setSinkId(""); } catch (e2) { /* fica a do sistema */ }
      }
    }

    const tape$ = $("#bar-tape"), tapeO = $("#bar-tape-o"), tapeBox = tape$.closest(".tape");
    if (mixer) {
      Promise.all([loaded, mixer.whenWorking]).then(([, ok]) => {
        if (!ok) return;
        // o valor de Tape que ficou salvo na barra de antes do mixer passa para o Tape do master do mixer (uma vez)
        // (cfg.m12: ja passou; depois disso o TAPE da barra e o da mesa desligada e nao migra mais)
        if (!cfg.m12) { if (cfg.tape > 0) { if (mixer.dev.st.tape === 0) mixer.legacyTape(cfg.tape); cfg.tape = 0; syncUI(); } cfg.m12 = 1; saveCfg(); }
        // mesa desligada (POWER do RJ-1202): o Studio volta a ser o de antes dela, com o TAPE da barra no master
        const pwr = () => { mixerOn = mixer.powered; tapeBox.hidden = mixerOn; applyAudio(); };
        mixer.onPower(pwr); pwr();
      });
    }
    // abaixa o master (~25 ms), faz fn() e sobe de volta: trocar o caminho do som (POWER da mesa) sem estalo
    function duck(fn) {
      const ctx = master && master.context;
      if (!ctx || ctx.state !== "running") { fn(); return Promise.resolve(); }
      const g = master.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.025);
      return new Promise(res => setTimeout(() => {
        try { fn(); } finally {
          const t2 = ctx.currentTime;
          g.cancelScheduledValues(t2); g.setValueAtTime(0, t2); g.linearRampToValueAtTime(cfg.master / 100, t2 + 0.03);
          res();
        }
      }, 40));
    }
    tape$.addEventListener("input", () => { cfg.tape = +tape$.value; tapeO.textContent = cfg.tape; applyAudio(); });
    tape$.addEventListener("change", saveCfg);
    const master$ = $("#cfg-master"), masterO = $("#cfg-master-o"), sw = $("[data-ctrl=limitador]"), limO = $("#cfg-lim-o");
    master$.addEventListener("input", () => { cfg.master = +master$.value; masterO.textContent = cfg.master; applyAudio(); });
    master$.addEventListener("change", saveCfg);
    sw.addEventListener("click", () => { cfg.limiter = !cfg.limiter; syncUI(); applyAudio(); saveCfg(); });
    function syncUI() {
      master$.value = cfg.master; masterO.textContent = cfg.master; tape$.value = cfg.tape; tapeO.textContent = cfg.tape;
      sw.setAttribute("aria-checked", cfg.limiter); limO.textContent = cfg.limiter ? "ON" : "OFF";
      const i = $("#cfg-in"), o = $("#cfg-out");
      if (i && i.querySelector(`option[value="${CSS.escape(cfg.input)}"]`)) i.value = cfg.input;
      if (o && o.querySelector(`option[value="${CSS.escape(cfg.output)}"]`)) o.value = cfg.output;
    }

    // VU: 16 segmentos por canal; o nivel e o pico da janela, em dB
    const N = 16, segs = [], lvl = [0, 0];
    $$(".vu .row").forEach(r => { const a = []; for (let i = 0; i < N; i++) { const s = document.createElement("span"); s.className = "seg"; r.appendChild(s); a.push(s); } segs.push(a); });
    const buf = new Float32Array(1024);
    function peakOf(an) { an.getFloatTimeDomainData(buf); let p = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > p) p = v; } return p; }
    function drawVU() {
      for (let c = 0; c < 2; c++) {
        const an = c ? anR : anL;
        const target = an ? clamp((20 * Math.log10(Math.max(peakOf(an), 1e-5)) + 54) / 54, 0, 1) : 0;
        lvl[c] = target > lvl[c] ? target : lvl[c] * 0.9 + target * 0.1;
        const on = Math.round(lvl[c] * N);
        for (let i = 0; i < N; i++) segs[c][i].className = "seg" + (i < on ? " on" + (i >= 14 ? " clip" : i >= 11 ? " hot" : "") : "");
      }
    }
    const vuEl = $(".vu");
    (function loop() { if (!document.hidden && (anL || lvl[0] > 0.01 || lvl[1] > 0.01)) drawVU(); vuEl.setAttribute("aria-label", "Nivel de saida"); requestAnimationFrame(loop); })();

    /* ================================================================ entrada e saida de audio */
    // quem pedir audio (Line do 404, sampler) abre o dispositivo escolhido; "ideal" cai no padrao se sumiu
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = c => {
        if (c && c.audio && cfg.input) {
          const a = c.audio === true ? {} : Object.assign({}, c.audio);
          if (!a.deviceId) a.deviceId = { ideal: cfg.input };
          c = Object.assign({}, c, { audio: a });
        }
        return gum(c);
      };
    }
    const inSel = $("#cfg-in"), outSel = $("#cfg-out");
    function fill(sel, list, first, kind) {
      sel.innerHTML = "";
      const add = (v, t) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); };
      add("", first);
      list.forEach((d, i) => { if (d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications") add(d.deviceId, d.label || (kind + " " + (i + 1))); });
      return list.some(d => d.label);
    }
    async function refreshDevices() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { inSel.disabled = outSel.disabled = true; return; }
      let devs = [];
      try { devs = await navigator.mediaDevices.enumerateDevices(); } catch (e) { /* sem lista */ }
      const ins = devs.filter(d => d.kind === "audioinput"), outs = devs.filter(d => d.kind === "audiooutput");
      const named = fill(inSel, ins, "Padrao do sistema", "Entrada");
      if (!named && ins.length) { const o = document.createElement("option"); o.value = "__names"; o.textContent = "Mostrar os nomes das entradas..."; inSel.appendChild(o); }
      fill(outSel, outs, "Padrao do sistema", "Saida");
      const canSink = !!(window.AudioContext && AudioContext.prototype.setSinkId);
      outSel.disabled = !canSink;
      if (!canSink) outSel.options[0].textContent = "Padrao do sistema (este navegador nao troca a saida)";
      syncUI();
    }
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener("devicechange", () => { if (cfgEl.classList.contains("open")) refreshDevices(); });
    inSel.addEventListener("change", async () => {
      if (inSel.value === "__names") {
        try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach(t => t.stop()); } catch (e) { /* recusou */ }
        await refreshDevices(); return;
      }
      cfg.input = inSel.value; saveCfg(); await reopenLine();
    });
    outSel.addEventListener("change", () => { cfg.output = outSel.value; saveCfg(); applyOutput(); });
    // se a Line do 404 ja esta aberta, reabre no dispositivo novo
    async function reopenLine() {
      if (!d404.line || !d404.g) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        const node = d404.g.ctx.createMediaStreamSource(stream);
        node.connect(d404.g.srcLine);
        d404.closeLine();
        d404.line = { stream, node };
      } catch (e) { console.warn("Line In nao reabriu", e); $("#audio-msg").textContent = "A entrada escolhida nao abriu."; }
    }

    /* ================================================================ MIDI geral */
    const midiStat = $("#midi-stat");
    function refreshMidi() {
      const mi = studio.midi;
      midiStat.textContent = !mi.access ? "MIDI desligado (ele liga sozinho nas proximas vezes depois de ligado uma vez)."
        : mi.inputs.length ? "Entradas: " + mi.inputs.join(", ") : "MIDI ligado, sem entradas.";
      $("[data-ctrl=midi-ligar]").disabled = !!mi.access;
      const L = studio.learn;
      $("[data-ctrl=midi-salvar]").disabled = !L.custom;
      $("[data-ctrl=midi-limpar]").disabled = !L.custom;
      $("[data-ctrl=midi-learn]").disabled = !studio.on;
    }
    studio.midi.on("change", refreshMidi);
    $("[data-ctrl=midi-ligar]").addEventListener("click", async () => { try { await studio.enableMidi(); } catch (e) { midiStat.textContent = "O navegador nao liberou o MIDI."; return; } refreshMidi(); });
    // o Learn e do RJ-2000: o atalho abre a mesma pagina do SET-UP 22 e fecha o painel para ver o LCD
    $("[data-ctrl=midi-learn]").addEventListener("click", () => {
      if (!studio.on) return;
      sp.openPage(sp.learnPage(), "setup");
      panel(false);
      const lcd = $("#lcd"); if (lcd && lcd.scrollIntoView) lcd.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    $("[data-ctrl=midi-salvar]").addEventListener("click", () => {
      if (!studio.learn.custom) return;
      sp.download(studio.learn.exportData(), "rj2000-midi-learn.json");
    });
    $("[data-ctrl=midi-carregar]").addEventListener("click", () => pick(".json", async f => {
      try { const n = studio.learn.importData(JSON.parse(await f.text())); midiStat.textContent = "Mapa carregado: " + n + " controles."; }
      catch (e) { midiStat.textContent = "Esse arquivo nao e um mapa MIDI."; }
      refreshMidi();
    }));
    $("[data-ctrl=midi-limpar]").addEventListener("click", () => {
      if (!studio.learn.custom || !confirm("Apagar todo o mapa MIDI aprendido?")) return;
      studio.learn.clearAll(); refreshMidi();
    });

    /* ================================================================ nome do projeto */
    let projName = "Sem titulo";
    const nameBtn = $("[data-ctrl=projeto-nome]"), nameEl = $(".name", nameBtn), dot = $(".dirty", nameBtn);
    const nameField = $("#cfg-proj-name");   // o mesmo nome no painel (a barra esconde o nome em tela fina)
    const saveName = () => studio.store.put("projeto", JSON.stringify({ name: projName }));
    // um lugar so para trocar o nome: a barra, o painel e a chave studio/projeto andam juntos
    function setProjName(name, persist = true) {
      const v = String(name == null ? "" : name).trim().slice(0, 60);
      if (v) projName = v;                       // vazio: mantem o nome que ja estava
      if (nameEl) nameEl.textContent = projName;
      if (nameField) nameField.value = projName;
      if (persist && v) saveName();
      return projName;
    }
    const projReady = studio.store.get("projeto").then(v => { try { const d = JSON.parse(v); if (d && d.name) projName = String(d.name).slice(0, 60); } catch (e) { /* novo */ } setProjName(projName, false); });
    nameBtn.addEventListener("click", () => {
      if ($("input", nameBtn)) return;
      const inp = document.createElement("input");
      inp.type = "text"; inp.maxLength = 60; inp.value = projName; inp.setAttribute("aria-label", "Nome do projeto");
      nameEl.hidden = true; nameBtn.insertBefore(inp, nameEl.nextSibling); inp.focus(); inp.select();
      let closed = false;
      const done = ok => {
        if (closed || !inp.parentNode) return;
        closed = true;
        const v = inp.value.trim();
        if (ok && v) setProjName(v);
        inp.remove(); nameEl.hidden = false; nameEl.textContent = projName;
      };
      inp.addEventListener("keydown", e => { if (e.key === "Enter") done(true); else if (e.key === "Escape") { e.stopPropagation(); done(false); } });
      inp.addEventListener("blur", () => done(true));
    });
    // o campo do painel tambem troca o nome (Enter aplica e sai; Esc devolve o que estava)
    if (nameField) {
      nameField.addEventListener("change", () => setProjName(nameField.value));
      nameField.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); setProjName(nameField.value); nameField.blur(); }
        else if (e.key === "Escape") { e.stopPropagation(); nameField.value = projName; nameField.blur(); }
      });
    }

    /* ================================================================ os quatro aparelhos */
    const need = (cond, what) => { if (!cond) throw new Error(what + " ainda nao ligou: ligue o Studio primeiro."); };
    // patterns gravados no 404 (Pattern Sequencer, st.seq.pats; 0 sem o sequencer)
    const pats404 = () => { const q = d404.st && d404.st.seq; return q && q.pats ? Object.keys(q.pats).filter(k => q.pats[k] && q.pats[k].ev && q.pats[k].ev.length).length : 0; };
    const A = {
      rj2000: {
        ready: () => !!(sp.p && sp.on),
        get: () => JSON.parse(RJ.serialize(sp.p)),
        set(d) { sp.useProject(RJ.deserialize(d)); sp.refreshAll(); sp.saveNow(); },
        empty: () => !sp.p || (!sp.p.sounds.some(s => s.pcm) && !sp.p.segments.some(s => s && s.events.length)),
        info: () => { const seq = sp.p.segments.filter(s => s && s.events.length).length, snd = sp.p.sounds.filter(s => s.pcm).length; return seq + (seq === 1 ? " sequencia, " : " sequencias, ") + snd + (snd === 1 ? " som" : " sons"); },
        raw: "rj2000",
      },
      rj950: {
        ready: () => !!s950.loaded,
        get: () => JSON.parse(s950.serialize()),
        set(d) { s950.useState(s950.deserialize(d)); s950.render(); s950.saveNow(); },
        empty: () => !s950.st || !s950.st.samples.length,
        info: () => { const n = s950.st.samples.length; return "memoria com " + n + (n === 1 ? " sample, " : " samples, ") + (s950.used() * 2 / 1e6).toFixed(1).replace(".", ",") + " MB"; },
        raw: "rj950",
      },
      rj42: {
        ready: () => !!r42.loaded,
        get: () => JSON.parse(r42.serialize()),
        set(d) {
          r42.stop();
          r42.st = r42.deserialize(d);
          if (r42.tape) r42.tape.setDrive(r42.st.tape);
          $$(".knob", r42.el.root).forEach(k => k.rjDraw && k.rjDraw());
          r42.renderAll(); r42.saveNow();
        },
        empty: () => !r42.st || !r42.st.slots.some(Boolean),
        info: () => { const n = r42.st.slots.filter(Boolean).length; return n + (n === 1 ? " loop" : " loops"); },
        raw: "rj42",
      },
      // DCX 404 com a face nova: 12 pads x 5 bancos = 60 pads guardados (A1-E12). O disquete leva todos
      // (pads[i], i = banco * 12 + pad), mais layout { pads, banks }. O disquete antigo do Studio (16 pads)
      // abre igual: o pad guardado i vai para o pad guardado i, entao 1-12 viram A1-A12 e 13-16 viram B1-B4
      // (a mesma conversao da pagina solo da face nova, vendor/dcx-404/novo/js/abrir.js: RJ.d4Open.apply).
      dcx404: {
        ready: () => !!d404.loaded,
        get() {
          const D = RJ.D404 || {};
          const state = JSON.parse(d404.serialize());
          // patterns (st.seq, com o Protect em prot): vao no estado, com quantos pads por banco (o mesmo do RJ.d4Open.build)
          if (state.seq && typeof state.seq === "object") state.seq.pads = D.PADS || d404.buf.length;
          return {
            state,
            layout: { pads: D.PADS || d404.buf.length, banks: D.BANKS || 1 },
            pads: d404.buf.map((b, i) => {
              if (!b) return null;
              const ch = []; for (let c = 0; c < Math.min(2, b.numberOfChannels); c++) ch.push(RJ.dsp.floatToB64(b.getChannelData(c)));
              return { name: d404.st.pads[i].name || "", rate: b.sampleRate, ch };
            }),
          };
        },
        set(d) {
          if (!d || !d.state) throw new Error("Nao e um disquete do DCX 404");
          const ctx = eng.ensure();
          if (RJ.d4Open && RJ.d4Open.apply) {
            const r = RJ.d4Open.apply(d404, d, ctx);
            if (r.bad) console.warn("Disquete do DCX 404: " + r.bad + " sample(s) ilegivel(is) ficaram vazios.");
            if (r.extra) console.warn("Disquete do DCX 404: " + r.extra + " pad(s) alem dos " + d404.buf.length + " ficaram de fora.");
            // patterns: o aviso do abrir.js (disquete sem patterns, outra versao, o que ficou de fora); vai na mensagem da barra
            return RJ.d4Open.seqMsg ? RJ.d4Open.seqMsg(r).trim() : "";
          }
          // sem o abrir.js (vendor/dcx-404/novo ausente): a conversao direta, pad guardado i -> i
          d404.stopAll();
          if (d404.abortRecs) d404.abortRecs();
          d404.useState(d.state);
          d404.buf.forEach((_, i) => {
            const x = Array.isArray(d.pads) ? d.pads[i] : null;
            let b = null;
            if (x && x.ch && x.ch.length && x.ch[0]) {
              const chs = x.ch.slice(0, 2).map(c => RJ.dsp.b64ToFloat(c));
              if (chs[0].length) { b = ctx.createBuffer(chs.length, chs[0].length, Number(x.rate) || ctx.sampleRate); chs.forEach((c, k) => b.copyToChannel(c.subarray(0, chs[0].length), k)); }
            }
            d404.setBuffer(i, b, null, false);
            d404.saveSample(i);
          });
          d404.applyAll(); d404.render(); d404.saveNow();
        },
        empty: () => !d404.buf.some(Boolean) && !d404.st.fx[1] && !d404.st.fx[2] && !pats404(),
        info: () => {
          const P = (RJ.D404 && RJ.D404.PADS) || d404.buf.length, B = (RJ.D404 && RJ.D404.BANKS) || 1;
          const banks = new Set();
          let n = 0;
          d404.buf.forEach((b, i) => { if (b) { n++; banks.add("ABCDE"[Math.floor(i / P)]); } });
          const k = pats404(), pt = k ? ", " + k + (k === 1 ? " pattern" : " patterns") : "";
          if (!n) return (k ? "sem pads" : "sem pads, so efeitos") + pt;
          return n + (n === 1 ? " pad com sample" : " pads com sample") + (B > 1 ? " (" + [...banks].join(", ") + ")" : "") + pt;
        },
        raw: "dcx404",
      },
    };
    if (mixer) {
      const M = window.RJ1202;
      A.rj1202 = {
        ready: () => mixer.working,
        // power: a tecla POWER da mesa (sem o campo, disquete de antes dela: ligada; o padrao sem preferencia e desligada)
        get: () => ({ state: JSON.parse(JSON.stringify(mixer.dev.st)), power: mixer.powered }),
        set(d) {
          if (!d || !d.state) throw new Error("Nao e um disquete do RJ-1202");
          mixer.dev.applyState(d.state); mixer.dev.saveNow();
          // disquete de antes da tecla POWER (sem o campo): abre com a mesa LIGADA, como era (o padrao novo, desligada,
          // so vale para a primeira visita sem preferencia); a barra diz isso
          const old = typeof d.power !== "boolean";
          mixer.setPower(old ? true : d.power);
          if (old) return "RJ-1202: disquete de antes da tecla POWER, a mesa abriu ligada.";
        },
        empty: () => mixer.powered && JSON.stringify(M.sanitize(mixer.dev.st)) === JSON.stringify(M.defaultState()),
        info: () => (mixer.powered ? "" : "desligada; ") + mixer.dev.st.ch.map(c => M.SOURCES[M.srcIndex(c.src)].name).join(", ") + (mixer.dev.st.tape > 0.001 ? ", Tape " + mixer.tape100() : ""),
        raw: "rj1202",
      };
    }
    const machine = { rj2000: sp, rj950: s950, rj42: r42, dcx404: d404 };
    if (mixer) machine.rj1202 = mixer.dev;

    // estado de cada disquete: vazio, alterado (mexeu desde o ultimo salvar/carregar) ou salvo
    const saved = { rj2000: false, rj950: false, rj42: false, dcx404: false, rj1202: false };
    let quiet = 0;
    Object.keys(machine).forEach(id => {
      const dev = machine[id], orig = dev.dirty.bind(dev);
      dev.dirty = function () { orig.apply(null, arguments); if (!quiet) { saved[id] = false; updateDot(); } };
    });
    const stateOf = id => { let e = true; try { e = A[id].ready() ? A[id].empty() : true; } catch (x) { /* ainda nao ligou */ } return e ? "vazio" : saved[id] ? "salvo" : "alterado"; };
    function updateDot() { dot.hidden = !DISKS.some(d => stateOf(d.id) === "alterado"); if (cfgEl.classList.contains("open")) refreshDisks(); }
    function refreshDisks() {
      DISKS.forEach(d => {
        const li = $(`[data-disk=${d.id}]`), st = stateOf(d.id);
        li.dataset.state = st; $(".st span", li).textContent = st;
        let info = "-";
        try { if (A[d.id].ready()) info = st === "vazio" ? (d.id === "dcx404" ? "sem pads nem efeitos" : "vazio") : A[d.id].info(); } catch (e) { /* sem info */ }
        $("small", li).textContent = info;
      });
    }
    setInterval(() => { if (studio.on) updateDot(); }, 2000);

    /* ================================================================ arquivos */
    const msg = $("#proj-msg");
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    function pick(accept, fn) {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = accept; inp.hidden = true;
      const done = () => inp.remove();
      inp.addEventListener("change", () => { const f = inp.files[0]; done(); if (f) fn(f); });
      // o usuario fechou o seletor sem escolher: o input nao fica no body (evento "cancel":
      // Chrome 113+, Firefox 91+ e Safari 16.4+; sem ele, o input fica no body, escondido).
      inp.addEventListener("cancel", done);
      document.body.appendChild(inp); inp.click();
    }
    const download = (blob, name) => RJ.dsp.downloadBlob(blob, name);
    const wrap = id => ({ format: "dcx-disk", version: 1, machine: id, name: DISKS.find(d => d.id === id).label, project: projName, saved: new Date().toISOString(), data: A[id].get() });
    function unwrap(id, d) {
      if (d && d.format === "dcx-disk") {
        if (d.machine !== id) throw new Error("Esse disquete e do " + (DISKS.find(x => x.id === d.machine) || { label: d.machine }).label + ", nao do " + DISKS.find(x => x.id === id).label + ".");
        return d.data;
      }
      if (d && d.format === A[id].raw) return d;           // a memoria avulsa do proprio aparelho
      if (id === "dcx404" && d && d.state) return d;
      throw new Error("Esse arquivo nao e um disquete do " + DISKS.find(x => x.id === id).label + ".");
    }
    function applyDisk(id, data) { let r; quiet++; try { r = A[id].set(data); } finally { setTimeout(() => { quiet--; }, 50); } saved[id] = true; return typeof r === "string" ? r : ""; }

    function saveDisk(id) {
      try {
        need(A[id].ready(), DISKS.find(d => d.id === id).label);
        const blob = new Blob([JSON.stringify(wrap(id))], { type: "application/json" });
        download(blob, slug(projName) + "-" + DISKS.find(d => d.id === id).file);
        saved[id] = true; updateDot();
        say("Disquete do " + DISKS.find(d => d.id === id).label + " salvo.");
      } catch (e) { console.warn(e); say(e.message, true); }
    }
    function loadDisk(id) {
      pick(".json,application/json", async f => {
        try {
          need(A[id].ready(), DISKS.find(d => d.id === id).label);
          const data = unwrap(id, JSON.parse(await f.text()));
          if (stateOf(id) === "alterado" && !confirm("Carregar o disquete troca o que esta no " + DISKS.find(d => d.id === id).label + ". Continuar?")) return;
          const note = applyDisk(id, data);
          say("Disquete carregado no " + DISKS.find(d => d.id === id).label + "." + (note ? " " + note : ""));
        } catch (e) { console.warn(e); say(/JSON/.test(e.message) ? "Esse arquivo nao e um disquete." : e.message, true); }
        updateDot();
      });
    }
    $$("[data-disk]").forEach(li => {
      const id = li.dataset.disk;
      $("[data-act=save]", li).addEventListener("click", () => saveDisk(id));
      $("[data-act=load]", li).addEventListener("click", () => loadDisk(id));
    });

    $("[data-ctrl=salvar]").addEventListener("click", () => {
      try {
        DISKS.forEach(d => need(A[d.id].ready(), d.label));
        const files = [], index = { format: "dcx-studio-project", version: 1, name: projName, tape: mixerOn ? mixer.tape100() : cfg.tape, mixerPower: mixer ? mixer.powered : undefined, barTape: cfg.tape, saved: new Date().toISOString(), disks: [] };
        DISKS.forEach(d => { files.push({ name: d.file, data: JSON.stringify(wrap(d.id)) }); index.disks.push({ machine: d.id, label: d.label, file: d.file, summary: A[d.id].empty() ? "vazio" : A[d.id].info() }); });
        files.unshift({ name: "projeto.json", data: JSON.stringify(index, null, 1) });
        download(RJ.zip.make(files), slug(projName) + ".zip");
        DISKS.forEach(d => { saved[d.id] = true; });
        updateDot();
        say("Projeto \"" + projName + "\" salvo: " + NUM[DISKS.length] + " disquetes e o indice.");
      } catch (e) { console.warn(e); say(e.message, true); }
    });
    $("[data-ctrl=carregar]").addEventListener("click", () => pick(".zip,application/zip", async f => {
      try {
        DISKS.forEach(d => need(A[d.id].ready(), d.label));
        const entries = await RJ.zip.read(await f.arrayBuffer());
        const byName = {}; entries.forEach(e => { byName[e.name] = e.data; });
        const dec = new TextDecoder();
        if (!byName["projeto.json"]) throw new Error("Esse .zip nao e um projeto do Studio (falta o projeto.json).");
        const index = JSON.parse(dec.decode(byName["projeto.json"]));
        if (!index || index.format !== "dcx-studio-project") throw new Error("Esse .zip nao e um projeto do Studio.");
        const jobs = [], skipped = [];
        for (const e of index.disks || []) {
          const d = DISKS.find(x => x.id === e.machine);
          if (!d) continue;
          if (!byName[e.file]) { skipped.push(d.label); continue; }
          jobs.push([d, unwrap(d.id, JSON.parse(dec.decode(byName[e.file])))]);
        }
        if (!jobs.length) throw new Error("O projeto nao tem nenhum disquete.");
        if (DISKS.some(d => stateOf(d.id) === "alterado") && !confirm("Carregar o projeto troca o estado das maquinas. Continuar?")) return;
        const notes = jobs.map(([d, data]) => applyDisk(d.id, data)).filter(Boolean);
        if (index.barTape != null) { cfg.tape = clamp(Math.round(+index.barTape || 0), 0, 100); syncUI(); applyAudio(); saveCfg(); }
        else if (index.tape != null) {
          // com o mixer, o Tape do projeto so vale para zip de antes do mixer (sem o disquete do RJ-1202): vai para o Tape do master do mixer
          // (zip com o disquete do RJ-1202 e sem barTape: o tape dele e o da mesa, que ja veio no disquete; nao vai para a
          // barra, mesmo que a mesa ainda esteja trocando de estado agora - o mixerOn so muda depois do duck)
          if (mixer && jobs.some(j => j[0].id === "rj1202")) { /* nada */ }
          else if (mixerOn) mixer.legacyTape(index.tape);
          else { cfg.tape = clamp(Math.round(+index.tape || 0), 0, 100); syncUI(); applyAudio(); saveCfg(); }
        }
        if (index.name) setProjName(index.name);
        say("Projeto \"" + projName + "\" carregado: " + jobs.map(j => j[0].label).join(", ") + "." + (skipped.length ? " Faltou: " + skipped.join(", ") + "." : "") + (notes.length ? " " + notes.join(" ") : ""), !!skipped.length);
      } catch (e) { console.warn(e); say(e instanceof SyntaxError ? "O projeto esta danificado." : e.message, true); }
      updateDot();
    }));

    // para o teste e para quem quiser usar de fora
    RJ.studioProject = { adapters: A, state: stateOf, setName: n => setProjName(n), master: () => master, duck, tape: () => tape, setTape: v => { cfg.tape = clamp(Math.round(+v || 0), 0, 100); syncUI(); applyAudio(); saveCfg(); }, saveDisk, loadDisk };
    Promise.all([loaded, projReady]).then(() => { syncUI(); updateDot(); });
    refreshDisks();
    // o mapa dos controles da barra e do painel para o MIDI Learn nao existe: ficam de fora dele
  };
})();
