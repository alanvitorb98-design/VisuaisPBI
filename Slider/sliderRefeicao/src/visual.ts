"use strict";

import * as d3 from "d3";
import powerbi from "powerbi-visuals-api";
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

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
    id: ISelectionId;
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
    fonte: number;
    corRotulo: string;
    destacarRotulo: boolean;
}

const PALETA = ["#F6C453", "#F28C28", "#E07A5F", "#7B5EA7", "#2C3E70"];
const VB = 24;
const DUR = 220;

function limitar(valor: number, minimo: number, maximo: number): number {
    if (!isFinite(valor)) {
        return minimo;
    }
    return Math.max(minimo, Math.min(maximo, valor));
}

export class Visual implements powerbi.extensibility.visual.IVisual {
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private servicoFormatacao: FormattingSettingsService;
    private config: ConfiguracoesVisual;

    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private trilho: d3.Selection<SVGLineElement, unknown, null, undefined>;
    private trilhoAtivo: d3.Selection<SVGLineElement, unknown, null, undefined>;
    private camadaMarcas: d3.Selection<SVGGElement, unknown, null, undefined>;
    private camadaRotulos: d3.Selection<SVGGElement, unknown, null, undefined>;
    private alca: d3.Selection<SVGGElement, unknown, null, undefined>;
    private halo: d3.Selection<SVGCircleElement, unknown, null, undefined>;
    private corpo: d3.Selection<SVGCircleElement, unknown, null, undefined>;
    private anel: d3.Selection<SVGCircleElement, unknown, null, undefined>;
    private grupoIcone: d3.Selection<SVGGElement, unknown, null, undefined>;
    private aviso: d3.Selection<SVGTextElement, unknown, null, undefined>;

    private pontos: Ponto[] = [];
    private chaveAtual: string = null;
    private layout: Layout = null;
    private iconeDesenhado: string = null;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.servicoFormatacao = new FormattingSettingsService();

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

        this.alca = this.svg.append("g").attr("class", "alca");
        this.halo = this.alca.append("circle").attr("class", "halo");
        this.corpo = this.alca.append("circle").attr("class", "corpo");
        this.anel = this.alca.append("circle").attr("class", "anel");
        this.grupoIcone = this.alca.append("g").attr("class", "icone-grupo");

