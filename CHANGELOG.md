# Changelog

## Próxima

- **Layout v2 (desktop), branch `layout-v2`:** a grade do rack em duas colunas, do mockup aprovado (`dcx-design/studio-layout/mockup.html`): coluna 1 = RJ-2000, RJ-950 e RJ-42 na mesma escala; coluna 2 = DCX 404 e, embaixo, o RJ-1202. A escala segue a largura da janela (1920: tudo a 1 e o mixer com os 5 canais; 1440: 0,79 / 0,94; 1364: o mockup, 0,75 / 0,88; 1100: 0,6 / 0,71; abaixo de 1100 empilha numa coluna). O mixer em coluna estreita mostra paginas A (canais 1-3) e B (4-5), Aux e Main sempre. Novos: `js/layout2.js`, `css/layout2.css`; o `js/layout.js` antigo fica no repositorio mas nao e carregado.
- **DCX 404 com a face nova** (`vendor/dcx-404` em `bca8299`, main): 12 pads x 5 bancos (A-E), teclas do Figma, efeitos da onda 3. O miolo da face vem de `vendor/dcx-404/novo/index.html` (`js/face404.js`), entao a face do Studio e sempre a do dcx-404. O sequenciador ainda nao entra. Disquete e projeto: 60 pads (A1-E12) com `layout { pads, banks }`; disquetes antigos (16 pads) abrem com 1-12 em A1-A12 e 13-16 em B1-B4 (`vendor/dcx-404/novo/js/abrir.js`). Pads do controlador (`js/select.js`): notas 36-47 = pads do banco, 48 Hold, 49 Sub Pad, 50/51 banco anterior/proximo.

- **Corrigido:** o VU da barra mexia sozinho, com tudo parado. O canal 5 do RJ-1202 vem com a fonte Line e, se o navegador já tinha a permissão do microfone, o Studio abria o microfone ao ligar, e o ruído da sala entrava no master. Agora o microfone só abre quando você escolhe Line na fonte de um canal (`js/rj1202-studio.js`); um projeto carregado ou o padrão do canal 5 não abrem o microfone sozinhos.

- **RJ-1202, o mixer, no Studio** (`js/rj1202-studio.js`, `vendor/rj-1202`): uma faixa nova logo acima da barra de baixo, com 5 canais, EQ, Aux, retornos e Tape no master. Cada canal escolhe a fonte de verdade: RJ-2000 inteiro, banco A, B, C ou D (saídas novas do RJ-2000), RJ-950, DCX 404 ou Line (o microfone só abre quando você escolhe Line; um projeto carregado só abre se o navegador já tinha a permissão). Fonte num canal sai do caminho direto, trocar a fonte desfaz a rota antiga, e o RJ-42 entra direto no master do mixer. Sem a pasta `vendor/rj-1202` o Studio abre como antes, sem o mixer (e o navegador mostra 404 nos arquivos dele).
- **404 e mixer:** o Aux 1 do mixer entra no 404 e a saída dele volta pelo Return 1; com o 404 como fonte de um canal, o Aux 1 daquele canal fica em zero. A Source do 404 (off, RJ-2000, RJ-950, Mix, Line) continua igual, só que o RJ-2000 inteiro e o RJ-950 que já estão num canal não entram no 404 pela Source (chegam pelo Aux 1), para não tocar em dobro. O visual do 404 não mudou.
- **Tape:** quando o mixer liga, o slider TAPE da barra sai e o Tape é o do master do mixer. O valor antigo da barra (e o `tape` de um projeto .zip de antes do mixer) passa para o Tape do mixer; o `studio/bar` e o `projeto.json` continuam abrindo sem erro.
- **Projeto:** o .zip ganha o disquete do RJ-1202 (`rj-1202.json`, estado do mixer e fontes), cinco disquetes no total; zips antigos continuam abrindo e o mixer fica como está.
- **Máquina selecionada:** o RJ-1202 pode ser selecionado (contorno âmbar) sem tirar os pads do controlador do RJ-2000 ou do 404 e sem tomar teclas das outras máquinas (`js/select.js`). MIDI Learn: os controles do mixer têm o prefixo `m12:`, e o botão Learn do painel abre o mesmo Learn do SET-UP 22 do RJ-2000.

