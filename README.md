# DCX Studio

Os aparelhos da [DCX Audio](https://github.com/dcxaudio) no mesmo rack, no navegador: o RJ-2000 e o DCX 404 lado a lado no topo, e o RJ-950 e o RJ-42 embaixo. Um manda som para o outro, como num estúdio.

O RJ-2000 e o 404 diminuem juntos para caber na tela sem rolar (`js/layout.js`). Em janelas de 1100 px ou menos, o 404 fica logo abaixo do RJ-2000.

**Abrir:** [dcxaudio.github.io/dcx-studio](https://dcxaudio.github.io/dcx-studio/)

- O **RJ-950** toca junto com os pads e o sequenciador do RJ-2000.
- O **RJ-42** tira loops de uma música e manda para um pad do RJ-2000 ou para o 950.
- O **DCX 404** toca os próprios pads com efeitos. Na Source **RJ-2000**, o som do SP passa pelos efeitos dele. Enquanto o sequenciador toca, o BPM do 404 segue o do SP.
- MIDI: as notas 36 a 67 (em qualquer canal; os pads do Minilab3 mandam no canal 10) e o teclado do computador tocam o RJ-2000. Qualquer controle do rack aprende MIDI no SET-UP 22 do RJ-2000.

O que fica salvo no navegador usa as mesmas chaves do Studio que morava no rj-2000 (`studio/rj2000/autosave`, `studio/rj950/autosave`, `studio/rj42/autosave`, `studio/midimap` e, agora, `studio/dcx404/...`). Como a origem é a mesma (`dcxaudio.github.io`), quem usava o rack no endereço antigo encontra tudo aqui.

## Como é montado

Cada aparelho é um submódulo em `vendor/`, preso numa versão. O `index.html` monta o host e o rack:

| Submódulo | Versão | O que o Studio usa |
|---|---|---|
| [dcx-core](https://github.com/dcxaudio/dcx-core) | v1.0.0 | `js/`, `css/base.css` e `fonts/` |
| [rj-2000](https://github.com/dcxaudio/rj-2000) | `47dde3e` (b0.3) | só o SP: `js/` (sem o `core/` dele) e `css/rj2000.css` |
| [rj-950](https://github.com/dcxaudio/rj-950) | `0cdf297` (b0.1) | `js/s950.js` e `css/rj950.css` |
| [rj-42](https://github.com/dcxaudio/rj-42) | `49d4e9c` (b0.1) | `js/r42.js` e `css/rj42.css` |
| [dcx-404](https://github.com/dcxaudio/dcx-404) | `b0125f2` (b0.1) | `js/fx.js`, `js/dcx404.js` e `css/dcx404.css` |

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
