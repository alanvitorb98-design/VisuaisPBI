"use strict";

import powerbi from "powerbi-visuals-api";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { AdvancedFilter, IAdvancedFilter, IFilterColumnTarget } from "powerbi-models";

import { ConfiguracoesVisual } from "./settings";
import { limitar } from "../../comum/numeros";
import { montarAlvo } from "../../comum/alvo";
import {
    Periodo, Intervalo,
    inicioDoDia, fimDoDia, somarDias,
    paraCampo, doCampo, paraIsoLocal,
    calcularPeriodo, reconhecerPeriodo, ordenar
} from "../../comum/datas";
import "../style/visual.less";

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

    private raiz: HTMLElement;
    private barra: HTMLElement;
    private faixaLivre: HTMLElement;
    private campoDe: HTMLInputElement;
    private campoAte: HTMLInputElement;
    private aviso: HTMLElement;

    private alvoFiltro: IFilterColumnTarget = null;

    /** true quando o alvo foi deduzido de uma hierarquia de data automatica. */
    private viaHierarquia = false;
    private periodo: Periodo = null;
    private livre: Intervalo = null;
    private restaurado = false;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.servicoFormatacao = new FormattingSettingsService();
        this.eventos = options.host.eventService;

        this.raiz = document.createElement("div");
        this.raiz.className = "seletor-data";
        options.element.appendChild(this.raiz);

        this.barra = document.createElement("div");
        this.barra.className = "barra";
        this.raiz.appendChild(this.barra);

        this.faixaLivre = document.createElement("div");
        this.faixaLivre.className = "faixa-livre";
        this.faixaLivre.hidden = true;
        this.raiz.appendChild(this.faixaLivre);

        this.campoDe = this.criarCampo("De");
        this.campoAte = this.criarCampo("Até");

        this.aviso = document.createElement("div");
        this.aviso.className = "aviso";
        this.aviso.textContent = "Arraste o campo Data para o visual";
        this.aviso.hidden = true;
        this.raiz.appendChild(this.aviso);
    }

    private criarCampo(rotulo: string): HTMLInputElement {
        const caixa = document.createElement("label");
        caixa.className = "campo";

        const texto = document.createElement("span");
        texto.textContent = rotulo;
        caixa.appendChild(texto);

        const campo = document.createElement("input");
        campo.type = "date";
        campo.addEventListener("change", () => this.aplicarLivre());
        caixa.appendChild(campo);

        this.faixaLivre.appendChild(caixa);
        return campo;
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

        const categoria = dataView
            && dataView.categorical
            && dataView.categorical.categories
            && dataView.categorical.categories[0];

        if (!categoria) {
            this.mostrarAviso("Arraste o campo Data para o visual");
            return;
        }

        // A hierarquia vem primeiro de proposito. Arrastar um campo de data no
        // Desktop cria por padrao a hierarquia Ano/Trimestre/Mes/Dia, e o
        // nivel que chega aqui e Ano - um inteiro. Checar o tipo antes diria
        // "a coluna e Numero", culpando a coluna, quando a coluna esta certa
        // e o problema e a hierarquia no lugar dela.
        const achado = montarAlvo(categoria.source.queryName, true);
        this.alvoFiltro = achado.alvo;
        this.viaHierarquia = achado.origem === "hierarquiaData";

        if (!this.alvoFiltro) {
            this.mostrarAviso(
                "Este campo e uma hierarquia criada a mao, e nao da para deduzir "
                + "qual coluna esta por baixo. No painel de campos, clique na seta "
                + "do campo e escolha a coluna de data. Ela nao precisa ter hora."
            );
            return;
        }

        // Pela hierarquia o nivel recebido e inteiro (Ano), mas o filtro vai
        // para a coluna base, que e data. Checar o tipo aqui rejeitaria um
        // caso que funciona.
        const tipo = this.viaHierarquia ? null : categoria.source.type;

        if (tipo && !tipo.dateTime) {
            // Comparar >= e <= contra uma coluna de texto vira comparacao
            // lexicografica: "01/12/2026" < "02/01/2020". O filtro e aceito
            // e simplesmente nao seleciona o que o usuario espera.
            this.mostrarAviso(
                "A coluna precisa ser do tipo Data. Esta e do tipo "
                + this.nomeDoTipo(tipo) + ". Data sem hora serve; o que nao serve "
                + "e texto ou numero. Converta a coluna para Data no Power Query."
            );
            return;
        }

        this.aviso.hidden = true;
        this.barra.hidden = false;

        if (!this.restaurado) {
            this.restaurado = true;
            this.restaurarDoFiltro(options);
        }

        this.desenharChips();
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.servicoFormatacao.buildFormattingModel(this.config);
    }

    /** Nome legivel do tipo da coluna, para o aviso dizer o que veio. */
    private nomeDoTipo(tipo: powerbi.ValueTypeDescriptor): string {
        if (tipo.text) {
            return "Texto";
        }
        if (tipo.integer || tipo.numeric) {
            return "Numero";
        }
        if (tipo.bool) {
            return "Verdadeiro/Falso";
        }
        return "nao reconhecido";
    }

    private mostrarAviso(texto: string): void {
        this.aviso.textContent = texto;
        this.aviso.hidden = false;
        this.barra.hidden = true;
        this.faixaLivre.hidden = true;

        // zera o estado para que readicionar o campo volte a ler o filtro do
        // relatorio, em vez de reaproveitar o periodo da carga anterior
        this.barra.textContent = "";
        this.alvoFiltro = null;
        this.periodo = null;
        this.livre = null;
        this.restaurado = false;
    }

    // ------------------------------------------------------------------
    // filtro
    // ------------------------------------------------------------------

    /**
     * Le o filtro que ja esta no relatorio e descobre qual chip corresponde.
     * Sem isso, reabrir o relatorio mostraria nenhum chip aceso enquanto os
     * dados continuam filtrados.
     */
    private restaurarDoFiltro(options: VisualUpdateOptions): void {
        const filtros = options.jsonFilters;
        const filtro = (filtros && filtros.length ? filtros[0] : null) as IAdvancedFilter;

        if (!filtro || !filtro.conditions || filtro.conditions.length < 2) {
            this.periodo = this.config.periodos.padrao.value.value as Periodo;
            return;
        }

        const valores = filtro.conditions.map(c => new Date(String(c.value)));
        const de = inicioDoDia(valores[0]);
        const ate = inicioDoDia(valores[1]);

        this.livre = { de: de, ate: ate };
        this.periodo = reconhecerPeriodo(de, ate, new Date());
    }

    private aplicarFiltro(intervalo: Intervalo): void {
        if (!this.alvoFiltro) {
            return;
        }

        if (!intervalo) {
            this.host.applyJsonFilter(null, OBJETO_FILTRO, PROP_FILTRO, powerbi.FilterAction.remove);
            return;
        }

        // o fim vai para 23:59:59.999, senao o ultimo dia do intervalo fica de fora
        const filtro = new AdvancedFilter(
            this.alvoFiltro,
            "And",
            { operator: "GreaterThanOrEqual", value: paraIsoLocal(inicioDoDia(intervalo.de)) },
            { operator: "LessThanOrEqual", value: paraIsoLocal(fimDoDia(intervalo.ate)) }
        );

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
        estilo.setProperty("--alinhamento", ap.alinhamento.value.value as string);
        estilo.setProperty(
            "--gap",
            (limitar(ap.espacamento.value, 0, 30) * escala).toFixed(1) + "px"
        );

        // em visual muito baixo a faixa de datas nao cabe junto com os chips.
        // O limite acompanha a escala: com os chips maiores, sobra menos
        // altura para os campos de data.
        this.raiz.classList.toggle("apertado", altura < 86 * escala);
    }

    private desenharChips(): void {
        const cfg = this.config.periodos;
        const definicoes: { id: Periodo; texto: string; ligado: boolean }[] = [
            { id: "hoje", texto: "Hoje", ligado: cfg.hoje.value },
            { id: "sete", texto: "7 dias", ligado: cfg.sete.value },
            { id: "trinta", texto: "30 dias", ligado: cfg.trinta.value },
            { id: "mes", texto: "Mês", ligado: cfg.mes.value },
            { id: "ano", texto: "Ano", ligado: cfg.ano.value },
            { id: "tudo", texto: "Tudo", ligado: cfg.tudo.value },
            { id: "livre", texto: "Personalizado", ligado: cfg.personalizado.value }
        ];

        this.barra.textContent = "";

        for (const def of definicoes) {
            if (!def.ligado) {
                continue;
            }

            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "chip";
            chip.textContent = def.texto;
            chip.classList.toggle("ativo", this.periodo === def.id);
            chip.addEventListener("click", () => this.escolher(def.id));
            this.barra.appendChild(chip);
        }

        const mostrarCampos = this.periodo === "livre" && cfg.personalizado.value;
        this.faixaLivre.hidden = !mostrarCampos;

        if (mostrarCampos && this.livre) {
            this.campoDe.value = paraCampo(this.livre.de);
            this.campoAte.value = paraCampo(this.livre.ate);
        }
    }

    private escolher(periodo: Periodo): void {
        this.periodo = periodo;

        if (periodo === "tudo") {
            this.livre = null;
            this.aplicarFiltro(null);
        } else if (periodo === "livre") {
            // abre os campos ja preenchidos com algo plausivel
            if (!this.livre) {
                const hoje = inicioDoDia(new Date());
                this.livre = { de: somarDias(hoje, -29), ate: hoje };
            }
            this.aplicarFiltro(this.livre);
        } else {
            this.livre = calcularPeriodo(periodo, new Date());
            this.aplicarFiltro(this.livre);
        }

        this.desenharChips();
    }

    private aplicarLivre(): void {
        const de = doCampo(this.campoDe.value);
        const ate = doCampo(this.campoAte.value);

        if (!de || !ate) {
            return;
        }

        // datas invertidas viram um intervalo valido em vez de um vazio
        this.livre = ordenar(de, ate);

        this.periodo = "livre";
        this.aplicarFiltro(this.livre);
        this.desenharChips();
    }
}
