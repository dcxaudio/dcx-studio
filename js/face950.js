/* DCX Studio - o painel do RJ-950 vem do submodulo (vendor/rj-950/index.html)
 *
 * O index.html do Studio traz so o <section id="r9" class="rack"> vazio. O miolo (a .r9-face inteira:
 * LCD, botoes de modo, tabelas impressas, teclado, knobs, drive) vem do #r9 da pagina do rj-950, a mesma
 * que o css/rj950.css do submodulo desenha. Assim o Studio nao guarda copia do HTML do 950: mudou o painel
 * no rj-950 (e o submodulo foi atualizado), o Studio mostra o painel novo. O mesmo padrao do js/face404.js.
 * Da pagina sozinha so entra o #r9: o titulo, a barra do Learn, a ajuda "Funcoes de cada modo", a tela
 * LIGAR, o <input id="r9-file"> (o Studio tem o dele) e os scripts ficam de fora.
 *
 * RJ.face950.ready: Promise<boolean>, true quando o painel entrou no #r9. O index.html espera por ela
 * antes de chamar s950.build() (o s950.js acha os controles por id e data-r9*). Se nao carregou (ex.:
 * pagina aberta por file://), o #r9 mostra um aviso e o resto do Studio segue sem o 950.
 * Carregar cedo (junto do face404.js): o fetch comeca antes do DOM estar pronto.
 */
(function () {
  "use strict";
  window.RJ = window.RJ || {};
  const BASE = "vendor/rj-950/";
  const fetched = fetch(BASE + "index.html", { cache: "no-cache" }).then(r => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  });
  const dom = new Promise(res => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => res(), { once: true });
    else res();
  });

  function apply(html) {
    const root = document.getElementById("r9");
    if (!root) throw new Error("o Studio nao tem #r9");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const src = doc.getElementById("r9");
    if (!src) throw new Error("a pagina do rj-950 nao tem #r9");
    if (!src.querySelector(".r9-face")) throw new Error("o #r9 do rj-950 nao tem .r9-face");
    // caminhos relativos ao rj-950 (se um dia o painel tiver <img>) viram relativos ao Studio
    src.querySelectorAll("img[src]").forEach(img => {
      const s = img.getAttribute("src");
      if (s && !/^(https?:|\/|data:|#)/i.test(s)) img.setAttribute("src", BASE + s);
    });
    // so o painel: nada de input de arquivo nem script vindo da pagina sozinha
    src.querySelectorAll("script, #r9-file").forEach(n => n.remove());
    if (src.getAttribute("aria-label")) root.setAttribute("aria-label", src.getAttribute("aria-label"));
    root.innerHTML = src.innerHTML;
    return true;
  }

  RJ.face950 = {
    base: BASE,
    ready: Promise.all([fetched, dom]).then(([html]) => apply(html)).catch(e => {
      console.warn("O painel do RJ-950 nao carregou", e);
      const root = document.getElementById("r9");
      if (root) {
        root.classList.add("dx-missing");
        root.innerHTML = '<p class="dx-missing-msg">O painel do RJ-950 nao carregou (vendor/rj-950). Abra o Studio por um servidor http, com os submodulos iniciados.</p>';
      }
      return false;
    }),
  };
})();
