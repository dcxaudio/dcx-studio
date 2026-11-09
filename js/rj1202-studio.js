/* DCX Studio - o RJ-1202 (mixer) no rack
 *
 * RJ.studioMixer({ studio, sp, s950, r42, d404, onChange }) monta o RJ-1202 numa faixa nova (#m12-slot, logo
 * acima da barra de baixo) e liga as fontes dos canais. Sem vendor/rj-1202 (o submodulo ainda nao existe no
 * Studio real) devolve null e o Studio segue como antes, sem mixer.
 *
 * Fontes por canal (cada uma sai do caminho direto enquanto estiver num canal; trocar a fonte desfaz a rota antiga):
 *   RJ-2000 inteiro   host.output("rj2000")      (o que nao esta num banco roteado)
 *   banco A a D       host.output("rj2000-A"...) + sp.engine.setBankRouted(b, true) (o banco sai do "inteiro")
 *   RJ-950, DCX 404   host.output("rj950"), host.output("dcx404")
 *   Line              microfone do navegador (so abre quando o usuario escolhe Line, ou se a permissao ja foi dada)
 * RJ-42: sem canal; vai pela entrada direta do mixer (antes do Tape do master, depois dos canais).
 *
 * DCX 404: o Aux 1 do mixer entra no 404 (depois do seletor Source dele, antes do Input Level) e a saida do 404 volta
 * pelo Return 1; quando um canal usa o 404 como fonte, a saida dele vai para esse canal (e nao para o Return 1) e o Aux 1
 * do canal fica travado em zero. A Source do 404 (off, RJ-2000, RJ-950, Mix, Line) continua igual, so que o que ja esta
 * num canal do mixer (RJ-2000 inteiro, RJ-950) nao entra no 404 pela Source: chega pelo Aux 1.
 *
 * Devolve { dev, working, whenWorking, has(src), sync404(), legacyTape(v), onWorking(fn) }.
 */
