# Changelog

## b0.1 (beta)

Primeira versão do DCX Studio, com: RJ-2000 b0.3 (`47dde3e`), RJ-950 b0.1 (`0cdf297`), RJ-42 b0.1 (`49d4e9c`), DCX 404 b0.1 (`b0125f2`), dcx-core v1.0.0.

- O rack que morava no `index.html` do rj-2000 agora tem repositório próprio, e cada aparelho é um submódulo em `vendor/`.
- As chaves salvas e a migração da primeira abertura são as mesmas do Studio no rj-2000.
- Novo no rack: o **DCX 404**, ao lado do RJ-2000 no topo. Os dois diminuem juntos para caber na tela sem rolar; em 1100 px ou menos, o 404 fica logo abaixo do RJ-2000. Na Source RJ-2000, o som do SP passa pelos efeitos do 404, sem tocar duplo; em Line ou desligado, volta direto. Enquanto o sequenciador toca, o BPM do 404 segue o do SP. Os pads do 404 tocam por clique e pelo MIDI Learn (SET-UP 22).
