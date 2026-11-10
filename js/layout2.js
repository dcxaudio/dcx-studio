/* DCX Studio - a grade do rack (layout v2, desktop)
 *
 * Duas colunas, como no mockup aprovado (dcx-design/studio-layout/mockup.html), com dois ajustes de Igor (10/11):
 * o 404 10% menor e o RJ-2000 com mais espaco (gabinete de 1150 px de layout, nao 977: a 977 os pads 1-8 encostam).
 *   coluna 1: RJ-2000, RJ-950 e RJ-42, a mesma escala s1 (os tres sao fluidos: a coluna fica com SP_W px de
 *             layout e zoom s1, entao as bordas alinham);
 *   coluna 2: DCX 404 (660 x 988 natural, face nova) a s4 (teto 0,9), e o RJ-1202 embaixo, na largura da coluna.
 * O 404 e reduzido SO por escala uniforme (transform: scale, origem no canto superior esquerdo; nada do layout
 * interno dele muda, como arrastar a quina com a proporcao travada); a caixa .d4-box fica com 660 x 988 vezes s4.
 * A escala vem da largura da janela, continua, com tetos e piso:
 *   - janela larga (>= ~1790 px): s1 = 1 (1150 px) e s4 = 0,9 (594 px); sobrando >= 691 px para a coluna 2,
 *     o mixer mostra os 5 canais (escala >= 0,72) e a coluna 2 alarga ate 960 px (o 404 fica centrado nela);
 *   - 1440 px: s1 = 0,72 (830 px), s4 = 0,85 (562 px), mixer em paginas a 0,73;
 *   - 1100 px: s1 = 0,6 (o minimo legivel do RJ-2000; o gabinete cede ate 1060 px de layout), s4 = 0,6;
 *   - abaixo de 1100 px (STACK_W, onde o RJ-2000 ja troca para o layout compacto dele): uma coluna so,
 *     empilhada, sem layout de celular (Igor desenha esse no Figma).
 * O mixer: 5 canais quando cabe a 0,72 ou mais; senao paginas A (canais 1-3) e B (4-5), Aux e Main
 * sempre visiveis (data-page no .m12; os botoes A/B vem do js/rj1202-studio.js, .m12-pages).
 * Nada aqui mexe nos aparelhos: so zoom/scale (CSS) nos blocos, larguras das colunas e data-* para o CSS.
 * O js/layout.js antigo (RJ-2000 + 404 lado a lado, com as tentativas de celular) nao e carregado
 * nesta pagina e fica intacto no repositorio; quem quiser a grade antiga troca o <script> no index.html.
 * No console: RJ.studioLayout() refaz a grade; #grid traz data-mode, data-s1, data-s4, data-s12, data-pages, data-spw.
 */
