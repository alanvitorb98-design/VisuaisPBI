"use strict";

import powerbi from "powerbi-visuals-api";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import {
    BasicFilter,
    IBasicFilter,
    IFilterColumnTarget,
    ITupleFilter,
    TupleFilter,
    TupleValueType
} from "powerbi-models";

import { limitar } from "../../comum/numeros";
import { montarAlvo, emBranco } from "../../comum/alvo";
import { ConfiguracoesVisual } from "./settings";
import "../style/visual.less";

const OBJETO_FILTRO = "geral";
const PROP_FILTRO = "filtro";
// Separador das chaves "pai/filho". Unit Separator (31) nao aparece em texto
// de negocio, e montado por codigo para nao gravar byte de controle no fonte.
const SEPARADOR = String.fromCharCode(31);

interface Filho {
    nome: string;
    chave: string;
}

interface Pai {
    nome: string;
    filhos: Filho[];
}

export class Visual implements powerbi.extensibility.visual.IVisual {
    private host: IVisualHost;
    private servicoFormatacao: FormattingSettingsService;

    /**
     * O Power BI so sabe que o visual terminou de desenhar se ele avisar.
     * Sem estes eventos, exportar para PDF ou PowerPoint pode capturar o
     * visual pela metade, e o pbiviz marca o item como ausente.
     */
    private eventos: powerbi.extensibility.IVisualEventService;
    /**
     * Ja nasce com os padroes: o Power BI pode chamar getFormattingModel
     * antes do primeiro update (abrir o painel Formatar num visual sem campo
     * vinculado faz isso), e buildFormattingModel(undefined) lanca - o painel
     * fica sem nenhum card em vez de mostrar os ajustes.
     */
    private config: ConfiguracoesVisual = new ConfiguracoesVisual();

    private raiz: HTMLElement;
    private faixa: HTMLElement;
    private buscaLinha: HTMLInputElement;
    private chips: HTMLElement;
    private linhaBotao: HTMLElement;
    private botao: HTMLButtonElement;
    private rotuloBotao: HTMLElement;
    private contagem: HTMLElement;
    private painel: HTMLElement;
    private busca: HTMLInputElement;
    private arvore: HTMLElement;
    private aviso: HTMLElement;

    private arvoreDados: Pai[] = [];
    private alvo1: IFilterColumnTarget = null;
    private alvo2: IFilterColumnTarget = null;
    private temNivel2 = false;

    /** Folhas marcadas. Com nivel2: "pai\0filho". Sem nivel2: o proprio pai. */
    private marcadas: Record<string, boolean> = {};
    private expandidos: Record<string, boolean> = {};
    private aberto = false;
    private restaurado = false;
    private textoBusca = "";

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.servicoFormatacao = new FormattingSettingsService();
        this.eventos = options.host.eventService;

        this.raiz = document.createElement("div");
        this.raiz.className = "filtro-hierarquia";
        options.element.appendChild(this.raiz);

        this.faixa = document.createElement("div");
        this.faixa.className = "faixa";
        this.raiz.appendChild(this.faixa);

        // A busca fica fora do container que e reconstruido a cada clique:
        // recriar o input a cada tecla tiraria o foco no meio da digitacao.
        this.buscaLinha = document.createElement("input");
        this.buscaLinha.type = "search";
        this.buscaLinha.className = "busca";
        this.buscaLinha.placeholder = "Buscar";
        this.buscaLinha.addEventListener("input", () => {
            this.textoBusca = this.buscaLinha.value.trim().toLowerCase();
            this.desenharChips();
        });
        this.faixa.appendChild(this.buscaLinha);

        this.chips = document.createElement("div");
        this.chips.className = "chips";
        this.faixa.appendChild(this.chips);

        this.linhaBotao = document.createElement("div");
        this.linhaBotao.className = "linha-botao";
        this.raiz.appendChild(this.linhaBotao);

        this.botao = document.createElement("button");
        this.botao.type = "button";
        this.botao.className = "chip";
        this.botao.addEventListener("click", () => this.alternarPainel());
        this.linhaBotao.appendChild(this.botao);

        this.rotuloBotao = document.createElement("span");
        this.botao.appendChild(this.rotuloBotao);

