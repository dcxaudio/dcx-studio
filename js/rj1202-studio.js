/* DCX Studio - o RJ-1202 (mixer) no rack
 *
 * RJ.studioMixer({ studio, sp, s950, r42, d404, onChange }) monta o RJ-1202 no #m12-slot (na grade v2, embaixo do
 * DCX 404; js/layout2.js da a escala e as paginas A/B de canais) e liga as fontes dos canais. Sem vendor/rj-1202
 * (o submodulo ainda nao existe no Studio real) devolve null e o Studio segue como antes, sem mixer.
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
 * do canal fica travado em zero. A Source do 404 (off, RJ-2000, RJ-950, Mix, Line) traz a maquina mesmo quando ela esta
 * num canal do mixer (RJ-2000 inteiro, banco A-D, RJ-950): a saida dela sai do canal e entra no 404 (take()), em linha
 * como sem o mixer. Com a Source em outra coisa, o canal recebe a maquina de novo e o Aux 1 manda para o 404 como antes.
 *
 * POWER (tecla do Studio no canto da mesa, ao lado do LED Power do painel): desligada, o Studio funciona SEM a mesa,
 * como antes dela: nenhum canal pega fonte (cada maquina volta ao master direto), o RJ-42 sai do directIn, o Aux 1 nao
 * vai ao 404 e o 404 nao volta pelo Return 1 (sai direto), os bancos do RJ-2000 voltam ao "inteiro", o microfone fecha
 * e o Main do mixer fica em zero. has() devolve false, entao a Source do 404 pega RJ-2000/RJ-950 direto. O estado dos
 * canais (fontes, aux, faders...) fica guardado e volta igual ao religar. Padrao: DESLIGADA (decisao de Igor: sem
 * preferencia salva no navegador, a primeira visita abre sem a mesa). A troca abaixa o master por
 * ~30 ms (RJ.studioProject.duck, js/bar.js) para nao estalar. Preferencia em localStorage (PWR_KEY); o projeto leva
 * { power } no disquete do RJ-1202 (js/bar.js); disquete de antes da tecla (sem power) abre com a mesa LIGADA.
 *
 * Devolve { dev, working, whenWorking, has(src), sync404(), take(srcs), legacyTape(v), onWorking(fn),
 *           powered, setPower(on) (Promise), onPower(fn) }.
 */
