# Pendências e estado real

Registro do que está resolvido, do que só *parece* resolvido e do que falta.
Atualizado em 2026-09-15, no commit `59f8560`.

---

## 1. Estado dos três visuais

| Visual | Pasta | Versão |
|---|---|---|
| Slider Refeição | `Slider/sliderRefeicao` | 1.4.1.0 |
| Seletor de Data | `Slider/seletorData` | 1.3.2.0 |
| Filtro de Hierarquia | `Slider/filtroHierarquia` | 1.2.2.0 |

Nos três: `npx tsc --noEmit` limpo, `npx eslint .` limpo, `npx pbiviz package` gera o `.pbiviz`.

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
- **Nenhum teste automatizado existe.** Os sete defeitos desta sessão foram todos
  encontrados abrindo o relatório, nenhum pelo código.

---

## 4. Duplicação — a causa raiz das regressões

Não há código compartilhado entre os três projetos. Cada `.pbiviz` é um pacote npm próprio e
o mesmo trecho está copiado. O resultado observado:

| Defeito | Quantos visuais tinham |
|---|---|
| `column: source.displayName` em vez do `queryName` | 3 |
| `config` declarado sem inicializar (painel Formatar vazio) | 3 |
| `hidden` derrotado pelo `display` das classes | 2 |
| Percentual de tamanho escalando só o padding | 2 |

Hoje `montarAlvo` está copiado nos três e o corpo de `aplicarEstilo` em dois.
Uma correção exige lembrar de aplicar em três lugares — e isso já falhou uma vez
nesta sessão, com um patch que não aplicou e foi reportado como feito.

**Proposta:** extrair para um módulo comum:
- `montarAlvo`, `emBranco`, `limitar`
- o corpo do `aplicarEstilo` (escala única, cores, medidas)
- a base do LESS (variáveis, `.chip`, guarda do `[hidden]`)

Restrição conhecida: o empacotador do pbiviz não gosta de fontes fora da raiz do projeto.
Precisa ser resolvido com um passo de cópia/sincronização ou testado antes de adotar.

---

## 5. Testes a escrever

Só lógica pura — nada disso precisa do Power BI para rodar, e teria pego pelo menos três
dos sete defeitos.

- Matemática de data e fuso: `inicioDoDia`, `fimDoDia`, `paraIsoLocal`, `somarDias`,
  os presets de período e o reconhecimento de intervalo de volta (`reconhecer`).
- `montarAlvo`: dois, três, cinco segmentos, vazio, e o caso com ponto no nome da tabela.
- Exclusão de valores em branco (`emBranco`) nos dois visuais que montam listas.
- Intervalo de duas alças: `limitar`, `maisProximo`, e a regra de que uma alça não
  ultrapassa a outra.
- Truncamento de rótulo (`criarEncurtador`) em larguras apertadas.

**Por decisão do projeto, os testes ficam no `.gitignore`** — rascunho local, não versionado.
Consequência aceita: não viajam entre máquinas e não protegem quem clonar o repo.

---

## 6. Itens recomendados pelo `pbiviz` ainda ausentes

São recomendações, não obrigatórios. Viram bloqueio só para publicar no AppSource.

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
