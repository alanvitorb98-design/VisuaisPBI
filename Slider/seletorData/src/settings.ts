"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/** Quais chips de período aparecem, e qual vale ao abrir o relatório. */
class CartaoPeriodos extends FormattingSettingsCard {
    hoje = new formattingSettings.ToggleSwitch({
        name: "hoje", displayName: "Hoje", value: true
    });

    sete = new formattingSettings.ToggleSwitch({
        name: "sete", displayName: "Últimos 7 dias", value: true
    });

    trinta = new formattingSettings.ToggleSwitch({
        name: "trinta", displayName: "Últimos 30 dias", value: true
    });

    mes = new formattingSettings.ToggleSwitch({
        name: "mes", displayName: "Mês atual", value: true
    });

    ano = new formattingSettings.ToggleSwitch({
        name: "ano", displayName: "Ano atual", value: true
    });

    tudo = new formattingSettings.ToggleSwitch({
        name: "tudo", displayName: "Tudo", value: true
    });

    personalizado = new formattingSettings.ToggleSwitch({
        name: "personalizado", displayName: "Personalizado", value: true
    });

    padrao = new formattingSettings.ItemDropdown({
        name: "padrao",
        displayName: "Período inicial",
        items: [
            { value: "tudo", displayName: "Tudo" },
            { value: "hoje", displayName: "Hoje" },
            { value: "sete", displayName: "Últimos 7 dias" },
            { value: "trinta", displayName: "Últimos 30 dias" },
            { value: "mes", displayName: "Mês atual" },
            { value: "ano", displayName: "Ano atual" }
        ],
        value: { value: "tudo", displayName: "Tudo" }
    });

    name: string = "periodos";
    displayName: string = "Períodos";
    slices: Array<FormattingSettingsSlice> = [
        this.hoje, this.sete, this.trinta, this.mes, this.ano, this.tudo,
        this.personalizado, this.padrao
    ];
}

/** Cores, fonte e alinhamento dos chips. */
class CartaoAparencia extends FormattingSettingsCard {
    corDestaque = new formattingSettings.ColorPicker({
        name: "corDestaque",
        displayName: "Cor do selecionado",
        value: { value: "#E07A5F" }
    });

    corChip = new formattingSettings.ColorPicker({
        name: "corChip",
        displayName: "Cor do chip",
        value: { value: "#F3F2F1" }
    });

    corTexto = new formattingSettings.ColorPicker({
        name: "corTexto",
        displayName: "Cor do texto",
        value: { value: "#323130" }
    });

    raio = new formattingSettings.NumUpDown({
        name: "raio",
        displayName: "Arredondamento",
        value: 16
    });

    tamanho = new formattingSettings.NumUpDown({
        name: "tamanho",
        displayName: "Tamanho geral (%)",
        value: 100
    });

    espacamento = new formattingSettings.NumUpDown({
        name: "espacamento",
        displayName: "Espaçamento",
        value: 6
    });

    fundoTransparente = new formattingSettings.ToggleSwitch({
        name: "fundoTransparente",
        displayName: "Fundo transparente",
        value: true
    });

    corFundo = new formattingSettings.ColorPicker({
        name: "corFundo",
        displayName: "Cor do fundo",
        value: { value: "#FFFFFF" }
    });

    alinhamento = new formattingSettings.ItemDropdown({
        name: "alinhamento",
        displayName: "Alinhamento",
        items: [
            { value: "center", displayName: "Centro" },
            { value: "flex-start", displayName: "Esquerda" },
            { value: "flex-end", displayName: "Direita" }
        ],
        value: { value: "center", displayName: "Centro" }
    });

    fonte = new formattingSettings.FontControl({
        name: "fonte",
        displayName: "Fonte",
        fontFamily: new formattingSettings.FontPicker({
            name: "fontFamily",
            displayName: "Fonte",
            value: "Segoe UI, wf_standard-font, helvetica, arial, sans-serif"
        }),
        fontSize: new formattingSettings.NumUpDown({
            name: "fontSize", displayName: "Tamanho", value: 12
        }),
        bold: new formattingSettings.ToggleSwitch({
            name: "bold", displayName: "Negrito", value: false
        }),
        italic: new formattingSettings.ToggleSwitch({
            name: "italic", displayName: "Itálico", value: false
        }),
        underline: new formattingSettings.ToggleSwitch({
            name: "underline", displayName: "Sublinhado", value: false
        })
    });

    name: string = "aparencia";
    displayName: string = "Aparência";
    slices: Array<FormattingSettingsSlice> = [
        this.corDestaque, this.corChip, this.corTexto,
        this.fundoTransparente, this.corFundo,
        this.raio, this.tamanho, this.espacamento, this.alinhamento, this.fonte
    ];
}

export class ConfiguracoesVisual extends FormattingSettingsModel {
    periodos = new CartaoPeriodos();
    aparencia = new CartaoAparencia();

    cards = [this.periodos, this.aparencia];
}
