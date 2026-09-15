"use strict";

import * as d3 from "d3";
import powerbi from "powerbi-visuals-api";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { BasicFilter, IBasicFilter, IFilterColumnTarget } from "powerbi-models";

import { limitar } from "../../comum/numeros";
import { montarAlvo, emBranco } from "../../comum/alvo";
import { cabemEm, encurtar } from "../../comum/rotulos";
import { ConfiguracoesVisual } from "./settings";
import { iconePara, nosDoIcone } from "./icones";
import "../style/visual.less";

interface Ponto {
    chave: string;
    nome: string;
    ordem: number;
    pos: number;
    cor: string;
    icone: string;
}

interface Layout {
    esq: number;
    dir: number;
    y: number;
    raio: number;
    espessura: number;
    corDestaque: string;
    corMarcador: string;
    escalaIcone: number;
    escalaGeral: number;
    fonte: number;
    corRotulo: string;
    destacarRotulo: boolean;
    largura: number;
}

/** Uma das duas alças do intervalo. */
interface Alca {
    grupo: d3.Selection<SVGGElement, unknown, null, undefined>;
    halo: d3.Selection<SVGCircleElement, unknown, null, undefined>;
    anel: d3.Selection<SVGCircleElement, unknown, null, undefined>;
    corpo: d3.Selection<SVGCircleElement, unknown, null, undefined>;
    icone: d3.Selection<SVGGElement, unknown, null, undefined>;
    desenhado: string;
}

const PALETA = ["#F6C453", "#F28C28", "#E07A5F", "#7B5EA7", "#2C3E70"];
const VB = 24;
const DUR = 220;