(function () {
  "use strict";
  window.RJ = window.RJ || {};

  const BANK_OUT = { rj2000a: "rj2000-A", rj2000b: "rj2000-B", rj2000c: "rj2000-C", rj2000d: "rj2000-D" };
  const PWR_KEY = "dcx-studio/rj1202-power";
  const SILENT = /[?&]silent\b/.test(location.search);   // o mesmo gancho de teste do vendor/rj-1202
  // padrao DESLIGADA: so liga se a preferencia salva for "1" (sem preferencia ou sem armazenamento: desligada)
  const readPwr = () => { try { return localStorage.getItem(PWR_KEY) === "1"; } catch (e) { return false; } };
  const savePwr = on => { try { localStorage.setItem(PWR_KEY, on ? "1" : "0"); } catch (e) { /* sem armazenamento */ } };

  RJ.studioMixer = function (m) {
    const { studio, sp, d404 } = m;
    const slot = document.getElementById("m12-slot");
    if (!slot || !RJ.RJ1202 || !window.RJ1202 || !RJ.m12Panel) return null;

    let used = new Set();
    let working = false;
    let powered = readPwr();     // o que a tecla POWER mostra (e o que fica salvo)
    let live = powered;          // o que o grafo faz agora (segue powered depois do duck)
    const pwrFns = [];
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
    // mesa desligada: o canal nao pega a fonte (a maquina fica no master direto); o estado do canal fica guardado
    const routeCh = dev.routeChannel.bind(dev);
    dev.routeChannel = function (ch) {
      if (live) return routeCh(ch);
      if (this.unroute[ch]) { this.unroute[ch](); this.unroute[ch] = null; }
      if (this.ready) this.sourcesChanged();
    };
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

    // tecla POWER: entra ao lado do LED Power que o painel ja tem (.m12-pwr), no mesmo estilo das teclas dele
    const pwrBox = root.querySelector(".m12-pwr");
    const pwrBtn = document.createElement("button");
    pwrBtn.type = "button";
    pwrBtn.className = "r9-btn m12-pwr-key";
    pwrBtn.dataset.ctrl = "m12-power";
    pwrBtn.title = "Liga e desliga a mesa (desligada, as maquinas vao direto ao master)";
    if (pwrBox) { pwrBox.classList.add("m12-pwr-st"); pwrBox.appendChild(pwrBtn); }
    pwrBtn.addEventListener("click", () => setPower(!powered));

    // o Learn do painel abre a mesma pagina do SET-UP 22 do RJ-2000 que o botao MIDI Learn da config
    dev.learnBtn.addEventListener("click", () => {
      if (!studio.on) return;
      if (studio.learn.learning) { sp.exitPage && sp.exitPage(); return; }
      sp.openPage(sp.learnPage(), "setup");
    });

    /* ------------------------------------------------------------ fontes */

    function changed(s) {
      used = s;
      for (let b = 0; b < 4; b++) sp.engine.setBankRouted(b, live && s.has("rj2000" + "abcd"[b]));
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
      const want = live && used.has("line");
      if (!want && mic) { try { mic.stream.getTracks().forEach(t => t.stop()); mic.node.disconnect(); } catch (e) { /* ja fechou */ } mic = null; return; }
      if (!want || mic || micBusy || !working) return;
      micBusy = true;      // antes do await: varias chamadas seguidas (religar a mesa refaz os 5 canais) abrem um microfone so
      try {
        if (!(await micAllowed())) { micBusy = false; return; }
        const ctx = studio.engine.ensure();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        const node = ctx.createMediaStreamSource(stream);
        node.connect(studio.output("line"));
        mic = { stream, node };
        if (!live || !used.has("line")) syncLine();      // mudou de ideia (ou desligou a mesa) enquanto o navegador perguntava
      } catch (e) { console.warn("Line In do RJ-1202 nao abriu", e); dev.show("Err", "Line: a entrada nao abriu"); }
      micBusy = false;
    }

    /* ------------------------------------------------------------ 404 */

    let auxG = null, unret = null, retCtx = null, un42 = null;
    function sync404() {
      if (!working) return;
      const G = live && studio.on && d404.on && d404.g ? d404.g : null;
      // Aux 1 -> 404
      if (auxG && auxG !== G) { try { dev.aux1.disconnect(auxG.inLevel); } catch (e) { /* ja solto */ } auxG = null; }
      if (G && !auxG) { dev.aux1.connect(G.inLevel); auxG = G; }
      // 404 -> Return 1, a menos que um canal use o 404 como fonte (a saida dele ja vai para esse canal)
      const ctx = studio.engine.ctx;
      if (unret && (!live || retCtx !== ctx || used.has("dcx404"))) { unret(); unret = null; }
      if (!unret && G && !used.has("dcx404")) { unret = studio.route("dcx404", dev.ret1In, { dry: false }); retCtx = ctx; }
    }

    /* -------------------------------------------- Source do 404 em linha */

    // Source do 404 = uma maquina que esta num canal (RJ-2000 inteiro, banco A-D, RJ-950): o "cabo" sai do canal e vai
    // para o 404 (em linha, como sem o mixer: a maquina passa pelo 404 e volta pelo Return 1, sem soar duplo).
    // take(lista) recebe os ids do mixer que a Source quer agora; o que saiu da lista volta para o canal.
    // Toda chamada desliga de novo (o mixer refaz as rotas dos canais ao abrir um projeto ou trocar a fonte).
    let taken = new Set();
    const outOf = src => studio.output(BANK_OUT[src] || src);
    function eachCh(src, fn) {
      if (!dev.chIn) return;
      dev.st.ch.forEach((c, i) => { if (c.src === src && dev.chIn[i] && dev.unroute[i]) fn(dev.chIn[i]); });
    }
    function take(list) {
      const want = new Set(working ? list.filter(s => used.has(s)) : []);
      taken.forEach(s => { if (!want.has(s)) { const out = outOf(s); eachCh(s, n => out.connect(n)); } });
      taken = want;
      want.forEach(s => { const out = outOf(s); eachCh(s, n => { try { out.disconnect(n); } catch (e) { /* ja solto */ } }); });
    }

    /* ------------------------------------------------------------ POWER da mesa */

    function paintPwr() {
      pwrBtn.classList.toggle("on", powered);
      pwrBtn.setAttribute("aria-pressed", powered ? "true" : "false");
      pwrBtn.setAttribute("aria-label", "Power do RJ-1202: " + (powered ? "ligada" : "desligada"));
      if (dev.leds && dev.leds.power) dev.leds.power.classList.toggle("on", powered);
      root.classList.toggle("m12-off", !powered);
    }
    const gate = v => { if (dev.mainGate) dev.mainGate.gain.setTargetAtTime(SILENT ? 0 : v, studio.engine.ctx.currentTime, 0.004); };
    // poe o grafo no estado de powered (idempotente: varios cliques seguidos terminam no ultimo)
    function applyPower() {
      if (!dev.chIn || live === powered) { live = powered; return; }
      live = powered;
      if (live) {
        gate(1);
        if (!un42) un42 = studio.route("rj42", dev.directIn, { dry: false });
        dev.st.ch.forEach((_, i) => routeCh(i));
      } else {
        take([]);
        dev.st.ch.forEach((_, i) => { if (dev.unroute[i]) { dev.unroute[i](); dev.unroute[i] = null; } });
        if (un42) { un42(); un42 = null; }
        gate(0);
      }
      if (working) changed(dev.usedSources());
    }
    function setPower(on) {
      on = !!on;
      if (on !== powered) { powered = on; savePwr(on); }
      paintPwr();
      if (!dev.chIn) live = powered;           // ainda nao ligou: o boot ja monta no estado certo
      if (dev.chIn && live !== powered) {
        dev.show(powered ? "On" : "OFF", powered ? "Mesa ligada" : "Mesa desligada: as maquinas vao direto ao master");
        const P = RJ.studioProject;
        const p = P && P.duck ? P.duck(applyPower) : Promise.resolve(applyPower());
        return p.then(() => { pwrFns.forEach(fn => { try { fn(powered); } catch (e) { console.warn(e); } }); });
      }
      pwrFns.forEach(fn => { try { fn(powered); } catch (e) { console.warn(e); } });
      return Promise.resolve();
    }
    paintPwr();

    /* ------------------------------------------------------------ liga */

    const boot = dev.boot.bind(dev);
    let armed = false;
    dev.boot = function () {
      const p = boot();
      if (p && p.then && !armed) {
        armed = true;
        p.then(() => {
          // RJ-42: sem canal, direto no master do mixer
          if (!live) gate(0);
          else if (!un42) un42 = studio.route("rj42", dev.directIn, { dry: false });
          paintPwr();
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
      has: src => working && live && used.has(src),
      get powered() { return powered; },
      setPower,
      onPower(fn) { pwrFns.push(fn); },
      sync404,
      take,
      /** Valor de Tape (0 a 100) de um projeto ou configuracao de antes do mixer: passa para o Tape do master do mixer. */
      legacyTape(v) { dev.setTape(Math.max(0, Math.min(100, +v || 0)) / 100); },
      tape100: () => Math.round(dev.st.tape * 100),
      el: slot,
    };
  };
})();
