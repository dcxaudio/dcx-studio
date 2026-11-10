/* DCX Studio - teste repetivel: a tecla POWER do RJ-1202 (liga/desliga a mesa)
 *
 * RJ.testPower1202(win) roda dentro da pagina do Studio (win = window do index.html). Mede o pico (dBFS) no master
 * (o ponto que o VU da barra le: depois do ganho master) e na ENTRADA do DCX 404, com a mesa LIGADA e DESLIGADA:
 *   - RJ-2000 A1 (banco num canal da mesa) e RJ-950 no master, Source do 404 em Off;
 *   - Source do 404 = RJ-2000 (A1) e = RJ-950: a entrada do 404 tem que ouvir a maquina nos dois estados;
 *   - desligada: nenhum canal com rota, nem RJ-42 no directIn, e o master fica ~ igual ao da mesa ligada (+-6 dB);
 *   - liga/desliga 6 vezes com um tom tocando: sem estalo (salto entre amostras < 0,02) e, no fim, as rotas de
 *     volta iguais (rjDry de cada saida do host) e nada preso (master < -80 dBFS depois de parar o som);
 *   - Line num canal com a mesa desligada nao abre o microfone; ao ligar, abre (getUserMedia de mentira);
 *   - o disquete do RJ-1202 leva { power } e volta; a preferencia do navegador acompanha; disquete antigo (sem power)
 *     abre com a mesa LIGADA;
 *   - primeira visita (sem preferencia salva): a mesa abre DESLIGADA (opts.boot = o que a pagina viu ao montar, com a
 *     chave dcx-studio/rj1202-power apagada antes de abrir o Studio; tests/power-1202.html faz isso e devolve a chave).
 * O som nao vai para a caixa (setSinkId none). No fim tudo volta como estava (mesa no estado de antes).
 *
 * Devolve { ok, rows: [{ name, value, ok }] }.
 */