        this.aviso = this.svg.append("text")
            .attr("class", "aviso")
            .attr("x", 12).attr("y", 24);
    }

    public update(options: VisualUpdateOptions): void {
        const dataView = options.dataViews && options.dataViews[0];
        this.config = this.servicoFormatacao.populateFormattingSettingsModel(
            ConfiguracoesVisual,
            dataView
        );

        const categoria = dataView
            && dataView.categorical
            && dataView.categorical.categories
            && dataView.categorical.categories[0];

        if (!categoria || !categoria.values || !categoria.values.length) {
            this.mostrarVazio(true);
            return;
        }
        this.mostrarVazio(false);

        const valores = dataView.categorical.values;
        const ordens = (valores && valores[0] && valores[0].values) || [];

        this.pontos = categoria.values.map((valor, indiceOriginal) => {
            const nome = String(valor);
            const bruto = ordens[indiceOriginal];
            return <Ponto>{
                chave: nome,
                nome: nome,
                ordem: Number(bruto !== null && bruto !== undefined ? bruto : indiceOriginal),
                pos: 0,
                cor: "",
                icone: iconePara(nome),
                id: this.host.createSelectionIdBuilder()
                    .withCategory(categoria, indiceOriginal)
                    .createSelectionId()
            };
        });

        this.pontos.sort((a, b) => a.ordem - b.ordem);
        this.pontos.forEach((ponto, i) => {
            ponto.pos = i;
            ponto.cor = PALETA[i % PALETA.length];
        });

        let indice = this.pontos.findIndex(p => p.chave === this.chaveAtual);
        if (indice < 0) {
            indice = 0;
        }
        this.chaveAtual = this.pontos[indice].chave;

        this.calcularLayout(options.viewport.width, options.viewport.height);
        this.desenharEstrutura();
        this.desenharEstado(indice, false);
        this.ligarInteracoes();
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.servicoFormatacao.buildFormattingModel(this.config);
    }

    public destroy(): void {
        this.selectionManager.clear();
    }

    // ------------------------------------------------------------------
    // layout
    // ------------------------------------------------------------------

    private calcularLayout(largura: number, altura: number): void {
        const cfgSlider = this.config.slider;
        const cfgRotulos = this.config.rotulos;
        const cfgIcone = this.config.icone;

        const espessura = limitar(cfgSlider.espessuraTrilho.value, 1, 24);
        const fonte = limitar(cfgRotulos.fonte.fontSize.value, 6, 40);
        const mostrarRotulos = cfgRotulos.mostrar.value;

        // a alca nunca passa de 30% da altura, senao o rotulo fica sem espaco
        const raio = limitar(cfgSlider.raioAlca.value, 6, Math.max(6, altura * 0.30));

        // margem lateral acompanha a largura, mas sempre cabe a alca inteira
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
            fonte: fonte,
            corRotulo: cfgRotulos.cor.value.value,
            destacarRotulo: cfgRotulos.destacarSelecionado.value
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

    /** Indice do ponto mais proximo de uma coordenada x. */
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

    private mostrarVazio(vazio: boolean): void {
        this.svg.classed("vazio", vazio);
        this.aviso
            .style("display", vazio ? null : "none")
            .text("Arraste o campo Refeicao para o visual");
    }

    /** Tudo que depende so do layout, nao do item selecionado. */
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
            .attr("x1", lay.esq)
            .attr("y1", lay.y).attr("y2", lay.y)
            .attr("stroke", lay.corDestaque)
            .attr("stroke-width", lay.espessura);

        // ----- marcadores -----
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

        // ----- rotulos -----
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

        // ----- alca -----
        this.corpo.attr("r", lay.raio);
        this.anel.attr("r", lay.raio).attr("stroke-width", Math.max(2, lay.espessura * 0.45));
        this.halo.attr("r", lay.raio * 1.5);
        this.grupoIcone.style("display", cfgIcone.mostrar.value ? null : "none");
    }

    /**
     * Rotulo longo demais para o espaco entre marcadores vira "texto...".
     * Largura estimada em 0.55em por caractere, suficiente para Segoe UI.
     */
    private criarEncurtador(): (texto: string) => string {
        const total = this.pontos.length;
        const larguraDisponivel = total > 1
            ? (this.layout.dir - this.layout.esq) / (total - 1) - 6
            : this.layout.dir - this.layout.esq;

        const maximo = Math.max(3, Math.floor(larguraDisponivel / (this.layout.fonte * 0.55)));

        return (texto: string) =>
            texto.length > maximo ? texto.substring(0, maximo - 1) + "…" : texto;
    }

    /** Tudo que muda quando o item selecionado muda. */
    private desenharEstado(indice: number, animar: boolean): void {
        const lay = this.layout;
        const atual = this.pontos[indice];
        const duracao = animar ? DUR : 0;

        const corAlca = this.config.slider.usarCorDaCategoria.value
            ? atual.cor
            : this.config.slider.corAlca.value.value;

        this.alca.interrupt()
            .transition().duration(duracao)
            .attr("transform", "translate(" + this.posX(indice) + ", " + lay.y + ")");

        this.trilhoAtivo.interrupt()
            .transition().duration(duracao)
            .attr("x2", this.posX(indice));

        this.halo.attr("fill", corAlca);
        this.anel.attr("stroke", corAlca);

        this.camadaMarcas.selectAll<SVGCircleElement, Ponto>("circle.marca")
            .classed("percorrido", d => d.pos <= indice)
            .attr("fill", d => d.pos <= indice ? lay.corDestaque : lay.corMarcador);

        this.camadaRotulos.selectAll<SVGTextElement, Ponto>("text.rotulo")
            .classed("selecionado", d => lay.destacarRotulo && d.pos === indice);

        const escala = (lay.raio * 1.7 * lay.escalaIcone) / VB;
        this.grupoIcone
            .attr("transform",
                "translate(" + (-VB / 2 * escala) + ", " + (-VB / 2 * escala) + ") scale(" + escala + ")")
            .style("color", corAlca);

        // so remonta quando o desenho muda de fato, senao as animacoes reiniciam a cada update
        if (this.iconeDesenhado !== atual.icone) {
            this.iconeDesenhado = atual.icone;
            this.grupoIcone.selectAll("*").remove();
            this.grupoIcone.node().appendChild(nosDoIcone(atual.icone));
        }
    }

    // ------------------------------------------------------------------
    // interacao
    // ------------------------------------------------------------------

    private ligarInteracoes(): void {
        const lay = this.layout;

        this.alca.call(
            d3.drag<SVGGElement, unknown>()
                .on("start", () => {
                    this.alca.classed("arrastando", true);
                })
                .on("drag", (evento: d3.D3DragEvent<SVGGElement, unknown, unknown>) => {
                    const x = limitar(evento.x, lay.esq, lay.dir);
                    this.alca.interrupt().attr("transform", "translate(" + x + ", " + lay.y + ")");
                    this.trilhoAtivo.interrupt().attr("x2", x);
                })
                .on("end", (evento: d3.D3DragEvent<SVGGElement, unknown, unknown>) => {
                    this.alca.classed("arrastando", false);
                    this.aplicar(this.maisProximo(limitar(evento.x, lay.esq, lay.dir)));
                })
        );

        this.camadaMarcas.selectAll<SVGCircleElement, Ponto>("circle.marca")
            .on("click", (evento: MouseEvent, d: Ponto) => this.aplicar(d.pos));

        this.camadaRotulos.selectAll<SVGTextElement, Ponto>("text.rotulo")
            .on("click", (evento: MouseEvent, d: Ponto) => this.aplicar(d.pos));
    }

    private aplicar(indice: number): void {
        if (indice < 0 || indice >= this.pontos.length) {
            return;
        }

        this.chaveAtual = this.pontos[indice].chave;
        this.desenharEstado(indice, true);
        this.selectionManager.select(this.pontos[indice].id);
    }
}
