/* DCX Studio - o RJ-2000 e o DCX 404 lado a lado
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
  const TOP = 24, BOTTOM = 12;

  function fit() {
    const top = document.getElementById("studio-top");
    if (!top) return;
    const sp = top.querySelector(".case"), d4s = top.querySelector(".d4-scroll"), d4 = document.getElementById("d4");
    const rack = document.getElementById("r9");

    // volta ao natural para medir
    top.classList.remove("side");
    top.style.width = top.style.marginLeft = "";
    top.style.removeProperty("--sp-scale");
    sp.style.width = "";
    d4s.style.removeProperty("--scale");

    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const spW = rack ? rack.offsetWidth : sp.offsetWidth, spH = sp.offsetHeight;
    const z4 = parseFloat(getComputedStyle(d4).zoom) || 1;
    const r4 = d4.getBoundingClientRect();
    const d4W = r4.width / z4, d4H = r4.height / z4;

    const availH = vh - TOP - BOTTOM, availW = vw - 2 * EDGE - GAP;
    let s = Math.min(1, availH / spH), s4 = Math.min(1, availH / d4H);
    const need = s * spW + s4 * d4W;
    if (need > availW) { const k = availW / need; s *= k; s4 *= k; }
    if (s < MIN || window.innerWidth <= STACK_W) { top.dataset.layout = "stack"; return; }

    top.classList.add("side");
    top.dataset.layout = "side";
    sp.style.width = spW + "px";
    top.style.setProperty("--sp-scale", s.toFixed(4));
    d4s.style.setProperty("--scale", s4.toFixed(4));
    // o topo usa a largura da janela, mesmo que o .unit (1240 px) seja mais estreito
    const inner = top.parentElement.clientWidth - parseFloat(getComputedStyle(top.parentElement).paddingLeft) - parseFloat(getComputedStyle(top.parentElement).paddingRight);
    const w = vw - 2 * EDGE;
    top.style.width = w + "px";
    top.style.marginLeft = Math.min(0, (inner - w) / 2) + "px";
    top.dataset.sp = s.toFixed(3);
    top.dataset.d4 = s4.toFixed(3);
  }

  let raf = 0;
  const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
  window.addEventListener("resize", later);
  window.addEventListener("DOMContentLoaded", () => { fit(); if (document.fonts) document.fonts.ready.then(fit); });
  window.addEventListener("load", fit);
  window.RJ = window.RJ || {};
  window.RJ.studioLayout = fit;
})();