/** Nome do objeto e da propriedade que guardam o filtro (ver capabilities.json). */
const OBJETO_FILTRO = "geral";
const PROP_FILTRO = "filtro";

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

    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private trilho: d3.Selection<SVGLineElement, unknown, null, undefined>;
    private trilhoAtivo: d3.Selection<SVGLineElement, unknown, null, undefined>;
    private camadaMarcas: d3.Selection<SVGGElement, unknown, null, undefined>;
    private camadaRotulos: d3.Selection<SVGGElement, unknown, null, undefined>;
    private limpar: d3.Selection<SVGGElement, unknown, null, undefined>;
    private aviso: d3.Selection<SVGTextElement, unknown, null, undefined>;

    private alcaInicio: Alca;
    private alcaFim: Alca;

    private pontos: Ponto[] = [];
    private layout: Layout = null;
    private alvoFiltro: IFilterColumnTarget = null;

    /** Extremos do intervalo, guardados pelo nome para sobreviver a refresh. */
    private chaveInicio: string = null;
    private chaveFim: string = null;
    private iInicio = 0;
    private iFim = 0;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.servicoFormatacao = new FormattingSettingsService();
        this.eventos = options.host.eventService;

        this.svg = d3.select(options.element)
            .append("svg")
            .classed("slider-refeicao", true)
            .attr("width", "100%")
            .attr("height", "100%");

        const sombra = this.svg.append("defs")
            .append("filter")
            .attr("id", "sombraAlca")
            .attr("x", "-60%").attr("y", "-60%")
            .attr("width", "220%").attr("height", "220%");
        sombra.append("feDropShadow")
            .attr("dx", 0).attr("dy", 2)
            .attr("stdDeviation", 2.6)
            .attr("flood-opacity", 0.22);

        this.trilho = this.svg.append("line").attr("class", "trilho");
        this.trilhoAtivo = this.svg.append("line").attr("class", "trilho-ativo");
        this.camadaMarcas = this.svg.append("g").attr("class", "marcas");
        this.camadaRotulos = this.svg.append("g").attr("class", "rotulos");

        this.alcaInicio = this.criarAlca("inicio");
        this.alcaFim = this.criarAlca("fim");

        this.limpar = this.svg.append("g").attr("class", "limpar");
        this.limpar.append("circle").attr("class", "limpar-fundo").attr("r", 9);
        this.limpar.append("path")
            .attr("class", "limpar-x")
            .attr("d", "M-3.1 -3.1 L3.1 3.1 M3.1 -3.1 L-3.1 3.1");
        this.limpar.append("title").text("Limpar o filtro e voltar a mostrar todas as refeições");

        this.aviso = this.svg.append("text")
            .attr("class", "aviso")
            .attr("x", 12).attr("y", 24);
    }

    private criarAlca(classe: string): Alca {
        const grupo = this.svg.append("g").attr("class", "alca alca-" + classe);
        return {
            grupo: grupo,
            halo: grupo.append("circle").attr("class", "halo"),
            corpo: grupo.append("circle").attr("class", "corpo"),
            anel: grupo.append("circle").attr("class", "anel"),
            icone: grupo.append("g").attr("class", "icone-grupo"),
            desenhado: null
        };
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

        // antes dos retornos: o aviso e a unica coisa na tela nos estados de
        // erro, e ele ficava preso na fonte fixa do CSS - mexer nos ajustes
        // parecia nao surtir efeito nenhum enquanto o visual estivesse assim
        this.estilizarAviso();

        const categoria = dataView
            && dataView.categorical
            && dataView.categorical.categories
            && dataView.categorical.categories[0];

        if (!categoria) {
            this.mostrarVazio(true);
            return;
        }

        if (!categoria.values || !categoria.values.length) {
            // o campo esta la; quem esvaziou foi outro filtro da pagina.
            // Preserva o intervalo escolhido para ele voltar com as linhas.
            this.semLinhas();
            return;
        }
        this.mostrarVazio(false);

        this.alvoFiltro = montarAlvo(categoria.source.queryName).alvo;

        if (!this.alvoFiltro) {
            this.mostrarVazio(true, "Este campo veio como hierarquia. Clique na seta dele no "
                + "painel de campos e escolha a coluna em vez da hierarquia.");
            return;
        }

        const valores = dataView.categorical.values;
        const ordens = (valores && valores[0] && valores[0].values) || [];

        // PrimitiveValueType do powerbi-models e string | number | boolean:
        // nao ha valor de filtro que represente branco, e um ponto para branco
        // geraria In ["null"], que nunca casa com o branco real.
        const naoBrancos = categoria.values
            .map((valor, i) => ({ valor: valor, i: i }))
            .filter(par => !emBranco(par.valor));

        this.pontos = naoBrancos.map(({ valor, i: indiceOriginal }) => {
            const nome = String(valor);
            const bruto = ordens[indiceOriginal];
            return <Ponto>{
                chave: nome,
                nome: nome,
                ordem: Number(bruto !== null && bruto !== undefined ? bruto : indiceOriginal),
                pos: 0,
                cor: "",
                icone: iconePara(nome)
            };
        });

        this.pontos.sort((a, b) => a.ordem - b.ordem);
        this.pontos.forEach((ponto, i) => {
            ponto.pos = i;
            ponto.cor = PALETA[i % PALETA.length];
        });

        // A coluna tem linhas, mas todas em branco: `naoBrancos` filtrou tudo.
        // Sem esta saida, restaurarIntervalo leria pontos[0] de uma lista
        // vazia e o update inteiro morria em TypeError - o visual sumia da
        // tela sem dizer por que.
        if (!this.pontos.length) {
            this.semLinhas("Todos os valores desta coluna estao em branco");
            return;
        }

        this.restaurarIntervalo(options);

        this.calcularLayout(options.viewport.width, options.viewport.height);
        this.desenharEstrutura();
        this.desenharEstado(false);
        this.ligarInteracoes();
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.servicoFormatacao.buildFormattingModel(this.config);
    }

    // ------------------------------------------------------------------
    // filtro
    // ------------------------------------------------------------------

    /**
     * Recoloca as alcas a partir do filtro que ja esta no relatorio.
     *
     * Sem isso, reabrir o relatorio mostraria o intervalo cheio enquanto os
     * outros visuais continuam filtrados - a barra mentiria sobre o estado.
     */
    private restaurarIntervalo(options: VisualUpdateOptions): void {
        const ultimo = this.pontos.length - 1;

        if (this.chaveInicio === null) {
            const filtros = options.jsonFilters;
            const filtro = (filtros && filtros.length ? filtros[0] : null) as IBasicFilter;
            const valores = filtro && filtro.values ? filtro.values.map(v => String(v)) : [];

            if (valores.length) {
                const posicoes = this.pontos
                    .filter(p => valores.indexOf(p.nome) >= 0)
                    .map(p => p.pos);
                if (posicoes.length) {
                    this.chaveInicio = this.pontos[Math.min.apply(null, posicoes)].chave;
                    this.chaveFim = this.pontos[Math.max.apply(null, posicoes)].chave;
                }
            }
        }

        this.iInicio = this.acharPos(this.chaveInicio, 0);
        this.iFim = this.acharPos(this.chaveFim, ultimo);

        if (this.iInicio > this.iFim) {
            this.iInicio = 0;
            this.iFim = ultimo;
        }

        this.chaveInicio = this.pontos[this.iInicio].chave;
        this.chaveFim = this.pontos[this.iFim].chave;
    }

    private acharPos(chave: string, padrao: number): number {
        if (chave === null) {
            return padrao;
        }
        const achado = this.pontos.findIndex(p => p.chave === chave);
        return achado < 0 ? padrao : achado;
    }

    private get cobreTudo(): boolean {
        return this.iInicio === 0 && this.iFim === this.pontos.length - 1;
    }

    /**
     * Aplica o intervalo como filtro de verdade. Intervalo cheio remove o
     * filtro em vez de listar tudo, senao o relatorio carregaria uma
     * condicao "In (todos)" que nao filtra nada e ainda aparece no painel.
     */
    private aplicarFiltro(): void {
        if (!this.alvoFiltro) {
            return;
        }

        if (this.cobreTudo) {
            this.host.applyJsonFilter(null, OBJETO_FILTRO, PROP_FILTRO, powerbi.FilterAction.remove);
            return;
        }

        const nomes = this.pontos
            .slice(this.iInicio, this.iFim + 1)
            .map(p => p.nome);

        const filtro = new BasicFilter(this.alvoFiltro, "In", nomes);
        this.host.applyJsonFilter(filtro, OBJETO_FILTRO, PROP_FILTRO, powerbi.FilterAction.merge);
    }

    // ------------------------------------------------------------------
    // layout
    // ------------------------------------------------------------------

    private calcularLayout(largura: number, altura: number): void {
        const cfgSlider = this.config.slider;
        const cfgRotulos = this.config.rotulos;
        const cfgIcone = this.config.icone;

        // Um percentual so escala o visual inteiro. Escalar apenas parte das
        // medidas deixava o resultado desproporcional: alca grande com rotulo
        // miudo, ou trilho grosso com icone pequeno.
        const escalaGeral = limitar(cfgSlider.tamanho.value, 50, 300) / 100;

        const espessura = limitar(cfgSlider.espessuraTrilho.value, 1, 24) * escalaGeral;
        const fonte = limitar(cfgRotulos.fonte.fontSize.value, 6, 40) * escalaGeral;
        const mostrarRotulos = cfgRotulos.mostrar.value;

        // o teto pela altura vem depois da escala: a alca pode crescer, mas
        // nao ate empurrar o rotulo fora do visual
        const raioPedido = limitar(cfgSlider.raioAlca.value, 6, 200) * escalaGeral;
        const raio = limitar(raioPedido, 6, Math.max(6, altura * 0.42));

        const margem = Math.max(raio + 6, Math.min(largura * 0.14, 72));
        const esq = Math.min(margem, largura / 2);
        const dir = Math.max(esq + 1, largura - margem);

        const alturaRotulo = mostrarRotulos ? fonte + 10 : 0;
        const alturaTotal = raio * 2 + alturaRotulo;
        const topo = Math.max(0, (altura - alturaTotal) / 2);

        this.layout = {
            esq: esq,
            dir: dir,
            y: topo + raio,
            raio: raio,
            espessura: espessura,
            corDestaque: cfgSlider.corDestaque.value.value,
            corMarcador: cfgSlider.corMarcador.value.value,
            escalaIcone: limitar(cfgIcone.escala.value, 40, 200) / 100,
            escalaGeral: escalaGeral,
            fonte: fonte,
            corRotulo: cfgRotulos.cor.value.value,
            destacarRotulo: cfgRotulos.destacarSelecionado.value,
            largura: largura
        };
    }

    private posX(indice: number): number {
        const total = this.pontos.length;
        if (total <= 1) {
            return (this.layout.esq + this.layout.dir) / 2;
        }
        const passo = (this.layout.dir - this.layout.esq) / (total - 1);
        return this.layout.esq + passo * indice;
    }

    private maisProximo(x: number): number {
        let melhor = 0;
        let menorDistancia = Infinity;
        for (let i = 0; i < this.pontos.length; i++) {
            const distancia = Math.abs(this.posX(i) - x);
            if (distancia < menorDistancia) {
                menorDistancia = distancia;
                melhor = i;
            }
        }
        return melhor;
    }

    // ------------------------------------------------------------------
    // desenho
    // ------------------------------------------------------------------

    /**
     * O aviso segue os ajustes de Rotulos, com a mesma escala geral do resto
     * do visual. Fica separado de calcularLayout porque precisa valer tambem
     * nos estados em que nao ha layout nenhum para calcular.
     */
    private estilizarAviso(): void {
        const cfgRotulos = this.config.rotulos;
        const escala = limitar(this.config.slider.tamanho.value, 50, 300) / 100;
        const tamanho = limitar(cfgRotulos.fonte.fontSize.value, 6, 40) * escala;

        // style, nao attr: a regra `.aviso` do LESS e uma folha de estilo, e
        // folha de estilo vence atributo de apresentacao em SVG. Por attr a
        // fonte continuaria travada nos 12px fixos do CSS.
        this.aviso
            .style("fill", cfgRotulos.cor.value.value)
            .style("font-family", cfgRotulos.fonte.fontFamily.value)
            .style("font-size", tamanho.toFixed(1) + "px")
            .style("font-weight", cfgRotulos.fonte.bold.value ? "600" : "400")
            .style("font-style", cfgRotulos.fonte.italic.value ? "italic" : "normal")
            .style("text-decoration", cfgRotulos.fonte.underline.value ? "underline" : "none")
            .attr("y", (tamanho + 12).toFixed(1));
    }

    private mostrarVazio(vazio: boolean, texto?: string): void {
        this.svg.classed("vazio", vazio);
        this.aviso
            .style("display", vazio ? null : "none")
            .text(texto || "Arraste o campo Refeicao para o visual");

        if (!vazio) {
            return;
        }

        // Sem esta limpeza o visual continuaria mostrando os pontos da carga
        // anterior depois que o campo sai do painel de dados: os elementos
        // persistem entre updates e o data join so os remove se receber [].
        this.pontos = [];
        this.chaveInicio = null;
        this.chaveFim = null;
        this.iInicio = 0;
        this.iFim = 0;
        this.alvoFiltro = null;

        this.camadaMarcas.selectAll("circle.marca").remove();
        this.camadaRotulos.selectAll("text.rotulo").remove();
    }

    /** Campo presente, porem sem linhas: nao mexe no intervalo do usuario. */
    private semLinhas(texto?: string): void {
        this.svg.classed("vazio", true);
        this.aviso
            .style("display", null)
            .text(texto || "Nenhuma linha para os filtros atuais");

        this.camadaMarcas.selectAll("circle.marca").remove();
        this.camadaRotulos.selectAll("text.rotulo").remove();
    }

    private desenharEstrutura(): void {
        const lay = this.layout;
        const cfgSlider = this.config.slider;
        const cfgRotulos = this.config.rotulos;
        const cfgIcone = this.config.icone;

        this.svg.classed("sem-animacao", !cfgIcone.animar.value);

        this.trilho
            .attr("x1", lay.esq).attr("x2", lay.dir)
            .attr("y1", lay.y).attr("y2", lay.y)
            .attr("stroke", cfgSlider.corTrilho.value.value)
            .attr("stroke-width", lay.espessura);

        this.trilhoAtivo
            .attr("y1", lay.y).attr("y2", lay.y)
            .attr("stroke", lay.corDestaque)
            .attr("stroke-width", lay.espessura);

        const dadosMarcas = cfgSlider.mostrarMarcadores.value ? this.pontos : [];
        const marcas = this.camadaMarcas
            .selectAll<SVGCircleElement, Ponto>("circle.marca")
            .data(dadosMarcas, (d: Ponto) => d.chave);

        marcas.exit().remove();

        marcas.enter()
            .append("circle")
            .attr("class", "marca")
            .attr("r", 0)
            .attr("cx", d => this.posX(d.pos))
            .attr("cy", lay.y)
            .merge(marcas)
            .attr("cy", lay.y)
            .transition().duration(DUR)
            .attr("cx", d => this.posX(d.pos))
            .attr("r", Math.max(3, lay.espessura * 0.85));

        const dadosRotulos = cfgRotulos.mostrar.value ? this.pontos : [];
        const encurtar = this.criarEncurtador();

        const rotulos = this.camadaRotulos
            .selectAll<SVGTextElement, Ponto>("text.rotulo")
            .data(dadosRotulos, (d: Ponto) => d.chave);

        rotulos.exit().remove();

        rotulos.enter()
            .append("text")
            .attr("class", "rotulo")
            .attr("text-anchor", "middle")
            .attr("x", d => this.posX(d.pos))
            .merge(rotulos)
            .attr("y", lay.y + lay.raio + lay.fonte + 2)
            .attr("fill", lay.corRotulo)
            .style("font-family", cfgRotulos.fonte.fontFamily.value)
            .style("font-size", lay.fonte + "px")
            .style("font-weight", cfgRotulos.fonte.bold.value ? "600" : "400")
            .style("font-style", cfgRotulos.fonte.italic.value ? "italic" : "normal")
            .style("text-decoration", cfgRotulos.fonte.underline.value ? "underline" : "none")
            .text(d => encurtar(d.nome))
            .transition().duration(DUR)
            .attr("x", d => this.posX(d.pos));

        const corDisco = cfgSlider.discoTransparente.value
            ? "transparent"
            : cfgSlider.corDisco.value.value;

        [this.alcaInicio, this.alcaFim].forEach(alca => {
            alca.corpo.attr("r", lay.raio).attr("fill", corDisco);
            alca.anel.attr("r", lay.raio).attr("stroke-width", Math.max(2, lay.espessura * 0.45));
            alca.halo.attr("r", lay.raio * 1.5);
            alca.icone.style("display", cfgIcone.mostrar.value ? null : "none");
        });

        // o botao limpar tambem acompanha a escala, senao viraria um alvo
        // minusculo ao lado de chips grandes
        const raioLimpar = 9 * lay.escalaGeral;
        this.limpar.select("circle.limpar-fundo").attr("r", raioLimpar);
        this.limpar.select("path.limpar-x")
            .attr("d", this.desenhoDoX(raioLimpar * 0.34))
            .attr("stroke-width", 1.6 * lay.escalaGeral);
        this.limpar.attr("transform",
            "translate(" + (lay.largura - raioLimpar - 5) + ", " + (raioLimpar + 4) + ")");
    }

    /** Um X centrado na origem, com meia-diagonal `braco`. */
    private desenhoDoX(braco: number): string {
        const b = braco.toFixed(2);
        return "M-" + b + " -" + b + " L" + b + " " + b + " M" + b + " -" + b + " L-" + b + " " + b;
    }

    private criarEncurtador(): (texto: string) => string {
        const total = this.pontos.length;
        const larguraDisponivel = total > 1
            ? (this.layout.dir - this.layout.esq) / (total - 1) - 6
            : this.layout.dir - this.layout.esq;

        const maximo = cabemEm(larguraDisponivel, this.layout.fonte);
        return (texto: string) => encurtar(texto, maximo);
    }

    private desenharEstado(animar: boolean): void {
        const lay = this.layout;
        const duracao = animar ? DUR : 0;

        this.moverAlca(this.alcaInicio, this.iInicio, duracao);
        this.moverAlca(this.alcaFim, this.iFim, duracao);

        // as duas alcas no mesmo ponto viram um disco so; marca isso para o CSS
        this.svg.classed("ponto-unico", this.iInicio === this.iFim);

        this.trilhoAtivo.interrupt()
            .transition().duration(duracao)
            .attr("x1", this.posX(this.iInicio))
            .attr("x2", this.posX(this.iFim));

        this.camadaMarcas.selectAll<SVGCircleElement, Ponto>("circle.marca")
            .classed("dentro", d => d.pos >= this.iInicio && d.pos <= this.iFim)
            .attr("fill", d => d.pos >= this.iInicio && d.pos <= this.iFim
                ? lay.corDestaque
                : lay.corMarcador);

        this.camadaRotulos.selectAll<SVGTextElement, Ponto>("text.rotulo")
            .classed("selecionado", d => lay.destacarRotulo
                && d.pos >= this.iInicio
                && d.pos <= this.iFim);

        const mostrarLimpar = this.config.slider.mostrarLimpar.value && !this.cobreTudo;
        this.limpar.style("display", mostrarLimpar ? null : "none");
    }

    private moverAlca(alca: Alca, indice: number, duracao: number): void {
        const lay = this.layout;
        const ponto = this.pontos[indice];

        const cor = this.config.slider.usarCorDaCategoria.value
            ? ponto.cor
            : this.config.slider.corAlca.value.value;

        alca.grupo.interrupt()
            .transition().duration(duracao)
            .attr("transform", "translate(" + this.posX(indice) + ", " + lay.y + ")");

        alca.halo.attr("fill", cor);
        alca.anel.attr("stroke", cor);

        const escala = (lay.raio * 1.7 * lay.escalaIcone) / VB;
        alca.icone
            .attr("transform",
                "translate(" + (-VB / 2 * escala) + ", " + (-VB / 2 * escala) + ") scale(" + escala + ")")
            .style("color", cor);

        // so remonta quando o desenho muda, senao as animacoes reiniciam a cada update
        if (alca.desenhado !== ponto.icone) {
            alca.desenhado = ponto.icone;
            alca.icone.selectAll("*").remove();
            alca.icone.node().appendChild(nosDoIcone(ponto.icone));
        }
    }

    // ------------------------------------------------------------------
    // interacao
    // ------------------------------------------------------------------

    private ligarInteracoes(): void {
        this.arrastar(this.alcaInicio, true);
        this.arrastar(this.alcaFim, false);

        this.camadaMarcas.selectAll<SVGCircleElement, Ponto>("circle.marca")
            .on("click", (evento: MouseEvent, d: Ponto) => this.cliqueEmPonto(d.pos));

        this.camadaRotulos.selectAll<SVGTextElement, Ponto>("text.rotulo")
            .on("click", (evento: MouseEvent, d: Ponto) => this.cliqueEmPonto(d.pos));

        this.limpar.on("click", () => {
            this.definirIntervalo(0, this.pontos.length - 1);
        });
    }

    private arrastar(alca: Alca, ehInicio: boolean): void {
        const lay = this.layout;

        alca.grupo.call(
            d3.drag<SVGGElement, unknown>()
                .on("start", () => {
                    alca.grupo.classed("arrastando", true);
                    alca.grupo.raise();
                })
                .on("drag", (evento: d3.D3DragEvent<SVGGElement, unknown, unknown>) => {
                    const limiteEsq = ehInicio ? lay.esq : this.posX(this.iInicio);
                    const limiteDir = ehInicio ? this.posX(this.iFim) : lay.dir;
                    const x = limitar(evento.x, limiteEsq, limiteDir);

                    alca.grupo.interrupt().attr("transform", "translate(" + x + ", " + lay.y + ")");
                    this.trilhoAtivo.interrupt()
                        .attr(ehInicio ? "x1" : "x2", x);
                })
                .on("end", (evento: d3.D3DragEvent<SVGGElement, unknown, unknown>) => {
                    alca.grupo.classed("arrastando", false);

                    const limiteEsq = ehInicio ? lay.esq : this.posX(this.iInicio);
                    const limiteDir = ehInicio ? this.posX(this.iFim) : lay.dir;
                    const alvo = this.maisProximo(limitar(evento.x, limiteEsq, limiteDir));

                    if (ehInicio) {
                        this.definirIntervalo(Math.min(alvo, this.iFim), this.iFim);
                    } else {
                        this.definirIntervalo(this.iInicio, Math.max(alvo, this.iInicio));
                    }
                })
        );
    }

    /** Clicar num ponto move a alca mais perto dele, encurtando ou esticando o intervalo. */
    private cliqueEmPonto(pos: number): void {
        const distInicio = Math.abs(pos - this.iInicio);
        const distFim = Math.abs(pos - this.iFim);

        if (distInicio <= distFim) {
            this.definirIntervalo(Math.min(pos, this.iFim), this.iFim);
        } else {
            this.definirIntervalo(this.iInicio, Math.max(pos, this.iInicio));
        }
    }

    private definirIntervalo(inicio: number, fim: number): void {
        const ultimo = this.pontos.length - 1;
        this.iInicio = limitar(inicio, 0, ultimo);
        this.iFim = limitar(fim, this.iInicio, ultimo);

        this.chaveInicio = this.pontos[this.iInicio].chave;
        this.chaveFim = this.pontos[this.iFim].chave;

        this.desenharEstado(true);
        this.aplicarFiltro();
    }
}
