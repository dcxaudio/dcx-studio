/* DCX Studio - a grade desktop: coluna 1 = RJ-2000 com o RJ-950 e o RJ-42 embaixo (todos a 0,75), coluna 2 = DCX 404
 * (583 px, escala 1) com o RJ-1202 embaixo, em paginas A/B de canais (3 + 2). A pagina rola na vertical; so a largura decide.
 * Abaixo de MIN ou em STACK_W ou menos tudo empilha, como antes. Texto antigo deste arquivo, ainda valido para o resto:
 *
 * O RJ-2000 e o DCX 404 lado a lado
 *
 * Mede o tamanho natural dos dois (o SP com a largura que ele teria sozinho, a
 * mesma do rack do 950) e escolhe uma escala para cada um, para caberem juntos
 * na largura e na altura da janela, sem rolar. O SP muda pelo zoom do .case
 * (--sp-scale) e o 404 pelo --scale dele. Se o SP ficasse menor que MIN, os
 * dois empilham, sem escala: o 404 logo abaixo do RJ-2000. Tambem empilham em
 * 1100 px ou menos, onde o SP troca para o layout compacto (mais alto).
 */
(function () {
  "use strict";
  const MIN = 0.6;        // abaixo disso o SP fica pequeno demais: empilha
  const STACK_W = 1100;   // em 1100 px ou menos o SP muda para o layout compacto dele: empilha
  const GAP = 16;         // espaco entre os dois (igual ao css/studio.css)
  const EDGE = 16;        // margem dos lados da janela
  const TOP = 24;         // padding do topo do .unit
  const BAR_H = 48;       // fallback: o --bar-h do css/bar.css
  // espaco reservado para a barra inferior: --bar-h + 8 px de folga + safe-area do aparelho.
  // O mesmo calculo do padding-bottom do body em css/bar.css; lido do CSS para a barra nao
  // mudar de tamanho sem o layout saber (e para o iPhone nao esconder o rack atras da barra).
  function barSpace() {
    const root = getComputedStyle(document.documentElement);
    const h = parseFloat(root.getPropertyValue("--bar-h")) || BAR_H;
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)";
    (document.body || document.documentElement).appendChild(probe);
    const safe = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
    probe.remove();
    return h + 8 + safe;
  }

  const NAT_W = 977;      // largura natural do RJ-2000, 950 e 42 (medida no mockup do layout)
  const SIDE_S = 0.75;    // escala do RJ-2000 (e do 950 e 42 embaixo dele) na grade lado a lado: 977 -> 733 px

  function fit() {
    const top = document.getElementById("studio-top");
    if (!top) return;
    const c1 = document.getElementById("sg-c1"), c2 = document.getElementById("sg-c2");
    const d4 = document.getElementById("d4");
    const d4s = top.querySelector(".d4-scroll");
    const slot = document.getElementById("m12-slot");
    const m12 = slot && slot.querySelector(".m12");

    // volta ao natural para medir (empilhado, escala 1)
    top.classList.remove("side");
    top.style.width = top.style.marginLeft = "";
    ["--sp-scale", "--sp-w", "--sg-gap", "--c2-w"].forEach(v => top.style.removeProperty(v));
    d4s.style.removeProperty("--scale");
    if (m12) { m12.style.removeProperty("--m12-scale"); m12.removeAttribute("data-page"); }

    const vw = document.documentElement.clientWidth;
    const spW = NAT_W;   // largura natural das tres maquinas da coluna 1 (a mesma, para as bordas alinharem)
    const z4 = parseFloat(getComputedStyle(d4).zoom) || 1;
    const d4W = d4.getBoundingClientRect().width / z4;

    // a pagina rola na vertical; so a largura decide: o 404 fica em escala 1 e o resto cede
    const availW = vw - 2 * EDGE - GAP;
    const s = Math.min(SIDE_S, (availW - d4W) / spW);
    if (s < MIN || window.innerWidth <= STACK_W) { top.dataset.layout = "stack"; return; }

    top.classList.add("side");
    top.dataset.layout = "side";
    top.style.setProperty("--sp-w", spW + "px");
    top.style.setProperty("--sp-scale", s.toFixed(4));
    top.style.setProperty("--sg-gap", (GAP / s).toFixed(2) + "px");   // 16 px na tela, dentro da coluna com zoom
    top.style.setProperty("--c2-w", d4W + "px");
    d4s.style.setProperty("--scale", "1");
    if (m12) {   // o RJ-1202 sob o 404: pagina A (3 canais) ou B (2), Aux e Main fixos, escala para caber em d4W
      const page = m12.dataset.pageSel || "A";
      m12.dataset.page = page;
      m12.style.setProperty("--m12-scale", "1");
      const nat = m12.getBoundingClientRect().width / (parseFloat(getComputedStyle(m12).zoom) || 1);
      m12.style.setProperty("--m12-scale", Math.min(1, d4W / nat).toFixed(4));
    }
    // o topo usa a largura da janela, mesmo que o .unit (1240 px) seja mais estreito
    const inner = top.parentElement.clientWidth - parseFloat(getComputedStyle(top.parentElement).paddingLeft) - parseFloat(getComputedStyle(top.parentElement).paddingRight);
    const w = vw - 2 * EDGE;
    top.style.width = w + "px";
    top.style.marginLeft = Math.min(0, (inner - w) / 2) + "px";
    top.dataset.sp = s.toFixed(3);
    top.dataset.d4 = "1";
  }

  let raf = 0;
  const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
  window.addEventListener("resize", later);
  window.addEventListener("DOMContentLoaded", () => { fit(); if (document.fonts) document.fonts.ready.then(fit); });
  window.addEventListener("load", fit);
  window.RJ = window.RJ || {};
  window.RJ.studioLayout = fit;
})();
