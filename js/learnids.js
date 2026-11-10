/* DCX Studio - MIDI Learn: um espaco de ids por maquina
 *
 * O Studio tem um MIDI Learn so (studio.learn, um RJ.MidiMap do dcx-core) para todas as maquinas, e o
 * mapa liga cada mensagem MIDI a um id de controle. Ids iguais em duas maquinas eram o mesmo controle:
 * o REC e o TAP do DCX 404 ("rec", "tap") sobrescreviam o Record/Edit e o Tap/Repeat do RJ-2000.
 *
 * Espacos de ids (estaveis):
 *   RJ-2000   sem prefixo: os ids dele mesmo ("rec", "tap", "pad:0", "fader:0", "key:enter"...), iguais aos
 *             do mapa exportado do RJ-2000 solo (rj2000-midi-learn.json continua abrindo)
 *   DCX 404   "d404:" + o id do 404 ("d404:rec", "d404:tap", "d404:pad-1", "d404:volume", "d404:fx-mfx"...)
 *   RJ-950    "r9..." / RJ-42 "r42..." / RJ-1202 "m12:..." (ja vinham com prefixo; nao mudam)
 *
 * Como (sem mexer no dcx-core nem no 404): o 404 recebe uma vista do learn, RJ.learnSpace(studio.learn, "d404:"),
 * que poe o prefixo no add(). O teclado do 404 (vendor/dcx-404/novo/js/teclado.js, via js/teclado404.js) tambem
 * recebe essa vista: para ele os ids continuam sem prefixo, entao o mapa de teclas (studio/dcx404/keymap) nao muda.
 *
 * Migracao do mapa salvo (studio/midimap) e de um mapa carregado de arquivo: um id antigo sem prefixo que so o
 * 404 tem ("pad-1", "volume", "fx-mfx"...) passa a "d404:"; um id que as duas maquinas tinham ("rec", "tap")
 * guardou uma ligacao so (a outra a colisao ja apagou) e o mapa nao diz de qual botao veio: fica no RJ-2000.
 *
 *   RJ.learnSpace(L, "d404:")              vista do learn para uma maquina
 *   RJ.studioLearnIds.install(L, spaces)   migra ao carregar (load) e ao importar (importData)
 */
(function () {
  "use strict";
  const RJ = (window.RJ = window.RJ || {});

  RJ.learnSpace = function (L, P) {
    const mine = id => typeof id === "string" && id.startsWith(P);
    // id de fora do espaco (de outra maquina): "~" + id, que nenhum controle daqui tem
    const toReal = id => (id == null ? id : String(id).charAt(0) === "~" ? String(id).slice(1) : P + id);
    const toBare = id => (id == null ? id : mine(id) ? id.slice(P.length) : "~" + id);
    const views = new WeakMap();
    const view = t => {
      if (!t || !mine(t.id)) return undefined;
      let v = views.get(t);
      if (!v) { v = Object.create(t, { id: { value: t.id.slice(P.length), enumerable: true } }); views.set(t, v); }
      return v;
    };
    const targets = {
      has: id => !!view(L.targets.get(toReal(id))),
      get: id => view(L.targets.get(toReal(id))),
      forEach(fn) { L.targets.forEach((t, k) => { if (mine(k)) fn(view(t), k.slice(P.length), targets); }); },
      get size() { let n = 0; L.targets.forEach((t, k) => { if (mine(k)) n++; }); return n; },
    };
    const S = {
      space: P, real: L, targets, toReal, toBare,
      add: (id, el, name, kind, h) => L.add(P + id, el, name, kind, h),
      bound: id => L.bound(toReal(id)),
      save: () => L.save(),
      persist: () => L.persist(),
      unbind: id => L.unbind(toReal(id)),
      releaseAll: () => L.releaseAll(),
      exportData: () => L.exportData(),
      importData: d => L.importData(d),
    };
    Object.defineProperty(S, "onChange", { get: () => L.onChange, set: v => { L.onChange = v; } });
    ["learning", "map", "custom", "enabled", "held"].forEach(k => Object.defineProperty(S, k, { get: () => L[k], enumerable: true }));
    Object.defineProperty(S, "store", { get: () => L.store, set: v => { L.store = v; } });
    Object.defineProperty(S, "cand", { get: () => L.cand, set: v => { L.cand = v; } });
    Object.defineProperty(S, "sel", { get: () => toBare(L.sel) });
    // quem embrulha estes metodos (o teclado.js) embrulha os do learn de verdade, com o id traduzido
    ["select", "clear"].forEach(k => Object.defineProperty(S, k, {
      get: () => { const f = L[k]; return id => f.call(L, toReal(id)); },
      set: fn => { L[k] = id => fn(toBare(id)); },
    }));
    ["start", "stop", "capture"].forEach(k => Object.defineProperty(S, k, {
      get: () => { const f = L[k]; return (...a) => f.apply(L, a); },
      set: fn => { L[k] = fn; },
    }));
    return S;
  };

  RJ.studioLearnIds = {
    /** Mapa { chave: { t } } com ids antigos -> ids com prefixo. Devolve quantos mudaram (mexe no proprio mapa). */
    migrate(L, spaces, map) {
      let n = 0;
      Object.keys(map || {}).forEach(k => {
        const b = map[k];
        if (!b || typeof b.t !== "string" || L.targets.has(b.t)) return;   // ja vale (ou e do RJ-2000, ou colisao: RJ-2000)
        const s = spaces.find(p => L.targets.has(p + b.t));
        if (s) { b.t = s + b.t; n++; }
      });
      return n;
    },
    install(L, spaces) {
      if (L.idSpaces) return;
      L.idSpaces = spaces;
      const load0 = L.load.bind(L), import0 = L.importData.bind(L);
      L.load = async () => {
        await load0();
        const n = this.migrate(L, spaces, L.map);
        if (n) { L.persist(); console.info("MIDI Learn: " + n + " controle(s) do 404 passaram para o espaco d404:"); }
      };
      L.importData = d => {
        if (d && d.map && typeof d.map === "object") { d = Object.assign({}, d, { map: JSON.parse(JSON.stringify(d.map)) }); this.migrate(L, spaces, d.map); }
        return import0(d);
      };
    },
  };
})();
