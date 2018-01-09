/* global HeadPanel, d3 */

'use strict';

/**
 * A report-böngésző konstruktora.
 * 
 * @param {Object} init Inicializáló objektum. (Valójában csak a panel oldalát tartalmazza.)
 * @param {Object} superMeta A reportokat leíró meta.
 * @param {Number} startScale A méretszorzó, amivel meg kell jeleníteni.
 * @param {Number} duration Az előtűnisi animáció időtartama.
 * @returns {HeadPanel_Browser} A report böngésző panel.
 */
function HeadPanel_Browser(init, superMeta, startScale, duration) {
    var that = this;

    this.superMeta = superMeta;

    HeadPanel.call(this, init, global.mediators[init.group], "HeadPanel_Browser", startScale, duration);

    // A keresés mező.
    that.divTableBase.append("html:input")
            .attr("type", "text")
            .attr("id", "searchP" + that.panelSide)
            .attr("placeholder", "???")
            .on("keyup", that.searchFilter);

    // Táblázat létrehozása.
    this.table = that.divTableBase.append("html:div")
            .attr("class", "tableScrollPane")
            .append("html:div")
            .attr("class", "table reportsTable")
            .attr("id", "reportsTableP" + that.panelSide);

    // Táblázat fejléce.
    var heading = that.table.append("html:div")
            .attr("class", "heading");

    heading.append("html:div")
            .attr("class", "cell")
            .text("Rövid Név");

    heading.append("html:div")
            .attr("class", "cell")
            .text("Leírás");

    heading.append("html:div")
            .attr("class", "cell")
            .text("Forrás");

    heading.append("html:div")
            .attr("class", "cell")
            .text("Frissítve");


    heading.append("html:div")
            .attr("class", "cell backgroundCell");

    that.table.selectAll(".row").data(that.superMeta)
            .enter().append("html:div")
            .attr("class", "row alterColored listener")
            .attr("parity", function(d, i) {
                return i % 2;
            })
            .on("click", function(d) {
                that.showReport(d);
            });

    // A supermetába kódolt dinamikus tartalom létrehozása.
    that.initPanel();
}

//////////////////////////////////////////////////
// Osztály-konstansok inicializálása.
//////////////////////////////////////////////////

{
    HeadPanel_Browser.prototype = global.subclassOf(HeadPanel);
}

//////////////////////////////////////////////////
// Kirajzolást segítő függvények
//////////////////////////////////////////////////

/**
 * Szűrőfunkció. Csak azokat a sorokat mutatja, amik illeszkednek a szűrőkifejezésre.
 * (Valójában a parity tulajdonságot állítja: hidden ha elrejtendő a sor,
 * 0 v 1 a kívánt színezés fejtája, váltakozva.)
 * Meghívandó amikor a szűrőmező tartalma változik.
 * 
 * @returns {undefined}
 */
HeadPanel_Browser.prototype.searchFilter = function() {
    var that = this;
    var elementId = that.id;
    var side = elementId.substr(elementId.length - 1, elementId.length);
    var val = d3.select(this).property("value").replace(/ +/g, ' ').toLowerCase().trim();
    d3.selectAll("#reportsTableP" + side + " .row")
            .attr("parity", "hidden")
            .filter(function() {
                var text = d3.select(this).property("innerText").replace(/\s+/g, ' ').toLowerCase();
                return (text.indexOf(val) !== -1);
            })
            .attr("parity", function(d, i) {
                return i % 2;
            });
};

//////////////////////////////////////////////////
// Rajzolási folyamat függvényei
//////////////////////////////////////////////////

/**
 * Feltölti a panelt a supermetában megkapott dinamikus tartalommal.
 * Nyelvváltás esetén elég ezt lefuttatni.
 * 
 * @param {Number} duration Animáció ideje.
 * @returns {undefined}
 */
HeadPanel_Browser.prototype.initPanel = function(duration) {
    
    // Elemek nyelvfüggő sorbarendezése.
    this.superMeta.sort(function(a, b) {
        return global.getFromArrayByLangArray(a.languages, a.captions).localeCompare(global.getFromArrayByLangArray(b.languages, b.captions), {sensitivity: 'variant', caseFirst: 'upper'});
    });
    
    // Adatok újratársítása, sorok letörlése.
    var row = this.table.selectAll(".row").data(this.superMeta)
            .html("");

    var tempRowCell;

    // Az első cella: report neve.
    {
        tempRowCell = row.append("html:div")
                .attr("class", "cell");

        tempRowCell.append("html:text")
                .text(function(d) {
                    return global.getFromArrayByLangArray(d.languages, d.captions);
                });

        tempRowCell.append("html:span")
                .html("&nbsp;");
    }

    // A második cella: report leírása.
    {
        tempRowCell = row.append("html:div")
                .attr("class", "cell");

        tempRowCell.append("html:text")
                .text(function(d) {
                    return global.getFromArrayByLangArray(d.languages, d.descriptions);
                });

        tempRowCell.append("html:span")
                .html("&nbsp;");
    }

    // A harmadik cella: report adatforrása.
    {
        tempRowCell = row.append("html:div")
                .attr("class", "cell");

        tempRowCell.append("html:text")
                .text(function(d) {
                    return global.getFromArrayByLangArray(d.languages, d.datasources);
                });

        tempRowCell.append("html:span")
                .html("&nbsp;");
    }

    // A negyedik cella: utolsó adatfeltöltés ideje.
    {
        tempRowCell = row.append("html:div")
                .attr("class", "cell");

        tempRowCell.append("html:text")
                .text(function(d) {
                    return (new Date(d.updated)).toLocaleString(String.locale);
                });

        tempRowCell.append("html:span")
                .html("&nbsp;");
    }

    // A háttércella.
    {
        row.append("html:div")
                .attr("class", "cell backgroundCell");
    }
};

//////////////////////////////////////////////////
// Irányítást végző függvények
//////////////////////////////////////////////////

/**
 * Report kiválasztásának kezelése.
 * 
 * @param {Object} reportMeta A kiválasztott report meta-ja.
 * @returns {undefined}
 */
HeadPanel_Browser.prototype.showReport = function(reportMeta) {
    var that = this;

    // Megöljük az eseménykezelőket.
    that.killListeners();
    that.divTableBase.select("#searchP" + that.panelSide).on("keyup", null);

    that.mediator.publish("newreport", that.panelSide, reportMeta);
};