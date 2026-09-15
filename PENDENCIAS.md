# Pendências e estado real

Registro do que está resolvido, do que só *parece* resolvido e do que falta.
Atualizado em 2026-09-15, no commit `24f6cad`.

Regra deste arquivo: "verificado" significa **executado e conferido**, não "compila".
Compilar nunca provou nada aqui — todos os defeitos desta sessão passavam no `tsc`.

---

## 1. Estado dos três visuais

| Visual | Pasta | Versão |
|---|---|---|
| Slider Refeição | `Slider/sliderRefeicao` | 1.4.3.0 |
| Seletor de Data | `Slider/seletorData` | 1.3.4.0 |
| Filtro de Hierarquia | `Slider/filtroHierarquia` | 1.2.4.0 |

Nos três: `npx tsc --noEmit` limpo, `npx eslint .` limpo, `npx pbiviz package` gera o `.pbiviz`.
Lógica pura compartilhada em `Slider/comum/`, com 24 testes passando (seção 5).

---

## 2. Verificado de verdade

Só entra aqui o que foi executado e conferido, não o que compila.

- **Fuso na data** — teste com `TZ=America/Sao_Paulo`: uma linha em `2026-09-15T00:00:00.000`
  não passava no intervalo de "Hoje" e passa depois da correção.
- **Parsing do `queryName`** — conferido nos quatro formatos: coluna direta e hierarquia
  automática devolvem `Fato/DataMovimento`; hierarquia manual e vazio caem no aviso.
- **Regra `[hidden]`** — extraída do CSS dentro do `.pbiviz`, com a especificidade correta
  (`0,2,0`) para vencer o `display:flex` das classes.
- **Rendering Events** — saiu da lista de itens recomendados ausentes do `pbiviz package`.
- **Filtro de data no relatório** — confirmado pelo usuário, depois de tirar a hierarquia do campo.
- **Personalizações ligadas ponta a ponta** — 63/63 nos três. `Slider/comum/test/auditar.py`
  cruza `capabilities.json` (persiste) × `settings.ts` (aparece) × `visual.ts` (é lido).
  Nenhum ajuste órfão: nada aparece no painel sem efeito, nada tem efeito sem persistir.
- **Coluna inteira em branco** — o Slider estourava em `TypeError` e sumia da tela;
  reproduzido isolado antes da correção. Agora os três avisam em vez de quebrar.
- **Período inicial** — o chip acendia sem filtrar nada. Agora aplica o intervalo ao abrir.

---

## 3. NÃO verificado

O ponto mais importante deste documento.

- **`BasicFilter` do Slider Refeição** — nunca foi visto filtrando num relatório real.
  Compila, mas filtro com alvo errado é descartado pelo Power BI **sem erro nenhum**.
- **`TupleFilter` do Filtro de Hierarquia** — idem. É o mais complexo dos três e o menos testado.
- **Dedução da hierarquia automática de data** — `seletorData/src/visual.ts`, `montarAlvo`.
  Assume que um `queryName` de cinco partes é `Tabela.Coluna.Variação.Hierarquia.Nível` e
  que a segunda parte é a coluna base. É heurística sobre o formato do nome, não API.
  Se algum modelo produzir cinco partes com outra estrutura, o filtro aponta para a coluna
  errada e falha em silêncio.
- **Modo linha do Filtro de Hierarquia** com dois níveis reais e muitas categorias:
  quebra de linha, rolagem e desempenho nunca foram vistos com volume.
- **A parte que fala com o Power BI continua sem teste.** A lógica pura passou a ter
  cobertura (seção 5), mas montagem de árvore, data joins do d3 e os filtros aplicando
  de fato só se verificam abrindo o relatório — foi assim que os sete defeitos desta
  sessão apareceram.

### Roteiro para fechar esta seção

O que precisa ser feito no Power BI, em ordem de valor. Marcar aqui conforme sair.