(function (g) {
  "use strict";
  const FLOOR = -60;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const db = a => (a > 0 ? 20 * Math.log10(a) : -Infinity);
  const f1 = v => (v === -Infinity ? "-inf" : v.toFixed(1));

  g.testPower1202 = async function (win, opts) {
    opts = opts || {};
    const RJ = win.RJ, studio = RJ.studio, d = RJ.d404, sp = RJ.app, mx = RJ.mixer;
    if (!mx) return { ok: false, rows: [{ name: "sem RJ-1202 no Studio", value: "", ok: false }] };
    const fresh = !studio.on;
    if (!studio.on) studio.power();
    for (let i = 0; i < 60 && !(d.on && d.g && mx.working && RJ.studioProject); i++) await wait(100);
    // o RJ-2000 abre o autosave ~2 s depois do power (useProject troca os sons): so depois disso o pad de teste vale
    await wait(fresh ? 2800 : 800);
    const ctx = studio.engine.ctx;
    if (ctx.state !== "running") await ctx.resume();
    const dev = mx.dev, keepPower = mx.powered, keepSrc = d.src, keepCh5 = dev.st.ch[4].src;

    const sinkKeep = ctx.sinkId;
    let muted = false;
    if (ctx.setSinkId) { try { await ctx.setSinkId({ type: "none" }); muted = true; } catch (e) { console.warn("teste: setSinkId none falhou", e); } }
    const zero = ctx.createGain(); zero.gain.value = 0; zero.connect(ctx.destination);
    const master = RJ.studioProject.master();
    // anJ: janela longa (~0,7 s) para achar estalo; anM: janela curta (~85 ms) para o nivel, sem pegar o som anterior
    const anJ = ctx.createAnalyser(); anJ.fftSize = 32768; anJ.connect(zero); master.connect(anJ);
    const anM = ctx.createAnalyser(); anM.fftSize = 4096; anM.connect(zero); master.connect(anM);
    const anIn = ctx.createAnalyser(); anIn.fftSize = 8192; anIn.connect(zero);
    let inNode = d.g.inLevel; inNode.connect(anIn);
    const relink = () => { if (inNode !== d.g.inLevel) { inNode = d.g.inLevel; inNode.connect(anIn); } };

    // pico e maior salto entre amostras seguidas, lendo o analisador a cada 30 ms (janela de ~0,7 s: cobre tudo)
    const measure = async (an, ms) => {
      const buf = new Float32Array(an.fftSize);
      let m = 0, jump = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        an.getFloatTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > m) m = a; if (i) { const j = Math.abs(buf[i] - buf[i - 1]); if (j > jump) jump = j; } }
        await wait(30);
      }
      return { peak: m, db: db(m), jump };
    };

    // pad de teste no A1 (som 0): seno 220 Hz a -20 dBFS; dur em segundos
    const snd0 = () => sp.p.sounds[0];
    const grab = () => ({ snd: snd0(), pcm: snd0().pcm, start: snd0().start, end: snd0().end, loop: snd0().loop, ver: snd0().ver, mode: snd0().mode });
    let keep0 = grab();
    const hitA1 = dur => {
      if (keep0.snd !== snd0()) keep0 = grab();      // o projeto foi trocado: guarda o som de agora
      const N = Math.round(RJ.RATE * dur), pcm = new Float32Array(N);
      for (let i = 0; i < N; i++) pcm[i] = 0.1 * Math.sin(2 * Math.PI * 220 * i / RJ.RATE) * Math.min(1, i / 2000, (N - i) / 2000);
      Object.assign(snd0(), { pcm, start: 0, end: N, loop: null, mode: "normal", ver: (keep0.ver || 0) + 2000 + (++hits) });
      sp.engine.trigger(0);
    };
    let hits = 0;
    const tone950 = dur => {
      const o = ctx.createOscillator(), a = ctx.createGain(), t = ctx.currentTime;
      o.frequency.value = 330; a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.1, t + 0.04);
      a.gain.setValueAtTime(0.1, t + dur - 0.04); a.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(a).connect(studio.output("rj950"));
      o.start(); o.stop(t + dur + 0.05);
      return o;
    };
    const setSrc = async want => {
      if (d.src === "line") { d.src = "off"; d.applyInput(); }
      for (let i = 0; i < 6 && d.src !== want; i++) {
        const list = ["off"].concat(d.sources());
        if (list[(list.indexOf(d.src) + 1) % list.length] === "line") { d.src = "off"; d.applyInput(); continue; }
        await d.nextSource();
      }
      relink();
    };
    const dryOf = () => { const o = {}; studio.outs.forEach((n, k) => { o[k] = n.rjDry; }); return JSON.stringify(o); };

    const rows = [];
    const row = (name, value, ok) => rows.push({ name, value, ok: !!ok });

    // uma rodada de medidas no estado atual da mesa (tons curtos: 0,4 s cada)
    async function round(tag) {
      const r = {};
      await setSrc("off"); await wait(120);
      hitA1(0.4); r.a1 = (await measure(anM, 350)).db; await wait(150);
      tone950(0.4); r.s950 = (await measure(anM, 350)).db; await wait(150);
      await setSrc("rj2000"); await wait(120);
      hitA1(0.4); r.inRj = (await measure(anIn, 350)).db; await wait(150);
      await setSrc("rj950"); await wait(120);
      tone950(0.4); r.in950 = (await measure(anIn, 350)).db; await wait(150);
      await setSrc("off");
      row(tag + ": RJ-2000 A1 no master (dBFS)", f1(r.a1), r.a1 >= FLOOR);
      row(tag + ": RJ-950 no master (dBFS)", f1(r.s950), r.s950 >= FLOOR);
      row(tag + ": entrada do 404, Source = RJ-2000 (dBFS)", f1(r.inRj), r.inRj >= FLOOR);
      row(tag + ": entrada do 404, Source = RJ-950 (dBFS)", f1(r.in950), r.in950 >= FLOOR);
      return r;
    }

    // getUserMedia de mentira (um MediaStream mudo do proprio contexto) para contar quem abre o microfone
    const md = win.navigator.mediaDevices, gumKeep = md && md.getUserMedia;
    let gumCalls = 0;
    if (md) md.getUserMedia = async () => { gumCalls++; return ctx.createMediaStreamDestination().stream; };

    try {
      // primeira visita: o Studio abriu sem a preferencia salva -> mesa desligada, sem rota, Source do 404 direto
      if (opts.boot) {
        row("Primeira visita (sem preferencia): mesa desligada", String(opts.boot.powered) + " (chave " + String(opts.boot.pref) + ")", opts.boot.pref === null && opts.boot.powered === false);
        const r0 = dev.unroute.filter(Boolean).length;
        row("Primeira visita: canais com rota (ligou o Studio)", r0, !keepPower && r0 === 0);
        row("Primeira visita: mixer.has(rj2000a)", String(mx.has("rj2000a")), !keepPower && !mx.has("rj2000a"));
      }
      await mx.setPower(true); await wait(200);
      // no quadro do teste o primeiro A1 depois do boot as vezes nao chega ao master ate o grafo do RJ-2000 ser religado
      // uma vez (na pagina do Studio aberta direto ele soa no primeiro toque); passar a Source por RJ-2000 e Off religa
      await setSrc("rj2000"); await wait(80); await setSrc("off"); await wait(80);
      const dry0 = dryOf();

      // desligada primeiro, depois ligada de novo (a volta da mesa e o caminho que a tecla usa)
      await mx.setPower(false); await wait(200);
      const routed = dev.unroute.filter(Boolean).length;
      row("Desligada: canais com rota", routed, routed === 0);
      row("Desligada: mixer.has(rj2000a) e Source sem mesa", String(mx.has("rj2000a")), !mx.has("rj2000a"));
      row("Desligada: preferencia salva", win.localStorage.getItem("dcx-studio/rj1202-power"), win.localStorage.getItem("dcx-studio/rj1202-power") === "0");
      const off = await round("Desligada");
      await mx.setPower(true); await wait(200);
      row("Ligada: canais com rota", dev.unroute.filter(Boolean).length, dev.unroute.filter(Boolean).length === 5);
      const on = await round("Ligada");
      const diff = Math.abs(off.a1 - on.a1);
      row("Desligada x ligada: RJ-2000 A1 no master (diferenca dB)", diff.toFixed(1), diff <= 6);

      // disquete: leva e devolve o power
      await mx.setPower(false);
      const disk = RJ.studioProject.adapters.rj1202.get();
      row("Disquete com a mesa desligada: power", String(disk.power), disk.power === false);
      RJ.studioProject.adapters.rj1202.set(Object.assign({}, disk, { power: true })); await wait(150);
      row("Disquete com power true liga a mesa", String(mx.powered), mx.powered === true && dev.unroute.filter(Boolean).length === 5);
      RJ.studioProject.adapters.rj1202.set(disk); await wait(150);
      row("Disquete com power false desliga a mesa", String(mx.powered), mx.powered === false && dev.unroute.filter(Boolean).length === 0);
      // projeto/disquete de antes da tecla POWER (sem o campo): abre com a mesa LIGADA, como era, e a barra diz isso
      const oldDisk = { state: disk.state };
      const note = RJ.studioProject.adapters.rj1202.set(oldDisk); await wait(150);
      row("Projeto antigo sem power: mesa ligada", String(mx.powered) + (note ? " (" + note + ")" : ""), mx.powered === true && dev.unroute.filter(Boolean).length === 5 && !!note);
      await mx.setPower(false); await wait(150);

      // microfone: Line no canal 5 com a mesa desligada nao abre; ao ligar, abre
      gumCalls = 0;
      dev.setSource(4, "line"); await wait(150);
      row("Desligada: Line escolhido nao abre o microfone (pedidos)", gumCalls, gumCalls === 0);
      await mx.setPower(true); await wait(250);
      row("Ligada: Line escolhido abre o microfone (pedidos)", gumCalls, gumCalls === 1);
      await mx.setPower(false); await wait(150);
      dev.setSource(4, keepCh5, true); await wait(100);

      // liga/desliga 6 vezes com som (1,6 s): sem estalo, nada preso, rotas de volta
      await mx.setPower(true); await wait(150);
      const o = tone950(1.6); hitA1(1.6);
      const meas = measure(anJ, 1500);
      for (let i = 0; i < 6; i++) { await wait(170); mx.setPower(!mx.powered); }
      await wait(150); await mx.setPower(true);
      const tog = await meas;
      row("Liga/desliga 6x tocando: maior salto entre amostras (< 0,02)", tog.jump.toFixed(4), tog.jump < 0.02);
      await wait(300);
      try { o.stop(); } catch (e) { /* ja parou */ }
      await wait(200);
      const tail = await measure(anM, 300);
      row("Depois de parar: nada preso no master (dBFS < -80)", f1(tail.db), tail.db < -80);
      const dry1 = dryOf();
      row("Rotas de volta iguais (rjDry das saidas)", dry1 === dry0 ? "iguais" : dry0 + " -> " + dry1, dry1 === dry0);
      return { ok: rows.every(r => r.ok), rows, muted };
    } finally {
      if (md) md.getUserMedia = gumKeep;
      if (dev.st.ch[4].src !== keepCh5) dev.setSource(4, keepCh5, true);
      Object.assign(keep0.snd, { pcm: keep0.pcm, start: keep0.start, end: keep0.end, loop: keep0.loop, ver: keep0.ver, mode: keep0.mode });
      await mx.setPower(keepPower);
      d.src = keepSrc; d.applyInput();
      try { inNode.disconnect(anIn); } catch (e) { /* ja solto */ }
      try { master.disconnect(anM); master.disconnect(anJ); } catch (e) { /* ja solto */ }
      zero.disconnect();
      // PARAR: nada tocando e o AudioContext suspenso (a aba de teste nao soa depois)
      try { sp.seq.playing && sp.seq.stop(); } catch (e) { /* parado */ }
      try { d.stopAll && d.stopAll(); } catch (e) { /* parado */ }
      if (muted) { try { await ctx.setSinkId(sinkKeep); } catch (e) { console.warn("teste: a saida nao voltou", e); } }
      try { await ctx.suspend(); } catch (e) { /* ja suspenso */ }
    }
  };
})(window.RJ = window.RJ || {});
