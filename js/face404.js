/* DCX Studio - a face nova do DCX 404 (vendor/dcx-404/novo/)
 *
 * O index.html do Studio traz so o <section id="d4"> vazio, com data-face="dcx", data-pad-count="12"
 * e data-banks="5" (o js/dcx404.js le esses atributos quando carrega). O miolo da face vem da pagina
 * da face nova (vendor/dcx-404/novo/index.html, o mesmo #d4), com os caminhos dos SVG apontando
 * para o submodulo. Assim a face do Studio e sempre a do dcx-404: um lugar so para desenhar.
 *
 * RJ.face404.ready: Promise<boolean>, true quando a face entrou no #d4. O index.html espera por ela
 * antes de montar o 404 (d404.build). Se nao carregou (ex.: pagina aberta por file://), o #d4 mostra
 * um aviso e o resto do Studio segue.
 * Carregar cedo (logo depois do keyguard.js): o fetch comeca antes do DOM estar pronto.
 */
(function () {
  "use strict";
  window.RJ = window.RJ || {};
  const BASE = "vendor/dcx-404/novo/";
  const fetched = fetch(BASE + "index.html", { cache: "no-cache" }).then(r => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  });
  const dom = new Promise(res => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => res(), { once: true });
    else res();
  });

  function apply(html) {
    const root = document.getElementById("d4");
    if (!root) throw new Error("o Studio nao tem #d4");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const src = doc.getElementById("d4");
    if (!src) throw new Error("a pagina da face nova nao tem #d4");
    // os SVG das pecas: caminhos relativos a novo/ viram relativos ao Studio
    src.querySelectorAll("img[src]").forEach(img => {
      const s = img.getAttribute("src");
      if (s && !/^(https?:|\/|data:)/i.test(s)) img.setAttribute("src", BASE + s);
    });
    // pads e bancos sao os do Studio (o motor ja leu os atributos do placeholder); se a face mudou, avisa
    ["padCount", "banks"].forEach(k => {
      if (src.dataset[k] && root.dataset[k] && src.dataset[k] !== root.dataset[k]) console.warn("face nova do 404: data-" + k + " da face (" + src.dataset[k] + ") difere do Studio (" + root.dataset[k] + ")");
    });
    if (src.dataset.version) root.dataset.version = src.dataset.version;
    if (src.getAttribute("aria-label")) root.setAttribute("aria-label", src.getAttribute("aria-label"));
    root.classList.add("dx");
    root.innerHTML = src.innerHTML;
    return true;
  }

  RJ.face404 = {
    base: BASE,
    ready: Promise.all([fetched, dom]).then(([html]) => apply(html)).catch(e => {
      console.warn("A face nova do DCX 404 nao carregou", e);
      const root = document.getElementById("d4");
      if (root) {
        root.classList.add("dx", "dx-missing");
        root.innerHTML = '<p class="dx-missing-msg">A face do DCX 404 nao carregou (vendor/dcx-404/novo). Abra o Studio por um servidor http, com os submodulos iniciados.</p>';
      }
      return false;
    }),
  };
})();
