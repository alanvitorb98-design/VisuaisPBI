"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/** Trilho, marcadores e alça. */
class CartaoSlider extends FormattingSettingsCard {
    corTrilho = new formattingSettings.ColorPicker({
        name: "corTrilho",
        displayName: "Cor do trilho",
        value: { value: "#E1E1E1" }
    });

    corDestaque = new formattingSettings.ColorPicker({
        name: "corDestaque",
        displayName: "Cor do percurso ativo",
        value: { value: "#F28C28" }
    });

    corMarcador = new formattingSettings.ColorPicker({
        name: "corMarcador",
        displayName: "Cor dos marcadores",
        value: { value: "#BDBDBD" }
    });

    espessuraTrilho = new formattingSettings.NumUpDown({
        name: "espessuraTrilho",
        displayName: "Espessura do trilho",
        value: 6
    });

    raioAlca = new formattingSettings.NumUpDown({
        name: "raioAlca",
        displayName: "Raio da alça",
        value: 22
    });

    usarCorDaCategoria = new formattingSettings.ToggleSwitch({
        name: "usarCorDaCategoria",
        displayName: "Usar cor da categoria",
        value: true
    });

    corAlca = new formattingSettings.ColorPicker({
        name: "corAlca",
        displayName: "Cor da alça",
        value: { value: "#F28C28" }
    });

    mostrarMarcadores = new formattingSettings.ToggleSwitch({
        name: "mostrarMarcadores",
        displayName: "Mostrar marcadores",
        value: true
    });

    discoTransparente = new formattingSettings.ToggleSwitch({
        name: "discoTransparente",
        displayName: "Disco da alça transparente",
        value: false
    });

    corDisco = new formattingSettings.ColorPicker({
        name: "corDisco",
        displayName: "Cor do disco da alça",
        value: { value: "#FFFFFF" }
    });

    mostrarLimpar = new formattingSettings.ToggleSwitch({
        name: "mostrarLimpar",
        displayName: "Mostrar botão limpar",
        value: true
    });

    name: string = "slider";
    displayName: string = "Trilho e alça";
    slices: Array<FormattingSettingsSlice> = [
        this.corTrilho,
        this.corDestaque,
        this.mostrarMarcadores,
        this.corMarcador,
        this.espessuraTrilho,
        this.raioAlca,
        this.usarCorDaCategoria,
        this.corAlca,
        this.discoTransparente,
        this.corDisco,
        this.mostrarLimpar
    ];
}

/** Texto abaixo de cada marcador. */
class CartaoRotulos extends FormattingSettingsCard {
    mostrar = new formattingSettings.ToggleSwitch({
        name: "mostrar",
        displayName: "Mostrar",
        value: true
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
            name: "fontSize",
            displayName: "Tamanho",
            value: 11
        }),
        bold: new formattingSettings.ToggleSwitch({
            name: "bold",
            displayName: "Negrito",
            value: false
        }),
        italic: new formattingSettings.ToggleSwitch({
            name: "italic",
            displayName: "Itálico",
            value: false
        }),
        underline: new formattingSettings.ToggleSwitch({
            name: "underline",
            displayName: "Sublinhado",
            value: false
        })
    });

    cor = new formattingSettings.ColorPicker({
        name: "cor",
        displayName: "Cor",
        value: { value: "#605E5C" }
    });

    destacarSelecionado = new formattingSettings.ToggleSwitch({
        name: "destacarSelecionado",
        displayName: "Destacar o selecionado",
        value: true
    });

    name: string = "rotulos";
    displayName: string = "Rótulos";
    topLevelSlice: formattingSettings.ToggleSwitch = this.mostrar;
    slices: Array<FormattingSettingsSlice> = [this.fonte, this.cor, this.destacarSelecionado];
}

/** Ícone desenhado dentro da alça. */
class CartaoIcone extends FormattingSettingsCard {
    mostrar = new formattingSettings.ToggleSwitch({
        name: "mostrar",
        displayName: "Mostrar",
        value: true
    });

    escala = new formattingSettings.NumUpDown({
        name: "escala",
        displayName: "Escala",
        value: 100
    });

    animar = new formattingSettings.ToggleSwitch({
        name: "animar",
        displayName: "Animar ao passar o mouse",
        value: true
    });

    name: string = "icone";
    displayName: string = "Ícone";
    topLevelSlice: formattingSettings.ToggleSwitch = this.mostrar;
    slices: Array<FormattingSettingsSlice> = [this.escala, this.animar];
}

/** Modelo completo de formatação do visual. */
export class ConfiguracoesVisual extends FormattingSettingsModel {
    slider = new CartaoSlider();
    rotulos = new CartaoRotulos();
    icone = new CartaoIcone();

    cards = [this.slider, this.rotulos, this.icone];
}