(function () {
  "use strict";
  window.RJ = window.RJ || {};
  // Largura de LAYOUT da coluna 1 (o .case do RJ-2000 e os racks do 950 e do 42 sao fluidos). O RJ-2000 precisa de
  // folga: os pads 1-8 (62 px, grade de 8 colunas sem gap) e o transporte so ganham espaco entre si acima de ~1060 px
  // de gabinete (a 977 px, a largura do mockup, os pads encostam em qualquer escala). Padrao 1150 (pads com ~18 px
  // entre si a escala 1); em janela estreita, no piso de escala, cede ate 1060 (~9 px) antes de apertar o 404.
  const SP_W = 1150, SP_W_MIN = 1060;
  const D4_W = 660, D4_H = 988;     // DCX 404, face nova (660 x 988)
  const D4_MAX = 0.9;               // o 404 fica 10% menor que o natural em qualquer largura (pedido de Igor, 10/11)
  const MIX_W = 960;                // RJ-1202 com os 5 canais
  const MIX_PAGE_W = 774;           // RJ-1202 com 3 canais (A: 1-3 ou B: 4-5): 2 canais de 92 px e 2 divisorias a menos
  const GAP = 16, EDGE = 16;        // espaco entre colunas e margem da janela (css/layout2.css)
  const S1_MIN = 0.6;               // abaixo disso o RJ-2000 fica pequeno demais (texto de 9 px -> 5,4 px)
  const RATIO = 1.18;               // s4 = 1,18 x s1 (o mockup: 0,883 / 0,75), ate D4_MAX
  const STACK_W = 1100;             // janela mais estreita que isso: tudo numa coluna
  const MIX_FULL = 0.72;            // os 5 canais do mixer so a partir desta escala; abaixo, paginas
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = v => Math.round(v * 1000) / 1000;

  function fit() {
    const grid = document.getElementById("grid");
    if (!grid) return;
    const col1 = grid.querySelector(".col-1"), col2 = grid.querySelector(".col-2");
    const d4 = document.getElementById("d4"), d4box = document.getElementById("d4-box");
    const slot = document.getElementById("m12-slot");
    const m12 = slot && !slot.hidden ? slot.querySelector(".m12") : null;
    // vw: a largura da janela com a barra de rolagem (a mesma das media queries do RJ-2000, que vira compacto em 1100);
    // avail: o que sobra de verdade para a grade (sem a barra de rolagem, quando ela ocupa lugar)
    const vw = window.innerWidth;
    const avail = Math.max(280, document.documentElement.clientWidth - 2 * EDGE);

    let mode, s1, w1, s4, w2, s12, pages, spw = SP_W;
    if (vw < STACK_W) {
      // uma coluna: a coluna 1 e fluida (o CSS compacto do RJ-2000 vale aqui), o 404 e o mixer centrados
      mode = "stack";
      s1 = 1; w1 = avail;
      s4 = Math.min(D4_MAX, avail / D4_W); w2 = avail;
      pages = avail / MIX_W < MIX_FULL;
      s12 = Math.min(1, avail / (pages ? MIX_PAGE_W : MIX_W));
    } else {
      mode = "grid";
      s1 = clamp((avail - GAP) / (spw + D4_W * RATIO), S1_MIN, 1);
      s4 = Math.min(D4_MAX, s1 * RATIO);
      if (s4 === D4_MAX) s1 = clamp((avail - GAP - D4_W * D4_MAX) / spw, S1_MIN, 1);   // o 404 ja esta no teto: o RJ-2000 cresce ate 1
      if (s1 === S1_MIN) {
        // no piso de escala, o gabinete do RJ-2000 cede largura de layout (ate SP_W_MIN) antes de apertar o 404
        spw = clamp(Math.round((avail - GAP - D4_W * RATIO * S1_MIN) / S1_MIN), SP_W_MIN, SP_W);
      }
      w1 = Math.round(spw * s1); s1 = w1 / spw;
      // com barra de rolagem no caminho e tudo no piso, o 404 cede o que falta: nunca rola de lado
      s4 = Math.min(s4, Math.max(0.3, (avail - GAP - w1) / D4_W));
      s4 = r3(s4);
      const d4w = Math.round(D4_W * s4);
      // o que sobra para a coluna 2 (ate 960 px): com >= 691 px o mixer cabe com os 5 canais
      const left = Math.min(MIX_W, Math.max(d4w, avail - w1 - GAP));
      pages = left / MIX_W < MIX_FULL;
      w2 = pages ? d4w : left;
      s12 = Math.min(1, w2 / (pages ? MIX_PAGE_W : MIX_W));
    }
    s4 = r3(s4);

    grid.dataset.mode = mode;
    col1.style.width = mode === "grid" ? spw + "px" : "";
    col1.style.zoom = mode === "grid" ? String(r3(s1)) : "";
    col2.style.width = mode === "grid" ? w2 + "px" : "";
    // o 404: um scale so, com a caixa do tamanho exato (660 x 988 vezes s4), sem vazio nem corte
    if (d4) d4.style.setProperty("--d4-scale", String(s4));
    if (d4box) { d4box.style.width = (D4_W * s4) + "px"; d4box.style.height = (D4_H * s4) + "px"; }
    if (m12) {
      m12.style.setProperty("--m12-scale", String(r3(s12)));
      if (pages) m12.dataset.page = m12.dataset.pageSel === "B" ? "B" : "A";
      else delete m12.dataset.page;
      const pg = m12.querySelector(".m12-pages");
      if (pg) pg.querySelectorAll("button[data-p]").forEach(b => b.classList.toggle("on", b.dataset.p === (m12.dataset.page || "A")));
    }
    grid.dataset.s1 = r3(s1); grid.dataset.s4 = s4; grid.dataset.s12 = m12 ? r3(s12) : ""; grid.dataset.spw = mode === "grid" ? spw : "";
    grid.dataset.pages = m12 ? String(!!pages) : "";
  }

  let raf = 0;
  const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
  window.addEventListener("resize", later);
  window.addEventListener("DOMContentLoaded", () => { fit(); if (document.fonts) document.fonts.ready.then(fit); });
  window.addEventListener("load", fit);
  RJ.studioLayout = fit;
})();