- [ ] **Seletor de Data — "Período inicial"**: mudar de `Tudo` para `Últimos 7 dias`,
      salvar, fechar e reabrir. O chip tem que abrir aceso **e** os dados filtrados.
      Era o defeito nº 2; com o padrão em `Tudo` os dois comportamentos coincidiam
      por acidente, então testar com `Tudo` não prova nada.
- [ ] **Slider — `BasicFilter`**: arrastar as alças e confirmar que outro visual da
      página reage. Alvo errado o Power BI descarta calado: se não filtrar, o problema
      é o `queryName`, não o arrasto.
- [ ] **Hierarquia — `TupleFilter`**: marcar folhas de dois pais diferentes e conferir
      que o resultado é a união dos pares, não o produto cartesiano.
- [ ] **Hierarquia — intervalo cheio**: marcar tudo deve **remover** o filtro do
      relatório, não aplicar um `In` com todos os valores.
- [ ] **Slider — coluna toda em branco**: se houver esse caso no modelo, confirmar que
      aparece o aviso em vez do visual sumir.
- [ ] **Modo linha da Hierarquia com volume real** — quebra de linha, rolagem, desempenho.

---

## 4. Duplicação — RESOLVIDO

Era a causa raiz das regressões: sem código compartilhado, o mesmo defeito apareceu em
três visuais quatro vezes seguidas (`displayName` no lugar do `queryName`, `config` sem
inicializar, `hidden` derrotado pelo `display`, escala só no padding).

`Slider/comum/` agora guarda a lógica pura, importada pelos três por caminho relativo:

| Módulo | Conteúdo |
|---|---|
| `numeros.ts` | `limitar` |
| `alvo.ts` | `montarAlvo`, `emBranco` |
| `rotulos.ts` | `cabemEm`, `encurtar` |
| `datas.ts` | fuso, presets de período, ida e volta dos campos de data |

Verificado que nenhum dos três redefine essas funções, e que `pbiviz package` aceita
fonte fora da raiz do projeto — era o risco registrado aqui antes.

**O que continua duplicado:** o LESS dos dois visuais de chip e o corpo do `aplicarEstilo`.
São acoplados ao DOM de cada visual; extrair exige decidir uma interface antes.

---

## 5. Testes — ESCRITOS

`Slider/comum/test/testes.ts`, 24 casos, todos passando. Rodar:

```
bash Slider/comum/test/rodar.sh
```

Sem framework: compila para um diretório temporário e roda com `node:assert`, para não
adicionar dependência só por causa de assertivas.

Cobre onde estiveram os defeitos reais — fuso na data, derivação do alvo, exclusão de
brancos, limites numéricos e corte de rótulo. Dois casos estão marcados `REGRESSAO` e
prendem o bug do `toISOString`. Um está marcado `LIMITACAO CONHECIDA`: ponto no nome da
tabela não é suportado pelo `montarAlvo`.

Escrever os testes já pagou: pegaram uma divergência na janela de "Últimos 7 dias" — que
era a expectativa do teste errada, não o código, mas fixou a semântica por escrito.

**Ainda sem teste:** tudo que depende de DOM ou do Power BI — montagem da árvore de
hierarquia, data joins do d3, e os três filtros de fato aplicando.

Junto deles, `auditar.py` valida as personalizações sem abrir o Power BI:

```
python Slider/comum/test/auditar.py
```

Ele pegou dois defeitos reais na primeira rodada útil. Também deu 56 e depois 5 falsos
positivos antes disso — alias local (`const ap = this.config.aparencia`), `topLevelSlice`
e o composto `FontControl`. O número só passou a valer depois de ensinar esses três casos.

Por decisão do projeto os testes ficam no `.gitignore` — rascunho local, não versionado.
Consequência aceita: não viajam entre máquinas e não protegem quem clonar o repo.

---

## 6. Itens recomendados pelo `pbiviz` ainda ausentes

São recomendações, não obrigatórios. Viram bloqueio só para publicar no AppSource.
O `pbiviz package` lista 9 nos três — os 4 abaixo mais os 5 descartados. `Rendering Events`
saiu da lista quando foi implementado, o que confirma que a contagem acompanha o código.