(function () {
  "use strict";
  window.RJ = window.RJ || {};

  const BANK_OUT = { rj2000a: "rj2000-A", rj2000b: "rj2000-B", rj2000c: "rj2000-C", rj2000d: "rj2000-D" };

  RJ.studioMixer = function (m) {
    const { studio, sp, d404 } = m;
    const slot = document.getElementById("m12-slot");
    if (!slot || !RJ.RJ1202 || !window.RJ1202 || !RJ.m12Panel) return null;

    let used = new Set();
    let working = false;
    const waiters = [];
    let resolveWork;
    const whenWorking = new Promise(r => { resolveWork = r; });

    const dev = new RJ.RJ1202(studio.view("rj1202"), {
      base: "vendor/rj-1202/",
      outputId: id => BANK_OUT[id] || id,
      learnPrefix: "m12:",
      onSources: s => changed(s),
    });
    studio.add("rj1202", dev, { label: "RJ-1202" });
    slot.hidden = false;
    const root = RJ.m12Panel(slot.querySelector("#m12-mount"));
    dev.build(root);

    // paginas de canais (so valem na grade lado a lado; o js/layout.js aplica data-page e a escala)
    const pg = document.createElement("div");
    pg.className = "m12-pages";
    pg.setAttribute("role", "group");
    pg.setAttribute("aria-label", "Paginas de canais do RJ-1202");
    pg.innerHTML = '<button type="button" data-p="A" class="on" title="Canais 1 a 3">A 1-3</button><button type="button" data-p="B" title="Canais 4 e 5">B 4-5</button>';
    pg.addEventListener("click", e => {
      const b = e.target.closest("button[data-p]");
      if (!b) return;
      root.dataset.pageSel = b.dataset.p;
      pg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
      if (RJ.studioLayout) RJ.studioLayout();
    });
    const topbar = root.querySelector(".m12-top");
    if (topbar) topbar.insertBefore(pg, topbar.querySelector(".m12-sp"));
    if (RJ.studioLayout) RJ.studioLayout();

    // o Learn do painel abre a mesma pagina do SET-UP 22 do RJ-2000 que o botao MIDI Learn da config
    dev.learnBtn.addEventListener("click", () => {
      if (!studio.on) return;
      if (studio.learn.learning) { sp.exitPage && sp.exitPage(); return; }
      sp.openPage(sp.learnPage(), "setup");
    });

    /* ------------------------------------------------------------ fontes */

    function changed(s) {
      used = s;
      for (let b = 0; b < 4; b++) sp.engine.setBankRouted(b, s.has("rj2000" + "abcd"[b]));
      syncLine();
      sync404();
      if (m.onChange) m.onChange();
    }

    // o microfone so abre depois que o usuario ESCOLHE Line (clicar na fonte do canal) nesta pagina. O padrao do
    // canal 5 e Line e um projeto carregado pode trazer Line, mas isso NAO abre o microfone sozinho, mesmo com a
    // permissao ja dada: senao o ruido da sala entra no master e o VU da barra mexe sem ninguem tocar.
    let userLine = false;
    const setSource = dev.setSource.bind(dev);
    dev.setSource = function (ch, id, quiet) { if (id === "line" && !quiet) userLine = true; return setSource(ch, id, quiet); };
    let mic = null, micBusy = false;
    async function micAllowed() {
      return userLine;
    }
    async function syncLine() {
      const want = used.has("line");
      if (!want && mic) { try { mic.stream.getTracks().forEach(t => t.stop()); mic.node.disconnect(); } catch (e) { /* ja fechou */ } mic = null; return; }
      if (!want || mic || micBusy || !working || !(await micAllowed())) return;
      micBusy = true;
      try {
        const ctx = studio.engine.ensure();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        const node = ctx.createMediaStreamSource(stream);
        node.connect(studio.output("line"));
        mic = { stream, node };
        if (!used.has("line")) syncLine();      // mudou de ideia enquanto o navegador perguntava
      } catch (e) { console.warn("Line In do RJ-1202 nao abriu", e); dev.show("Err", "Line: a entrada nao abriu"); }
      micBusy = false;
    }

    /* ------------------------------------------------------------ 404 */

    let auxG = null, unret = null, retCtx = null, un42 = null;
    function sync404() {
      if (!working) return;
      const G = studio.on && d404.on && d404.g ? d404.g : null;
      // Aux 1 -> 404
      if (auxG && auxG !== G) { try { dev.aux1.disconnect(auxG.inLevel); } catch (e) { /* ja solto */ } auxG = null; }
      if (G && !auxG) { dev.aux1.connect(G.inLevel); auxG = G; }
      // 404 -> Return 1, a menos que um canal use o 404 como fonte (a saida dele ja vai para esse canal)
      const ctx = studio.engine.ctx;
      if (unret && (retCtx !== ctx || used.has("dcx404"))) { unret(); unret = null; }
      if (!unret && G && !used.has("dcx404")) { unret = studio.route("dcx404", dev.ret1In, { dry: false }); retCtx = ctx; }
    }

    /* ------------------------------------------------------------ liga */

    const boot = dev.boot.bind(dev);
    let armed = false;
    dev.boot = function () {
      const p = boot();
      if (p && p.then && !armed) {
        armed = true;
        p.then(() => {
          // RJ-42: sem canal, direto no master do mixer
          un42 = studio.route("rj42", dev.directIn, { dry: false });
          working = true;
          changed(dev.usedSources());
          waiters.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } });
          resolveWork(true);
        }, e => { console.error("RJ-1202 nao ligou", e); resolveWork(false); });
      }
      return p;
    };
    if (studio.on) dev.boot();

    return {
      dev,
      get working() { return working; },
      whenWorking,
      onWorking(fn) { if (working) fn(); else waiters.push(fn); },
      has: src => working && used.has(src),
      sync404,
      /** Valor de Tape (0 a 100) de um projeto ou configuracao de antes do mixer: passa para o Tape do master do mixer. */
      legacyTape(v) { dev.setTape(Math.max(0, Math.min(100, +v || 0)) / 100); },
      tape100: () => Math.round(dev.st.tape * 100),
      el: slot,
    };
  };
})();
