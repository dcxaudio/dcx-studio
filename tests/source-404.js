/* DCX Studio - teste repetivel: a Source do DCX 404 traz o som das outras maquinas?
 *
 * RJ.testSource404(win) roda dentro da pagina do Studio (win = window do index.html, ja ligado ou nao).
 * Mede o nivel (pico, dBFS) na ENTRADA do 404 (depois do seletor Source e do Input Level, onde a escuta e o
 * REC leem) com uma maquina tocando, para cada Source: RJ-2000 (pad do banco A, que fica num canal do RJ-1202,
 * e pad do banco C, fora do mixer), RJ-950, Mix e Line. Por ultimo grava 0,6 s no REC do 404 com Source = RJ-2000
 * e confere o buffer gravado.
 *
 * O som nao vai para a caixa: durante o teste a saida do AudioContext vai para setSinkId({ type: "none" })
 * (os analisadores seguem medindo). No fim tudo volta como estava, e o pad de teste do RJ-2000 e devolvido.
 *
 * Devolve { ok, rows: [{ name, dbIn, dbMaster, want, ok }], rec: { ok, db, len } }.
 * Falha (ok false) se uma Source que deve trazer a maquina mede < -60 dBFS, ou se a Line (sem microfone) traz alguma.
 */
(function (g) {
  "use strict";
  const FLOOR = -60;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const db = a => (a > 0 ? 20 * Math.log10(a) : -Infinity);

  g.testSource404 = async function (win) {
    const RJ = win.RJ, studio = RJ.studio, d = RJ.d404, sp = RJ.app;
    if (!studio.on) studio.power();
    for (let i = 0; i < 50 && !(d.on && d.g && (!RJ.mixer || RJ.mixer.working)); i++) await wait(100);
    await wait(800);
    const ctx = studio.engine.ctx;
    if (ctx.state !== "running") await ctx.resume();

    // master mudo: a saida do AudioContext vai para "nenhum aparelho" (setSinkId none) e o grafo segue andando.
    // Sem setSinkId, os analisadores ainda medem, mas o som sai (baixo: tom a -20 dBFS)
    const lim = studio.engine.limiter;
    const sinkKeep = ctx.sinkId;
    let muted = false;
    if (ctx.setSinkId) { try { await ctx.setSinkId({ type: "none" }); muted = true; } catch (e) { console.warn("teste: setSinkId none falhou", e); } }
    const zero = ctx.createGain(); zero.gain.value = 0; zero.connect(ctx.destination);
    const anMaster = ctx.createAnalyser(); anMaster.fftSize = 8192; anMaster.connect(zero);
    lim.connect(anMaster);
    const anIn = ctx.createAnalyser(); anIn.fftSize = 8192; anIn.connect(zero);
    let inNode = d.g.inLevel; inNode.connect(anIn);

    const peak = async (an, ms) => {
      const buf = new Float32Array(an.fftSize);
      let m = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        an.getFloatTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > m) m = a; }
        await wait(30);
      }
      return m;
    };

    // o pad de teste: seno 220 Hz, amplitude 0,1 (-20 dBFS), 1,2 s, no A1 (som 0) e no C1 (som 16)
    const N = Math.round(RJ.RATE * 1.2);
    const pcm = new Float32Array(N);
    for (let i = 0; i < N; i++) pcm[i] = 0.1 * Math.sin(2 * Math.PI * 220 * i / RJ.RATE);
    // o projeto do RJ-2000 pode acabar de carregar logo depois do power: o pad de teste e posto de novo a cada toque
    const keep = {};
    [0, 16].forEach(s => { const snd = sp.p.sounds[s]; keep[s] = { snd, pcm: snd.pcm, start: snd.start, end: snd.end, loop: snd.loop, ver: snd.ver, mode: snd.mode }; });
    const hit = s => {
      const snd = sp.p.sounds[s];
      if (!keep[s] || keep[s].snd !== snd) keep[s] = { snd, pcm: snd.pcm, start: snd.start, end: snd.end, loop: snd.loop, ver: snd.ver, mode: snd.mode };
      Object.assign(snd, { pcm, start: 0, end: N, loop: null, mode: "normal", ver: (keep[s].ver || 0) + 1000 });
      sp.engine.trigger(s);
    };
    // o RJ-950 tocando: um seno na saida dele (host.output("rj950"))
    const play950 = () => {
      const o = ctx.createOscillator(), a = ctx.createGain();
      o.frequency.value = 330; a.gain.value = 0.1;
      o.connect(a).connect(studio.output("rj950"));
      o.start(); o.stop(ctx.currentTime + 1.2);
    };

    const srcKeep = d.src;
    const setSrc = async want => {
      // pelo mesmo caminho do botao SOURCE (nextSource), sem passar pela Line (ela abriria o microfone)
      if (want === "line") { d.src = "line"; d.applyInput(); return; }
      if (d.src === "line") { d.src = "off"; d.applyInput(); }
      for (let i = 0; i < 6 && d.src !== want; i++) {
        const list = ["off"].concat(d.sources());
        if (list[(list.indexOf(d.src) + 1) % list.length] === "line") { d.src = "off"; d.applyInput(); continue; }
        await d.nextSource();
      }
    };

    const cases = [
      { name: "RJ-2000 (A1, banco no RJ-1202)", src: "rj2000", play: () => hit(0), want: true },
      { name: "RJ-2000 (C1, banco fora do mixer)", src: "rj2000", play: () => hit(16), want: true },
      { name: "RJ-950", src: "rj950", play: play950, want: true },
      { name: "Mix (RJ-2000 A1)", src: "mix", play: () => hit(0), want: true },
      { name: "Mix (RJ-950)", src: "mix", play: play950, want: true },
      { name: "Line (sem microfone, nao traz as maquinas)", src: "line", play: () => { hit(0); play950(); }, want: false },
      { name: "Off (nao traz as maquinas; o canal do mixer volta a soar)", src: "off", play: () => { hit(0); play950(); }, want: false, master: true },
    ];
    const rows = [];
    try {
      for (const c of cases) {
        await setSrc(c.src);
        if (inNode !== d.g.inLevel) { inNode = d.g.inLevel; inNode.connect(anIn); }
        await wait(250);
        c.play();
        const [aIn, aM] = await Promise.all([peak(anIn, 600), peak(anMaster, 600)]);
        await wait(700);
        const dbIn = db(aIn), dbMaster = db(aM);
        rows.push({ name: c.name, src: d.src, dbIn: +dbIn.toFixed(1), dbMaster: +dbMaster.toFixed(1), want: c.want, ok: (c.want ? dbIn >= FLOOR : dbIn < FLOOR) && (!c.master || dbMaster >= FLOOR) });
      }

      // REC do 404 com Source = RJ-2000: o pad A1 toca enquanto grava; o buffer gravado nao pode ser mudo
      await setSrc("rj2000");
      await wait(200);
      const rec = await recordTo(d, () => hit(0));
      const ok = rows.every(r => r.ok) && rec.ok;
      return { ok, rows, rec, muted };
    } finally {
      d.src = srcKeep; d.applyInput();
      [0, 16].forEach(s => { const k = keep[s]; Object.assign(k.snd, { pcm: k.pcm, start: k.start, end: k.end, loop: k.loop, ver: k.ver, mode: k.mode }); });
      try { inNode.disconnect(anIn); } catch (e) { /* ja solto */ }
      try { lim.disconnect(anMaster); } catch (e) { /* ja solto */ }
      zero.disconnect();
      if (muted) { try { await ctx.setSinkId(sinkKeep); } catch (e) { console.warn("teste: a saida nao voltou", e); } }
    }
  };

  /* REC do 404 pelo mesmo caminho dos botoes: REC (espera), pad vazio (destino), REC (grava), REC (para).
   * O sample gravado e medido e depois apagado (o pad volta a ficar vazio, como estava). */
  async function recordTo(d, play) {
    const out = { ok: false, db: -Infinity, len: 0 };
    const slot = d.emptyPad();
    if (slot < 0) { out.err = "sem pad vazio"; return out; }
    const padKeep = d.st.pads[slot], curKeep = d.st.cur;
    d.recPress();
    if (!d.smp || d.smp.stage !== "arm") { out.err = "REC nao armou (src " + d.src + ")"; return out; }
    d.smpPick(slot);
    d.recPress();
    if (!d.smp || d.smp.stage !== "rec") { out.err = "REC nao comecou"; d.cancelSmp(); return out; }
    await wait(50);
    play();
    await wait(700);
    d.recPress();
    for (let i = 0; i < 40 && !d.buf[slot]; i++) await wait(50);
    const b = d.buf[slot];
    out.slot = slot;
    if (!b) { out.err = "o REC nao gerou sample"; return out; }
    let m = 0;
    for (let c = 0; c < b.numberOfChannels; c++) { const x = b.getChannelData(c); for (let k = 0; k < x.length; k++) { const a = Math.abs(x[k]); if (a > m) m = a; } }
    out.len = b.length; out.db = +db(m).toFixed(1); out.ok = b.length > 0 && db(m) >= FLOOR;
    // apaga o sample de teste
    d.st.pads[slot] = padKeep; d.st.cur = curKeep;
    d.setBuffer(slot, null, null, true);
    d.render();
    return out;
  }
})(window.RJ = window.RJ || {});