**Nada começado ainda.** É o próximo passo natural.

**Vale fazer**
- **High Contrast** — cores fixas no código ignoram o modo de alto contraste do Windows;
  hoje os três ficam ilegíveis nesse modo.
- **Keyboard Navigation** — os dois de chip já são navegáveis por Tab (botões reais), falta
  declarar. O Slider Refeição não é: só responde a mouse e arrasto.
- **Context Menu** — botão direito não abre menu nenhum nos três.
- **Color Palette** — a `PALETA` do Slider é fixa no código e ignora o tema do relatório.

**Provavelmente não vale**
- Tooltips e Landing Page — as mensagens em tela já cobrem.
- Localizations — só se o relatório for para outro idioma.
- Highlight Data, Selection Across Visuals, Allow Interactions — são para visuais que
  *exibem* dados. Estes filtram; não se aplicam.

---

## 7. Outras pendências menores

- A pasta se chama `Slider/` mas guarda dois visuais que não são slider. Renomear mexe no
  branch, então ficou para depois.
- O Filtro de Hierarquia no **modo painel** precisa de ~260px de altura: o Power BI recorta
  o visual nas próprias bordas e não existe suspenso que vaze para fora. Abaixo de 150px o
  painel é escondido de propósito. O modo linha não tem essa limitação.
- `dataReductionAlgorithm` limita a 30 categorias no Slider e 3000 pares na Hierarquia.
  Acima disso a seleção é silenciosamente truncada.
- `pbiviz start` precisa do PowerShell 7 (`pwsh`) para gerar o certificado do servidor dev.
  O `pbiviz package` funciona sem ele: o `error Create certificate error` que aparece no
  log **não** reprova o empacotamento — o código de saída continua 0.

---

## 8. Armadilhas já pagas

Cada uma destas custou pelo menos um ciclo. Todas passam no `tsc` e falham em silêncio.

- **Alvo do filtro vem do `queryName`, nunca do `displayName`.** O `displayName` é o rótulo
  renomeável; apontar para ele gera um filtro para uma coluna inexistente, que o Power BI
  **descarta sem erro nenhum**. Sintoma: nada filtra e nada aparece no console.
- **`toISOString` nos limites do filtro.** Em UTC-3 vira `03:00Z` e exclui as linhas
  gravadas à meia-noite. Usar `paraIsoLocal` de `comum/datas.ts`. Dois testes prendem isso.
- **`config` sem inicializar.** O Power BI pode chamar `getFormattingModel` antes do
  primeiro `update`; `buildFormattingModel(undefined)` lança e o painel Formatar fica
  **sem nenhum card**. Declarar sempre `= new ConfiguracoesVisual()`.
- **`[hidden]` é derrotado por qualquer `display` do autor** — a regra do navegador tem
  especificidade mínima. Daí a guarda `0,2,0` no LESS dos dois visuais de chip. Sem ela os
  dois modos da hierarquia apareciam juntos, com botões duplicados.
- **Em SVG, folha de estilo vence atributo de apresentação.** Se o LESS declara
  `font-size` em `.aviso`, `.attr("font-size", …)` não muda nada — precisa ser
  `.style(…)`. Foi o que travava o aviso do Slider nos 12px fixos.
- **`applyJsonFilter` dispara um novo `update`.** Qualquer filtro aplicado automaticamente
  durante o desenho precisa de guarda contra laço — as duas que existem hoje são o
  `restaurado`/`chaveInicio` e a condição `periodo !== "tudo"` no `seletorData`.
- **Validador também erra.** O `auditar.py` acusou 56 defeitos inexistentes por não seguir
  alias local, e depois 5 por não conhecer `topLevelSlice` e `FontControl`. Antes de
  reportar número de um script novo, conferir os primeiros achados um a um na mão.
- **Patch pode falhar sem avisar.** Já aconteceu de uma edição não gravar e o resultado
  ser dado como feito; só apareceu depois porque o `tsc=0` vinha do código antigo.
  Conferir que cada alteração está mesmo no arquivo antes de dizer que está pronta.
