# DCX Studio

Os aparelhos da [DCX Audio](https://github.com/dcxaudio) no mesmo rack, no navegador: o RJ-2000 e o DCX 404 lado a lado no topo, e o RJ-950 e o RJ-42 embaixo. Um manda som para o outro, como num estúdio.

O RJ-2000 e o 404 diminuem juntos para caber na tela sem rolar (`js/layout.js`). Em janelas de 1100 px ou menos, o 404 fica logo abaixo do RJ-2000.

**Abrir:** [dcxaudio.github.io/dcx-studio](https://dcxaudio.github.io/dcx-studio/)

- O **RJ-950** toca junto com os pads e o sequenciador do RJ-2000.
- O **RJ-42** tira loops de uma música e manda para um pad do RJ-2000 ou para o 950.
- O **DCX 404** toca os próprios pads com efeitos. Na Source **RJ-2000**, o som do SP passa pelos efeitos dele. Enquanto o sequenciador toca, o BPM do 404 segue o do SP.
- MIDI: as notas 36 a 67 (em qualquer canal; os pads do Minilab3 mandam no canal 10) e o teclado do computador tocam o RJ-2000. Qualquer controle do rack aprende MIDI no SET-UP 22 do RJ-2000.

O que fica salvo no navegador usa as mesmas chaves do Studio que morava no rj-2000 (`studio/rj2000/autosave`, `studio/rj950/autosave`, `studio/rj42/autosave`, `studio/midimap` e, agora, `studio/dcx404/...`). Como a origem é a mesma (`dcxaudio.github.io`), quem usava o rack no endereço antigo encontra tudo aqui.

## Barra inferior, config e projeto

Uma barra fixa embaixo (logo, nome do projeto, VU do master e a engrenagem) abre o painel de config:

- **Audio:** volume master (depois do limitador; o VU le o mesmo ponto), limitador ON/OFF, entrada de audio (o dispositivo que a Line do 404 e o sampler abrem), saida de audio (`setSinkId`, quando o navegador tem) e o **MIDI geral**: ligar o MIDI, abrir o MIDI Learn (o mesmo do SET-UP 22 do RJ-2000) e salvar, carregar ou limpar o mapa. O mapa e a chave `studio/midimap` nao mudam. Os ajustes ficam em `studio/bar`.
- **Projeto:** **Salvar projeto** baixa um `.zip` com um disquete JSON por aparelho (`rj-2000.json`, `rj-950.json`, `rj-42.json`, `dcx-404.json`, com os samples) e o `projeto.json`, o indice. **Carregar projeto** devolve o estado de cada aparelho. Cada linha tem **Salvar** e **Carregar** para um aparelho so (um `.json`). O nome do projeto (clique nele na barra) fica em `studio/projeto`. O estado de cada disquete: vazio, alterado (mexeu desde o ultimo salvar ou carregar) ou salvo.

O zip e feito sem biblioteca (`js/zip.js`, modo "store"); ao abrir, le tambem zips comprimidos (deflate) quando o navegador tem `DecompressionStream`. O codigo da barra e `js/bar.js`, o estilo `css/bar.css`.

## Como é montado

Cada aparelho é um submódulo em `vendor/`, preso numa versão. O `index.html` monta o host e o rack:

| Submódulo | Versão | O que o Studio usa |
|---|---|---|
| [dcx-core](https://github.com/dcxaudio/dcx-core) | v1.1.0 | `js/`, `css/base.css` e `fonts/` |
| [rj-2000](https://github.com/dcxaudio/rj-2000) | `dbb98a9` (saídas por banco A-D) | só o SP: `js/` (sem o `core/` dele) e `css/rj2000.css` |
| [rj-950](https://github.com/dcxaudio/rj-950) | `0cdf297` (b0.1) | `js/s950.js` e `css/rj950.css` |
| [rj-42](https://github.com/dcxaudio/rj-42) | `49d4e9c` (b0.1) | `js/r42.js` e `css/rj42.css` |
| [dcx-404](https://github.com/dcxaudio/dcx-404) | `b0125f2` (b0.1) | `js/fx.js`, `js/dcx404.js` e `css/dcx404.css` |
| [rj-1202](https://github.com/dcxaudio/rj-1202) | `ec47ff1` (v0.1) | o mixer: `js/mixer.js`, `js/panel.js`, `js/rj1202.js` e `css/rj1202.css` |

Os submódulos dos aparelhos têm o próprio `vendor/dcx-core`, mas o Studio não precisa dele. Basta o primeiro nível:

```bash
git clone https://github.com/dcxaudio/dcx-studio.git
```

```bash
cd dcx-studio && git submodule update --init
```

```bash
python3 -m http.server 8420
```

Para atualizar um aparelho: `git -C vendor/rj-950 fetch && git -C vendor/rj-950 checkout <versão>`, testar e fazer o commit.

## Licença

GPL-3.0 ([LICENSE](LICENSE)).


---

Projeto independente, sem vínculo com os fabricantes dos equipamentos que inspiraram as máquinas. Os nomes SP-1200, SP-404, S950 e 1202 pertencem a seus donos e aparecem só em texto, como referência.

*Independent project, not affiliated with the makers of the gear that inspired the machines; names belong to their owners and appear as text only, for reference.*
