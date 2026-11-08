# Changelog

## Próxima

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
