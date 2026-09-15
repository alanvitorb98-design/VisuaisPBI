"use strict";

import powerbi from "powerbi-visuals-api";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { AdvancedFilter, IAdvancedFilter, IFilterColumnTarget } from "powerbi-models";

import { ConfiguracoesVisual } from "./settings";
import "../style/visual.less";

const OBJETO_FILTRO = "geral";
const PROP_FILTRO = "filtro";

/** Identificador de cada chip. "livre" e o intervalo digitado a mao. */
type Periodo = "hoje" | "sete" | "trinta" | "mes" | "ano" | "tudo" | "livre";

interface Intervalo {
    de: Date;
    ate: Date;
}

function inicioDoDia(base: Date): Date {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
}

function fimDoDia(base: Date): Date {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
}

function somarDias(base: Date, dias: number): Date {
    const copia = new Date(base.getTime());
    copia.setDate(copia.getDate() + dias);
    return copia;
}

/** "2026-09-15", no fuso local - toISOString converteria para UTC e podia pular um dia. */
function paraCampo(data: Date): string {
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return data.getFullYear() + "-" + mes + "-" + dia;
}

/**
 * "2026-09-15T00:00:00.000", montado a partir dos componentes locais e SEM o
 * sufixo Z.
 *
 * toISOString devolveria o mesmo instante em UTC: num fuso UTC-3 o inicio do
 * dia local vira 03:00Z. As datas do modelo semantico nao tem fuso, entao a
 * condicao ">= 03:00" descarta as linhas gravadas em 00:00 e o dia inteiro
 * fica de fora do filtro.
 */
function paraIsoLocal(data: Date): string {
    const dois = (n: number) => String(n).padStart(2, "0");
    return data.getFullYear()
        + "-" + dois(data.getMonth() + 1)
        + "-" + dois(data.getDate())
        + "T" + dois(data.getHours())
        + ":" + dois(data.getMinutes())
        + ":" + dois(data.getSeconds())
        + "." + String(data.getMilliseconds()).padStart(3, "0");
}

function doCampo(texto: string): Date {
    const partes = texto.split("-").map(Number);
    if (partes.length !== 3 || partes.some(isNaN)) {
        return null;
    }
    return new Date(partes[0], partes[1] - 1, partes[2]);
}

function mesmoDia(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

export class Visual implements powerbi.extensibility.visual.IVisual {
    private host: IVisualHost;
    private servicoFormatacao: FormattingSettingsService;
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

    public update(options: VisualUpdateOptions): void {
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
        this.alvoFiltro = this.montarAlvo(categoria.source);

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
     * Alvo do filtro no modelo semantico.
     *
     * O nome da coluna sai do queryName ("Tabela.Coluna"), nunca do
     * displayName: displayName e o rotulo exibido, que o usuario pode
     * renomear no painel de campos. Renomeado, o filtro apontaria para uma
     * coluna inexistente e o Power BI o descartaria sem avisar.
     *
     * queryName com mais de um ponto e hierarquia de data (Ano/Trimestre/
     * Mes/Dia). Nao da para filtrar intervalo sobre ela, entao devolve nulo
     * e o visual explica o que fazer.
     */
    private montarAlvo(fonte: powerbi.DataViewMetadataColumn): IFilterColumnTarget {
        const partes = (fonte.queryName || "").split(".");

        if (!partes[0] || !partes[1]) {
            return null;
        }

        // Tabela.Coluna - o campo foi arrastado como coluna
        if (partes.length === 2) {
            this.viaHierarquia = false;
            return { table: partes[0], column: partes[1] };
        }

        // Tabela.Coluna.Variacao.Hierarquia.Nivel - hierarquia de data
        // automatica do Power BI. O nivel que chega aqui e Ano, mas a coluna
        // base e a segunda parte, entao da para filtrar nela mesmo assim.
        if (partes.length === 5) {
            this.viaHierarquia = true;
            return { table: partes[0], column: partes[1] };
        }

        // hierarquia definida a mao: partes[1] e o nome da hierarquia, nao de
        // uma coluna, e nao ha como deduzir qual coluna esta por baixo
        return null;
    }

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
        this.periodo = this.reconhecer(de, ate);
    }

    /** Compara o intervalo vindo do relatorio com cada preset. */
    private reconhecer(de: Date, ate: Date): Periodo {
        const candidatos: Periodo[] = ["hoje", "sete", "trinta", "mes", "ano"];
        for (const nome of candidatos) {
            const faixa = this.calcular(nome);
            if (faixa && mesmoDia(faixa.de, de) && mesmoDia(faixa.ate, ate)) {
                return nome;
            }
        }
        return "livre";
    }

    /** Todos os presets sao relativos a hoje, entao nao precisam varrer a coluna. */
    private calcular(periodo: Periodo): Intervalo {
        const hoje = inicioDoDia(new Date());

        switch (periodo) {
            case "hoje":
                return { de: hoje, ate: hoje };
            case "sete":
                return { de: somarDias(hoje, -6), ate: hoje };
            case "trinta":
                return { de: somarDias(hoje, -29), ate: hoje };
            case "mes":
                return { de: new Date(hoje.getFullYear(), hoje.getMonth(), 1), ate: hoje };
            case "ano":
                return { de: new Date(hoje.getFullYear(), 0, 1), ate: hoje };
            default:
                return null;
        }
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
        const escala = Math.max(50, Math.min(ap.tamanho.value, 300)) / 100;
        const fonteBase = Math.max(6, Math.min(ap.fonte.fontSize.value, 32));

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
            (Math.max(0, Math.min(ap.raio.value, 40)) * escala).toFixed(1) + "px"
        );
        estilo.setProperty("--alinhamento", ap.alinhamento.value.value as string);
        estilo.setProperty(
            "--gap",
            (Math.max(0, Math.min(ap.espacamento.value, 30)) * escala).toFixed(1) + "px"
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
            this.livre = this.calcular(periodo);
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

        // datas invertidas: troca em vez de aplicar um intervalo vazio
        this.livre = de.getTime() <= ate.getTime()
            ? { de: de, ate: ate }
            : { de: ate, ate: de };

        this.periodo = "livre";
        this.aplicarFiltro(this.livre);
        this.desenharChips();
    }
}
