import * as d3 from "d3";
import powerbi from "powerbi-visuals-api";
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import { ICONES } from "./icones";
import "../style/visual.less";

interface Ponto {
    nome: string;
    ordem: number;
    cor: string;
    icone: string;
    id: ISelectionId;
}

const PALETA = ["#F6C453", "#F28C28", "#E07A5F", "#7B5EA7", "#2C3E70"];
const VB = 24;          // viewBox dos ícones
const PAD = 70;         // margem lateral do trilho
const RAIO_MAX = 22;

export class Visual implements powerbi.extensibility.visual.IVisual {
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private pontos: Ponto[] = [];
    private indice = 0;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();

        this.svg = d3.select(options.element)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%");
    }

    public update(options: VisualUpdateOptions): void {
        this.svg.selectAll("*").remove();

        const dv = options.dataViews?.[0];
        const cat = dv?.categorical?.categories?.[0];

        if (!cat?.values?.length) {
            this.svg.append("text")
                .attr("x", 12).attr("y", 24)
                .attr("font-size", 12).attr("fill", "#605E5C")
                .attr("font-family", "Segoe UI")
                .text("Arraste o campo Refeição para o visual");
            return;
        }

        const ordens = dv.categorical.values?.[0]?.values ?? [];

        this.pontos = cat.values
            .map((v, i) => ({
                nome: String(v),
                ordem: Number(ordens[i] ?? i),
                cor: PALETA[i % PALETA.length],
                icone: ICONES[i % ICONES.length],
                id: this.host.createSelectionIdBuilder()
                    .withCategory(cat, i)
                    .createSelectionId()
            }))
            .sort((a, b) => a.ordem - b.ordem);

        this.indice = Math.min(this.indice, this.pontos.length - 1);

        const w = options.viewport.width;
        const h = options.viewport.height;
        const y = h * 0.45;
        const raio = Math.max(10, Math.min(RAIO_MAX, h * 0.18));
        const escalaIcone = (raio * 1.85) / VB;
        const offsetRotulo = raio + 18;

        const escala = d3.scalePoint<number>()
            .domain(this.pontos.map((_, i) => i))
            .range([PAD, Math.max(PAD + 1, w - PAD)]);

        // ---------- trilho ----------
        this.svg.append("line")
            .attr("class", "trilho")
            .attr("x1", PAD).attr("x2", w - PAD)
            .attr("y1", y).attr("y2", y);

        // ---------- marcadores ----------
        this.svg.selectAll("circle.marca")
            .data(this.pontos)
            .join("circle")
            .attr("class", "marca")
            .attr("cx", (_, i) => escala(i))
            .attr("cy", y)
            .attr("r", 5);

        // ---------- rótulos ----------
        this.svg.selectAll("text.rotulo")
            .data(this.pontos)
            .join("text")
            .attr("class", "rotulo")
            .attr("x", (_, i) => escala(i))
            .attr("y", y + offsetRotulo)
            .attr("text-anchor", "middle")
            .attr("font-size", this.pontos.length > 4 ? 10 : 11)
            .text(d => d.nome);

        // ---------- alça ----------
        const atual = this.pontos[this.indice];

        const alca = this.svg.append("g")
            .attr("class", "alca")
            .attr("transform", `translate(${escala(this.indice)}, ${y})`);

        alca.append("circle")
            .attr("class", "halo")
            .attr("r", raio * 1.45)
            .attr("fill", atual.cor);

        const grupoIcone = alca.append("g")
            .attr("class", "icone-grupo")
            .attr("transform",
                `translate(${-VB / 2 * escalaIcone}, ${-VB / 2 * escalaIcone}) scale(${escalaIcone})`);

        grupoIcone.html(atual.icone);

        // ---------- drag ----------
        const encaixar = (x: number): number => {
            let melhor = 0;
            let dist = Infinity;
            this.pontos.forEach((_, i) => {
                const d = Math.abs(escala(i) - x);
                if (d < dist) { dist = d; melhor = i; }
            });
            return melhor;
        };

        const aplicar = (i: number) => {
            this.indice = i;
            const p = this.pontos[i];

            alca.transition().duration(180)
                .attr("transform", `translate(${escala(i)}, ${y})`);

            alca.select("circle.corpo").transition().duration(180).attr("fill", p.cor);
            alca.select("circle.halo").attr("fill", p.cor);
            alca.select("g.icone-grupo").html(p.icone);

            this.selectionManager.select(p.id);
        };

        alca.call(
            d3.drag<SVGGElement, unknown>()
                .on("drag", (ev) => {
                    const x = Math.max(PAD, Math.min(w - PAD, ev.x));
                    alca.attr("transform", `translate(${x}, ${y})`);
                })
                .on("end", (ev) => {
                    aplicar(encaixar(ev.x));
                })
        );

        // clicar direto num marcador também move a alça
        this.svg.selectAll("circle.marca")
            .style("cursor", "pointer")
            .on("click", (_, d: Ponto) => {
                aplicar(this.pontos.indexOf(d));
            });
    }

    public destroy(): void {
        this.selectionManager.clear();
    }
}
