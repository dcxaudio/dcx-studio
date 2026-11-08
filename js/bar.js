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
  const DISKS = [
    { id: "rj2000", label: "RJ-2000", file: "rj-2000.json" },
    { id: "rj950", label: "RJ-950", file: "rj-950.json" },
    { id: "rj42", label: "RJ-42", file: "rj-42.json" },
    { id: "dcx404", label: "DCX 404", file: "dcx-404.json" },
  ];
  const slug = s => (String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()) || "projeto";

  RJ.studioBar = function (m) {
    const { studio, sp, s950, r42, d404 } = m;
    const eng = studio.engine;
    const cfgEl = $("#cfg"), cfgBtn = $("#cfg-btn");

    /* ================================================================ configuracao salva */
    const cfg = { master: 100, limiter: true, input: "", output: "" };
    const saveCfg = () => { studio.store.put("bar", JSON.stringify(cfg)); };
    const loaded = studio.store.get("bar").then(v => {
      try { Object.assign(cfg, JSON.parse(v) || {}); } catch (e) { /* sem config salva */ }
      cfg.master = clamp(+cfg.master || 0, 0, 100);
      syncUI(); applyAudio();
    });

    /* ================================================================ painel */
    function panel(open) {
      cfgEl.classList.toggle("open", open);
      cfgBtn.setAttribute("aria-expanded", open);
      if (open) { refreshDevices(); refreshDisks(); refreshMidi(); }
    }
    cfgBtn.addEventListener("click", () => panel(!cfgEl.classList.contains("open")));
    document.addEventListener("keydown", e => { if (e.key === "Escape" && cfgEl.classList.contains("open") && !e.target.closest("input[type=text]")) panel(false); });
    document.addEventListener("pointerdown", e => {
      if (cfgEl.classList.contains("open") && !e.target.closest("#cfg, .sbar")) panel(false);
    });

    /* ================================================================ master, limitador, VU */
    let master = null, anL = null, anR = null;
    const identity = new Float32Array([-1, 1]);
    function buildAudio(ctx) {
      if (master && master.context === ctx) return;
      const lim = eng.limiter;
      lim.rjCurve = lim.rjCurve || lim.curve;
      master = ctx.createGain();
      try { lim.disconnect(); } catch (e) { /* ja solto */ }
      lim.connect(master); master.connect(ctx.destination);
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

    const master$ = $("#cfg-master"), masterO = $("#cfg-master-o"), sw = $("[data-ctrl=limitador]"), limO = $("#cfg-lim-o");
    master$.addEventListener("input", () => { cfg.master = +master$.value; masterO.textContent = cfg.master; applyAudio(); });
    master$.addEventListener("change", saveCfg);
    sw.addEventListener("click", () => { cfg.limiter = !cfg.limiter; syncUI(); applyAudio(); saveCfg(); });
    function syncUI() {
      master$.value = cfg.master; masterO.textContent = cfg.master;
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
    const projReady = studio.store.get("projeto").then(v => { try { const d = JSON.parse(v); if (d && d.name) projName = String(d.name).slice(0, 60); } catch (e) { /* novo */ } nameEl.textContent = projName; });
    const saveName = () => studio.store.put("projeto", JSON.stringify({ name: projName }));
    nameBtn.addEventListener("click", () => {
      if ($("input", nameBtn)) return;
      const inp = document.createElement("input");
      inp.type = "text"; inp.maxLength = 60; inp.value = projName; inp.setAttribute("aria-label", "Nome do projeto");
      nameEl.hidden = true; nameBtn.insertBefore(inp, nameEl.nextSibling); inp.focus(); inp.select();
      const done = ok => {
        if (!inp.parentNode) return;
        const v = inp.value.trim();
        if (ok && v) { projName = v.slice(0, 60); saveName(); }
        inp.remove(); nameEl.hidden = false; nameEl.textContent = projName;
      };
      inp.addEventListener("keydown", e => { if (e.key === "Enter") done(true); else if (e.key === "Escape") { e.stopPropagation(); done(false); } });
      inp.addEventListener("blur", () => done(true));
    });

    /* ================================================================ os quatro aparelhos */
    const need = (cond, what) => { if (!cond) throw new Error(what + " ainda nao ligou: ligue o Studio primeiro."); };
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
      dcx404: {
        ready: () => !!d404.loaded,
        get() {
          return {
            state: JSON.parse(d404.serialize()),
            pads: d404.buf.map((b, i) => {
              if (!b) return null;
              const ch = []; for (let c = 0; c < b.numberOfChannels; c++) ch.push(RJ.dsp.floatToB64(b.getChannelData(c)));
              return { name: d404.st.pads[i].name, rate: b.sampleRate, ch };
            }),
          };
        },
        set(d) {
          if (!d || !d.state) throw new Error("Nao e um disquete do DCX 404");
          const ctx = eng.ensure();
          d404.stopAll();
          d404.useState(d.state);
          d404.buf.forEach((_, i) => {
            const x = d.pads && d.pads[i];
            let b = null;
            if (x && x.ch && x.ch.length && x.ch[0]) {
              const chs = x.ch.map(c => RJ.dsp.b64ToFloat(c));
              if (chs[0].length) { b = ctx.createBuffer(chs.length, chs[0].length, x.rate); chs.forEach((c, k) => b.copyToChannel(c, k)); }
            }
            d404.setBuffer(i, b, null, false);
            d404.saveSample(i);
          });
          d404.applyAll(); d404.render(); d404.saveNow();
        },
        empty: () => !d404.buf.some(Boolean) && !d404.st.fx[1] && !d404.st.fx[2],
        info: () => { const n = d404.buf.filter(Boolean).length; return n ? n + (n === 1 ? " pad com sample" : " pads com sample") : "sem pads, so efeitos"; },
        raw: "dcx404",
      },
    };
    const machine = { rj2000: sp, rj950: s950, rj42: r42, dcx404: d404 };

    // estado de cada disquete: vazio, alterado (mexeu desde o ultimo salvar/carregar) ou salvo
    const saved = { rj2000: false, rj950: false, rj42: false, dcx404: false };
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
      inp.addEventListener("change", () => { const f = inp.files[0]; inp.remove(); if (f) fn(f); });
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
    function applyDisk(id, data) { quiet++; try { A[id].set(data); } finally { setTimeout(() => { quiet--; }, 50); } saved[id] = true; }

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
          applyDisk(id, data);
          say("Disquete carregado no " + DISKS.find(d => d.id === id).label + ".");
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
        const files = [], index = { format: "dcx-studio-project", version: 1, name: projName, saved: new Date().toISOString(), disks: [] };
        DISKS.forEach(d => { files.push({ name: d.file, data: JSON.stringify(wrap(d.id)) }); index.disks.push({ machine: d.id, label: d.label, file: d.file, summary: A[d.id].empty() ? "vazio" : A[d.id].info() }); });
        files.unshift({ name: "projeto.json", data: JSON.stringify(index, null, 1) });
        download(RJ.zip.make(files), slug(projName) + ".zip");
        DISKS.forEach(d => { saved[d.id] = true; });
        updateDot();
        say("Projeto \"" + projName + "\" salvo: 4 disquetes e o indice.");
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
        jobs.forEach(([d, data]) => applyDisk(d.id, data));
        if (index.name) { projName = String(index.name).slice(0, 60); nameEl.textContent = projName; saveName(); }
        say("Projeto \"" + projName + "\" carregado: " + jobs.map(j => j[0].label).join(", ") + "." + (skipped.length ? " Faltou: " + skipped.join(", ") + "." : ""), !!skipped.length);
      } catch (e) { console.warn(e); say(e instanceof SyntaxError ? "O projeto esta danificado." : e.message, true); }
      updateDot();
    }));

    // para o teste e para quem quiser usar de fora
    RJ.studioProject = { adapters: A, state: stateOf, setName: n => { projName = n; nameEl.textContent = n; saveName(); }, master: () => master, saveDisk, loadDisk };
    Promise.all([loaded, projReady]).then(() => { syncUI(); updateDot(); });
    refreshDisks();
    // o mapa dos controles da barra e do painel para o MIDI Learn nao existe: ficam de fora dele
  };
})();