        this.contagem = document.createElement("span");
        this.contagem.className = "contagem";
        this.botao.appendChild(this.contagem);

        const seta = document.createElement("span");
        seta.className = "seta";
        seta.setAttribute("aria-hidden", "true");
        this.botao.appendChild(seta);

        this.painel = document.createElement("div");
        this.painel.className = "painel";
        this.painel.hidden = true;
        this.raiz.appendChild(this.painel);

        const acoes = document.createElement("div");
        acoes.className = "acoes";
        this.painel.appendChild(acoes);

        this.busca = document.createElement("input");
        this.busca.type = "search";
        this.busca.className = "busca";
        this.busca.placeholder = "Buscar";
        this.busca.addEventListener("input", () => {
            this.textoBusca = this.busca.value.trim().toLowerCase();
            this.desenharArvore();
        });
        acoes.appendChild(this.busca);

        acoes.appendChild(this.criarAcao("Tudo", () => this.marcarTodas(true)));
        acoes.appendChild(this.criarAcao("Limpar", () => this.marcarTodas(false)));

        this.arvore = document.createElement("div");
        this.arvore.className = "arvore";
        this.painel.appendChild(this.arvore);

        this.aviso = document.createElement("div");
        this.aviso.className = "aviso";
        this.aviso.textContent = "Arraste um campo para Nível 1";
        this.aviso.hidden = true;
        this.raiz.appendChild(this.aviso);
    }

    private criarAcao(texto: string, aoClicar: () => void): HTMLButtonElement {
        const acao = document.createElement("button");
        acao.type = "button";
        acao.className = "acao";
        acao.textContent = texto;
        acao.addEventListener("click", aoClicar);
        return acao;
    }

    /**
     * O par de eventos fica aqui, envolvendo o desenho: `desenhar` tem varios
     * retornos antecipados (sem campo, hierarquia, sem linhas) e emitir o
     * renderingFinished em cada um deles seria facil de esquecer no proximo
     * ramo que surgisse.
     */
    public update(options: VisualUpdateOptions): void {
        this.eventos.renderingStarted(options);
        try {
            this.desenhar(options);
            this.eventos.renderingFinished(options);
        } catch (erro) {
            this.eventos.renderingFailed(options, String(erro));
        }
    }

    private desenhar(options: VisualUpdateOptions): void {
        const dataView = options.dataViews && options.dataViews[0];
        this.config = this.servicoFormatacao.populateFormattingSettingsModel(
            ConfiguracoesVisual,
            dataView
        );

        // antes dos retornos: com o visual em estado de aviso o estilo nao
        // era aplicado, e mexer nos ajustes parecia nao surtir efeito nenhum
        this.aplicarEstilo(options.viewport.height);

        const categorias = dataView
            && dataView.categorical
            && dataView.categorical.categories;

        const cat1 = categorias && categorias[0];

        if (!cat1) {
            this.semCampo("Arraste um campo para Nível 1");
            return;
        }

        if (!cat1.values || !cat1.values.length) {
            // o campo esta la; quem esvaziou foi outro filtro da pagina.
            // Preserva a selecao para ela voltar quando as linhas voltarem.
            this.semLinhas();
            return;
        }

        this.aviso.hidden = true;
        this.raiz.classList.remove("vazio");

        const cat2 = categorias.length > 1 ? categorias[1] : null;
        this.temNivel2 = !!cat2;

        this.alvo1 = montarAlvo(cat1.source.queryName).alvo;
        this.alvo2 = cat2 ? montarAlvo(cat2.source.queryName).alvo : null;

        if (!this.alvo1 || (this.temNivel2 && !this.alvo2)) {
            this.semCampo("Um dos campos veio como hierarquia. Clique na seta dele no "
                + "painel de campos e escolha a coluna em vez da hierarquia.");
            return;
        }

        this.montarArvore(cat1.values, cat2 ? cat2.values : null);

        if (!this.restaurado) {
            this.restaurado = true;
            this.restaurarDoFiltro(options);
        }

        this.desenharTudo();
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.servicoFormatacao.buildFormattingModel(this.config);
    }

    private get emLinha(): boolean {
        return this.config.painel.orientacao.value.value === "linha";
    }

    private chavesDo(pai: Pai): string[] {
        return this.temNivel2 ? pai.filhos.map(f => f.chave) : [pai.nome];
    }

    /** Escolhe o modo e redesenha so o que aquele modo usa. */
    private desenharTudo(): void {
        // aplicado aqui, nao so ao abrir o painel: antes mexer em
        // "Mostrar busca" no painel Formatar nao surtia efeito nenhum
        // ate o usuario fechar e reabrir a arvore.
        const mostrarBusca = this.config.painel.mostrarBusca.value;
        this.busca.hidden = !mostrarBusca;
        this.buscaLinha.hidden = !mostrarBusca;

        if (!mostrarBusca && this.textoBusca) {
            this.textoBusca = "";
            this.busca.value = "";
            this.buscaLinha.value = "";
        }

        if (this.emLinha) {
            this.linhaBotao.hidden = true;
            this.painel.hidden = true;
            this.faixa.hidden = false;
            this.desenharFaixa();
            return;
        }

        this.faixa.hidden = true;
        this.linhaBotao.hidden = false;
        this.painel.hidden = !this.aberto;
        this.desenharBotao();
        this.desenharArvore();
    }

    /**
     * Chips na horizontal, quebrando conforme a largura. Os filhos entram
     * logo depois do proprio pai, para a hierarquia continuar legivel sem
     * precisar de recuo vertical - e sem nada suspenso, que o Power BI
     * recortaria nas bordas do visual.
     */
    private desenharFaixa(): void {
        this.desenharChips();
    }

    private desenharChips(): void {
        this.chips.textContent = "";
        const busca = this.textoBusca;

        for (const pai of this.arvoreDados) {
            const paiBate = pai.nome.toLowerCase().indexOf(busca) >= 0;
            const filhosVisiveis = pai.filhos.filter(
                f => paiBate || f.nome.toLowerCase().indexOf(busca) >= 0
            );

            if (busca && !paiBate && !filhosVisiveis.length) {
                continue;
            }

            const chaves = this.chavesDo(pai);
            const marcadas = chaves.filter(c => this.marcadas[c]).length;
            const todas = marcadas === chaves.length && chaves.length > 0;
            const parcial = marcadas > 0 && !todas;

            // Dois botoes irmaos dentro de um span, nao um botao dentro de
            // outro: botao aninhado e HTML invalido e deixava o caret fora da
            // ordem de tabulacao, tornando os filhos inalcancaveis por teclado.
            const chip = document.createElement("span");
            chip.className = "chip chip-pai";
            chip.classList.toggle("ativo", todas);
            chip.classList.toggle("parcial", parcial);

            if (this.temNivel2) {
                const caret = document.createElement("button");
                caret.type = "button";
                caret.className = "caret";
                caret.classList.toggle("aberto", this.estaExpandido(pai.nome));
                caret.setAttribute("aria-expanded", String(this.estaExpandido(pai.nome)));
                caret.setAttribute("aria-label", "Expandir " + pai.nome);
                caret.addEventListener("click", () => {
                    this.expandidos[pai.nome] = !this.estaExpandido(pai.nome);
                    this.desenharFaixa();
                });
                chip.appendChild(caret);
            }

            const rotulo = document.createElement("button");
            rotulo.type = "button";
            rotulo.className = "rotulo";
            rotulo.setAttribute("aria-pressed", String(todas));
            rotulo.textContent = pai.nome;

            if (parcial && this.config.botao.mostrarContagem.value) {
                const conta = document.createElement("span");
                conta.className = "contagem";
                conta.textContent = marcadas + "/" + chaves.length;
                rotulo.appendChild(conta);
            }

            rotulo.addEventListener("click", () => {
                const novo = !todas;
                chaves.forEach(c => { this.marcadas[c] = novo; });
                this.aposMudanca();
            });

            chip.appendChild(rotulo);
            this.chips.appendChild(chip);

            // busca ativa abre os ramos que casaram, senao o resultado
            // ficaria escondido dentro de um pai recolhido
            const expandido = busca ? true : this.estaExpandido(pai.nome);

            if (this.temNivel2 && expandido) {
                filhosVisiveis.forEach(filho => this.chips.appendChild(this.chipFilho(filho)));
            }
        }

        this.chips.appendChild(this.criarAcao("Tudo", () => this.marcarTodas(true)));
        this.chips.appendChild(this.criarAcao("Limpar", () => this.marcarTodas(false)));
    }

    private chipFilho(filho: Filho): HTMLElement {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip chip-filho";
        chip.textContent = filho.nome;
        chip.classList.toggle("ativo", !!this.marcadas[filho.chave]);
        chip.addEventListener("click", () => {
            this.marcadas[filho.chave] = !this.marcadas[filho.chave];
            this.aposMudanca();
        });
        return chip;
    }

    /** Campo presente, porem sem linhas: nao mexe na selecao do usuario. */
    private semLinhas(): void {
        this.aviso.textContent = "Nenhuma linha para os filtros atuais";
        this.aviso.hidden = false;
        this.raiz.classList.add("vazio");
        this.faixa.textContent = "";
        this.arvore.textContent = "";
    }

    /**
     * Campo ausente ou inutilizavel. Zera o estado, senao os chips da carga
     * anterior continuariam na tela depois de tirar o campo do painel de
     * dados - e readicionar o campo reaproveitaria a selecao velha.
     */
    private semCampo(texto: string): void {
        this.aviso.textContent = texto;
        this.aviso.hidden = false;
        this.raiz.classList.add("vazio");

        this.arvoreDados = [];
        this.marcadas = {};
        this.expandidos = {};
        this.alvo1 = null;
        this.alvo2 = null;
        this.restaurado = false;
        this.faixa.textContent = "";
        this.arvore.textContent = "";
    }

    // ------------------------------------------------------------------
    // dados
    // ------------------------------------------------------------------

    private montarArvore(valores1: powerbi.PrimitiveValue[], valores2: powerbi.PrimitiveValue[]): void {
        const indice: Record<string, Pai> = {};
        const ordem: string[] = [];

        valores1.forEach((bruto, i) => {
            if (emBranco(bruto) || (valores2 && emBranco(valores2[i]))) {
                return;
            }

            const nomePai = String(bruto);

            if (!indice[nomePai]) {
                indice[nomePai] = { nome: nomePai, filhos: [] };
                ordem.push(nomePai);
            }

            if (!valores2) {
                return;
            }

            const nomeFilho = String(valores2[i]);
            const pai = indice[nomePai];
            if (!pai.filhos.some(f => f.nome === nomeFilho)) {
                pai.filhos.push({ nome: nomeFilho, chave: nomePai + SEPARADOR + nomeFilho });
            }
        });

        this.arvoreDados = ordem.map(nome => indice[nome]);
        this.arvoreDados.forEach(pai => pai.filhos.sort((a, b) => a.nome.localeCompare(b.nome)));

    }

    /**
     * `expandidos` guarda apenas o que o usuario clicou; o resto segue o
     * ajuste "Comecar expandido". Antes o ajuste era semeado uma vez em
     * expandidos, entao desliga-lo depois nao recolhia mais nada - o botao
     * so funcionava numa direcao.
     */
    private estaExpandido(nome: string): boolean {
        const escolha = this.expandidos[nome];
        return escolha === undefined ? this.config.painel.expandirTudo.value : escolha;
    }

    /** Todas as folhas existentes, na forma usada por `marcadas`. */
    private todasAsFolhas(): string[] {
        if (!this.temNivel2) {
            return this.arvoreDados.map(p => p.nome);
        }
        const lista: string[] = [];
        this.arvoreDados.forEach(pai => pai.filhos.forEach(f => lista.push(f.chave)));
        return lista;
    }

    private folhasMarcadas(): string[] {
        return this.todasAsFolhas().filter(chave => this.marcadas[chave]);
    }

    // ------------------------------------------------------------------
    // filtro
    // ------------------------------------------------------------------

    private restaurarDoFiltro(options: VisualUpdateOptions): void {
        const filtros = options.jsonFilters;
        const filtro = filtros && filtros.length ? filtros[0] : null;

        if (!filtro) {
            return;
        }

        const comoTupla = filtro as ITupleFilter;
        if (comoTupla.values && comoTupla.target && Array.isArray(comoTupla.target)) {
            comoTupla.values.forEach((tupla: TupleValueType) => {
                if (tupla.length >= 2) {
                    this.marcadas[String(tupla[0].value) + SEPARADOR + String(tupla[1].value)] = true;
                } else if (tupla.length === 1) {
                    this.marcadas[String(tupla[0].value)] = true;
                }
            });
            return;
        }

        const comoBasico = filtro as IBasicFilter;
        if (comoBasico.values) {
            comoBasico.values.forEach(v => { this.marcadas[String(v)] = true; });
        }
    }

    /**
     * Nada marcado ou tudo marcado significam "sem restricao", entao o filtro
     * sai do relatorio em vez de virar uma condicao que nao filtra nada.
     */
    private aplicarFiltro(): void {
        if (!this.alvo1) {
            return;
        }

        const marcadas = this.folhasMarcadas();
        const total = this.todasAsFolhas().length;

        if (!marcadas.length || marcadas.length === total) {
            this.host.applyJsonFilter(null, OBJETO_FILTRO, PROP_FILTRO, powerbi.FilterAction.remove);
            return;
        }

        if (!this.temNivel2) {
            const filtro = new BasicFilter(this.alvo1, "In", marcadas);
            this.host.applyJsonFilter(filtro, OBJETO_FILTRO, PROP_FILTRO, powerbi.FilterAction.merge);
            return;
        }

        const tuplas: TupleValueType[] = marcadas.map(chave => {
            const partes = chave.split(SEPARADOR);
            return [{ value: partes[0] }, { value: partes[1] }];
        });

        const filtro = new TupleFilter([this.alvo1, this.alvo2], "In", tuplas);
        this.host.applyJsonFilter(filtro, OBJETO_FILTRO, PROP_FILTRO, powerbi.FilterAction.merge);
    }

    // ------------------------------------------------------------------
    // interface
    // ------------------------------------------------------------------

    private aplicarEstilo(altura: number): void {
        const ap = this.config.aparencia;
        const estilo = this.raiz.style;

        // Uma escala unica multiplica TODAS as medidas. Escalar so parte delas
        // deixava o resultado desproporcional: pilula gorda com letra miuda,
        // ou cantos e vaos encolhendo conforme o chip cresce.
        const escala = limitar(ap.tamanho.value, 50, 300) / 100;
        const fonteBase = limitar(ap.fonte.fontSize.value, 6, 32);

        estilo.setProperty("--cor-destaque", ap.corDestaque.value.value);
        estilo.setProperty("--cor-chip", ap.corChip.value.value);
        estilo.setProperty("--cor-texto", ap.corTexto.value.value);
        estilo.setProperty(
            "--cor-fundo",
            ap.fundoTransparente.value ? "transparent" : ap.corFundo.value.value
        );

        estilo.setProperty("--fonte", ap.fonte.fontFamily.value);
        estilo.setProperty("--peso", ap.fonte.bold.value ? "600" : "400");
        estilo.setProperty("--italico", ap.fonte.italic.value ? "italic" : "normal");
        estilo.setProperty("--sublinhado", ap.fonte.underline.value ? "underline" : "none");

        estilo.setProperty("--tamanho", (fonteBase * escala).toFixed(1) + "px");
        estilo.setProperty("--pad-v", (7 * escala).toFixed(1) + "px");
        estilo.setProperty("--pad-h", (15 * escala).toFixed(1) + "px");
        estilo.setProperty(
            "--raio",
            (limitar(ap.raio.value, 0, 40) * escala).toFixed(1) + "px"
        );
        estilo.setProperty("--alinhamento", this.config.botao.alinhamento.value.value as string);
        estilo.setProperty("--gap", (6 * escala).toFixed(1) + "px");

        this.raiz.classList.toggle("modo-linha", this.emLinha);

        // so o modo painel precisa de altura: o Power BI recorta o visual nas
        // proprias bordas, entao a arvore suspensa nao tem para onde vazar
        this.raiz.classList.toggle("sem-espaco", !this.emLinha && altura < 150);
    }

    private desenharBotao(): void {
        this.rotuloBotao.textContent = this.config.botao.titulo.value || "Categorias";

        const marcadas = this.folhasMarcadas().length;
        const total = this.todasAsFolhas().length;
        const filtrando = marcadas > 0 && marcadas < total;

        this.botao.classList.toggle("ativo", filtrando);

        const mostrar = this.config.botao.mostrarContagem.value && filtrando;
        this.contagem.hidden = !mostrar;
        this.contagem.textContent = mostrar ? String(marcadas) : "";
    }

    private alternarPainel(): void {
        this.aberto = !this.aberto;
        this.painel.hidden = !this.aberto;

        if (this.aberto) {
            this.desenharArvore();
        }
    }

    private desenharArvore(): void {
        this.arvore.textContent = "";

        const busca = this.textoBusca;

        for (const pai of this.arvoreDados) {
            const paiBate = pai.nome.toLowerCase().indexOf(busca) >= 0;
            const filhosVisiveis = pai.filhos.filter(
                f => paiBate || f.nome.toLowerCase().indexOf(busca) >= 0
            );

            if (busca && !paiBate && !filhosVisiveis.length) {
                continue;
            }

            this.arvore.appendChild(this.linhaPai(pai));

            // busca ativa abre os ramos que casaram, senao o resultado ficaria escondido
            const expandido = busca ? true : this.estaExpandido(pai.nome);

            if (this.temNivel2 && expandido) {
                for (const filho of filhosVisiveis) {
                    this.arvore.appendChild(this.linhaFilho(filho));
                }
            }
        }
    }

    private linhaPai(pai: Pai): HTMLElement {
        const linha = document.createElement("div");
        linha.className = "linha pai";

        if (this.temNivel2) {
            const caret = document.createElement("button");
            caret.type = "button";
            caret.className = "caret";
            caret.classList.toggle("aberto", this.estaExpandido(pai.nome));
            caret.setAttribute("aria-label", "Expandir " + pai.nome);
            caret.addEventListener("click", () => {
                this.expandidos[pai.nome] = !this.estaExpandido(pai.nome);
                this.desenharArvore();
            });
            linha.appendChild(caret);
        }

        const chaves = this.chavesDo(pai);
        const marcadas = chaves.filter(c => this.marcadas[c]).length;

        const caixa = document.createElement("input");
        caixa.type = "checkbox";
        caixa.checked = marcadas === chaves.length && chaves.length > 0;
        caixa.indeterminate = marcadas > 0 && marcadas < chaves.length;
        caixa.addEventListener("change", () => {
            chaves.forEach(c => { this.marcadas[c] = caixa.checked; });
            this.aposMudanca();
        });
        linha.appendChild(caixa);

        const nome = document.createElement("span");
        nome.className = "nome";
        nome.textContent = pai.nome;
        nome.addEventListener("click", () => {
            const novo = !(marcadas === chaves.length);
            chaves.forEach(c => { this.marcadas[c] = novo; });
            this.aposMudanca();
        });
        linha.appendChild(nome);

        return linha;
    }

    private linhaFilho(filho: Filho): HTMLElement {
        const linha = document.createElement("div");
        linha.className = "linha filho";

        const caixa = document.createElement("input");
        caixa.type = "checkbox";
        caixa.checked = !!this.marcadas[filho.chave];
        caixa.addEventListener("change", () => {
            this.marcadas[filho.chave] = caixa.checked;
            this.aposMudanca();
        });
        linha.appendChild(caixa);

        const nome = document.createElement("span");
        nome.className = "nome";
        nome.textContent = filho.nome;
        nome.addEventListener("click", () => {
            this.marcadas[filho.chave] = !this.marcadas[filho.chave];
            this.aposMudanca();
        });
        linha.appendChild(nome);

        return linha;
    }

    private marcarTodas(valor: boolean): void {
        this.todasAsFolhas().forEach(chave => { this.marcadas[chave] = valor; });
        this.aposMudanca();
    }

    private aposMudanca(): void {
        this.desenharTudo();
        this.aplicarFiltro();
    }
}