- **Shift do teclado = Shift do 404:** com o DCX 404 selecionado (contorno âmbar) e o foco fora de campos de texto, segurar Shift no teclado liga o Shift do 404 (o botão acende), e soltar desliga; por exemplo Shift + clique em Reverse liga o LO-FI do pad. Trocar de máquina, perder o foco da janela ou soltar a tecla desliga, então o Shift nunca fica preso. Com o RJ-2000 selecionado nada muda. O clique no botão Shift do 404 segue como trava (liga/desliga). Mudou no repositório do dcx-404: `setShiftKey()` em `js/dcx404.js` (acende o botão e vale na página de envios), `js/solo.js` usa ele (`js/select.js` no Studio).

- Submódulos: dcx-core **v1.1.0** (agora com o `RJ.Tape`) e RJ-42 `00ff6fe`. O Studio carrega `RJ.Tape` de `vendor/dcx-core/js/tape.js`, para a fita do RJ-42 e a do master usarem a mesma cópia.

- **Pads do MIDI na máquina selecionada:** os 16 pads do controlador (canal 10, notas 36-51) tocam só na máquina selecionada: RJ-2000 (pads 1-16) ou DCX 404 (pads 1-16). Selecionada é a última clicada ou focada (padrão: RJ-2000), marcada com um contorno âmbar. O MIDI Learn continua valendo primeiro e o mapa padrão não desliga (`js/select.js`, `css/studio.css`). Nada mudou nos repositórios das máquinas.

- **Corrigido:** digitar o nome do projeto (ou qualquer campo de texto) disparava notas e controles das máquinas. Com o foco num campo de texto, os atalhos de teclado de todas as máquinas ficam desligados e voltam ao sair do campo (`js/keyguard.js`). Nada mudou nos repositórios das máquinas.

- **Barra inferior** fixa (logo, nome do projeto, VU do master, engrenagem) e **painel de config**: Audio (volume master, limitador, entrada e saida de audio, atalhos do MIDI geral: ligar, MIDI Learn, salvar/carregar/limpar o mapa, que continua o mesmo) e Projeto.
- **Salvar e carregar projeto:** um `.zip` com um disquete JSON por aparelho (RJ-2000, RJ-950, RJ-42 e DCX 404, com os samples) e o `projeto.json`; cada aparelho tambem salva e carrega o proprio disquete. Novos: `js/bar.js`, `js/zip.js`, `css/bar.css`, `img/dcx-studio.svg`. Nenhum submodulo mudou.

- Source do 404 com **RJ-950** e **Mix** (RJ-2000 + RJ-950, com envio de cada um): o som do 950 passa pelos efeitos do 404 e some da saída direta. Submódulo dcx-404 em `2f04be1`.
Submódulos atualizados: RJ-2000 `cd582fc`, RJ-950 `afb50b7`, RJ-42 `74d297d`.

- **RJ-950:** filtro de 6 polos (Butterworth de 6ª ordem) com anti-imaging; o LCD diz "6-POLE".
- **RJ-42:** saturação de fita (`RJ.Tape`, menu TAPE no LCD); padrão 0, som igual ao anterior. O `index.html` agora carrega `vendor/rj-42/js/tape.js`.
- RJ-2000: o repositório dele agora só tem o SP; o Studio continua usando só os js do SP e os css do 950 e do 42 vêm dos repositórios deles.

## b0.1 (beta)

Primeira versão do DCX Studio, com: RJ-2000 b0.3 (`47dde3e`), RJ-950 b0.1 (`0cdf297`), RJ-42 b0.1 (`49d4e9c`), DCX 404 b0.1 (`b0125f2`), dcx-core v1.0.0.

- O rack que morava no `index.html` do rj-2000 agora tem repositório próprio, e cada aparelho é um submódulo em `vendor/`.
- As chaves salvas e a migração da primeira abertura são as mesmas do Studio no rj-2000.
- Novo no rack: o **DCX 404**, ao lado do RJ-2000 no topo. Os dois diminuem juntos para caber na tela sem rolar; em 1100 px ou menos, o 404 fica logo abaixo do RJ-2000. Na Source RJ-2000, o som do SP passa pelos efeitos do 404, sem tocar duplo; em Line ou desligado, volta direto. Enquanto o sequenciador toca, o BPM do 404 segue o do SP. Os pads do 404 tocam por clique e pelo MIDI Learn (SET-UP 22).
