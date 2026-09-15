"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

class CartaoBotao extends FormattingSettingsCard {
    titulo = new formattingSettings.TextInput({
        name: "titulo",
        displayName: "Título",
        value: "Categorias",
        placeholder: "Categorias"
    });

    mostrarContagem = new formattingSettings.ToggleSwitch({
        name: "mostrarContagem",
        displayName: "Mostrar contagem",
        value: true
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

    name: string = "botao";
    displayName: string = "Botão";
    slices: Array<FormattingSettingsSlice> = [this.titulo, this.mostrarContagem, this.alinhamento];
}

class CartaoPainel extends FormattingSettingsCard {
    orientacao = new formattingSettings.ItemDropdown({
        name: "orientacao",
        displayName: "Orientação",
        items: [
            { value: "linha", displayName: "Linha (chips)" },
            { value: "painel", displayName: "Painel suspenso" }
        ],
        value: { value: "linha", displayName: "Linha (chips)" }
    });

    mostrarBusca = new formattingSettings.ToggleSwitch({
        name: "mostrarBusca",
        displayName: "Mostrar busca",
        value: true
    });

    expandirTudo = new formattingSettings.ToggleSwitch({
        name: "expandirTudo",
        displayName: "Começar expandido",
        value: false
    });

    name: string = "painel";
    displayName: string = "Layout";
    slices: Array<FormattingSettingsSlice> = [
        this.orientacao, this.mostrarBusca, this.expandirTudo
    ];
}

class CartaoAparencia extends FormattingSettingsCard {
    corDestaque = new formattingSettings.ColorPicker({
        name: "corDestaque",
        displayName: "Cor do selecionado",
        value: { value: "#E07A5F" }
    });

    corChip = new formattingSettings.ColorPicker({
        name: "corChip",
        displayName: "Cor do botão",
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
        this.raio, this.tamanho, this.fonte
    ];
}

export class ConfiguracoesVisual extends FormattingSettingsModel {
    botao = new CartaoBotao();
    painel = new CartaoPainel();
    aparencia = new CartaoAparencia();

    cards = [this.botao, this.painel, this.aparencia];
}
