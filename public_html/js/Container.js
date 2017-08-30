/* global d3, version, LZString, URL */

'use strict';

/**
 * Az adatlekérdezőt tartalmazó konténer konstruktora.
 * A sikeres belépés után kell példányosítani.
 * 
 * @returns {Container}
 */
function Container() {
    this.dataDirector = [];
    var that = this;

    var topdiv = d3.select("body").append("html:div")
            .attr("id", "topdiv");

    // Toolbar div-je.
    this.mainToolbar = topdiv.append("html:div")
            .attr("class", "mainToolbar")
            .attr("id", "mainToolbar");

    $("#mainToolbar").load("mainToolbar.html?ver=" + version);

    // Progress-réteg.
    topdiv.append("html:div")
            .attr("id", "progressDiv");

    for (var i = 0; i < 2; i++) {
        var container = topdiv.append("html:div")
                .attr("id", "scrollPaneP" + i)
                .append("html:div")
                .attr("id", "cutter" + i)
                .append("html:div")
                .attr("id", "container" + i)
                .attr("class", "container")
                .style(global.getStyleForScale(1, 0, 0));

        container.append("html:div").attr("id", "headPanelP" + i)
                .attr("class", "panel double");

    }
    d3.select("#container0").classed("activeSide", true);

    this.isSideInUse = [];	// True, ha a panel használatban van, false ha alapállapotban.

    // Az átméretezéskor lefutó függvény eseménykezelője.
    $(window).resize(function() {
        that.onResize();
    });

    var bodyWidth = parseInt(d3.select("#topdiv").style("width"));
    global.panelNumberOnScreen = parseInt((bodyWidth / global.panelWidth) + 0.5);
    this.panelState = 0; // 0: baloldal, 1: mindkettő, 2: jobboldal, 3: mindkettő látszik.
    this.resizeInProgress = false; // Hogy ne induljon egyszerre 2 resize event.

    // Reportmeták betöltése, és a böngésző inicializálása.
    global.initGlobals(function() {
        that.initSide(0);
        that.initSide(1);
        that.onResize();

        // A riportokat tartalmazó táblázat magasságának kiszámolásához...
        that.tableBaseOffset =
                parseInt(d3.select("#headPanelP0").style("margin-top")) +
                parseInt(d3.select("#headPanelP0").style("margin-bottom")) +
                parseInt(d3.select("#searchP0").style("margin-top")) +
                parseInt(d3.select("#searchP0").style("margin-bottom")) +
                parseInt(d3.select("#searchP0").style("height")) +
                parseInt(d3.select(".divTableBase").style("margin-bottom")) +
                parseInt(d3.select(".tableScrollPane").style("padding-top")) +
                parseInt(d3.select(".tableScrollPane").style("padding-bottom"));

        // Ha a bookmarkba van kódolva valami, annak megfelelően indítunk.
        var startString = location.href.split("#")[1];
        if (startString) {
            try {
                var startObject = JSON.parse(LZString.decompressFromEncodedURIComponent(startString));
                that.navigateTo(startObject);
            } catch (e) {
                console.err("A bookmarkban hivatkozott objektum sérült, dekódolni nem lehet.");
            }
        }
    });

}

/**
 * Oldalváltást végrehajtó függvény.
 * 
 * @returns {undefined}
 */
Container.prototype.switchPanels = function() {
    this.panelState = (this.panelState + 1) % 4;
    var newSize = Math.abs((this.panelState / 2) - 1);
    this.resizeContainers(global.selfDuration, newSize, false, false, true, global.panelNumberOnScreen);
    d3.select("#container0").classed("activeSide", (this.panelState !== 2));
    d3.select("#container1").classed("activeSide", (this.panelState !== 0));
    global.mainToolbar_refreshState();
};

/**
 * Nagyítást végrehajtó függvény.
 * 
 * @param {Integer} direction 1: Egyel több panelt akarunk látni; -1: egyel kevesebbet.
 * @returns {undefined}
 */
Container.prototype.magnify = function(direction) {
    global.panelNumberOnScreen = Math.min(global.maxPanelCount, Math.max(1, global.panelNumberOnScreen + direction));
    global.mainToolbar_refreshState();
    this.onResize(global.panelNumberOnScreen);
};

/**
 * A böngészőablak átméretezése után átméretez mindent, hogy épp egész számú
 * panel férjen ki a képernyőre.
 * 
 * @param {Integer} panelsPerScreen A képernyőre vízszintesen kirakandó panelek száma.
 * @returns {undefined}
 */
Container.prototype.onResize = function(panelsPerScreen) {
    if (panelsPerScreen === undefined || panelsPerScreen < 0) {
        panelsPerScreen = global.panelNumberOnScreen;
    }
    var newSize = Math.abs((this.panelState / 2) - 1);
    this.resizeContainers(global.selfDuration, newSize, false, true, false, panelsPerScreen);
};

/**
 * Mindkét oldalt animálva átméretezi.
 * 
 * @param {Number} duration Az átméretezés ideje (ms).
 * @param {Number} container0SizePercentage A bal oldali konténer relatív mérete: 0, 0.5 vagy 1.
 * @param {Boolean} isAdjust Csak a scrollbar esetleges eltűnése utáni apró igazításról van szó?
 * @param {Boolean} isResize A képernyő átméretezése miatt van szükség átméretezésre?
 * @param {Boolean} isSplit Osztott képrenyős üzemmódban vagyunk?
 * @param {Integer} panelsPerRow Ennyi panelnek kell egy sorba kiférnie.
 * @returns {undefined}
 */
Container.prototype.resizeContainers = function(duration, container0SizePercentage, isAdjust, isResize, isSplit, panelsPerRow) {
    var that = this;
    if (!that.resizeInProgress) {
        that.resizeInProgress = true;
        setTimeout(function() {
            that.resizeInProgress = false;
        }, 50);
        that.resizeContainer(0, duration, container0SizePercentage, isAdjust, isResize, isSplit, panelsPerRow);
        that.resizeContainer(1, duration, 1 - container0SizePercentage, isAdjust, isResize, isSplit, panelsPerRow);
    }
};

/**
 * Az egyik oldalt animálva átméretezi.
 * 
 * @param {Integer} side A kérdéses oldal.
 * @param {Number} duration Az átméretezés ideje (ms).
 * @param {Number} sizePercentage Az oldal a képernyő mennyied részét tölti ki? (0, 0.5, 1)
 * @param {Boolean} isAdjust Csak a scrollbar esetleges eltűnése utáni apró igazításról van szó?
 * @param {Boolean} isResize A képernyő átméretezése miatt van szükség átméretezésre?
 * @param {Boolean} isSplit Osztott képrenyős üzemmódban vagyunk?
 * @param {Integer} panelsPerRow Ennyi panelnek kell egy sorba kiférnie.
 * @returns {undefined}
 */
Container.prototype.resizeContainer = function(side, duration, sizePercentage, isAdjust, isResize, isSplit, panelsPerRow) {
    var that = this;

    var bodyWidth = parseInt(d3.select("#topdiv").style("width"));
    var bodyHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    var scrollWidth = 0;
    if (isResize) {
        d3.select("#scrollPaneP" + side)
                .style("width", (bodyWidth * sizePercentage) + "px");
        scrollWidth = parseInt(document.getElementById("scrollPaneP" + side).clientWidth);
    }

    if (isSplit) {
        d3.select("#scrollPaneP" + side).transition().duration(duration)
                .style("width", (bodyWidth * sizePercentage) + "px");
        scrollWidth = bodyWidth * sizePercentage;
    }

    if (isAdjust) {
        scrollWidth = parseInt(document.getElementById("scrollPaneP" + side).clientWidth);
    }

    var panelMargin = parseInt($(".panel").css("margin-top")) + parseInt($(".panel").css("border-top-width"));
    var panelRealWidth = global.panelWidth + 2 * panelMargin; // Egy panel ténylegesen ennyi pixelt folgalna el nagyítás nélkül.

    var panelNumberPerRow = Math.max(parseInt(scrollWidth / panelRealWidth), 1); // A vízszintesen elférő panelek száma.

    if (panelsPerRow > 0) {
        panelNumberPerRow = panelsPerRow;
    } else {
        if (sizePercentage > 0) {
            global.panelNumberOnScreen = panelNumberPerRow / sizePercentage;
        }
    }

    var scaleRatio = scrollWidth / (panelNumberPerRow * panelRealWidth); // Ennyiszeresére kell nagyítani.

    // A headpanel mostani, és a számára elérendő magasság meghatározása.	
    d3.select("#scrollPaneP" + side + " .HeadPanel_Browser .tableScrollPane")
            .style("max-height", Math.max(100, parseInt(((bodyHeight - global.mainToolbarHeight) / scaleRatio) - this.tableBaseOffset)) + "px");

    d3.select("body").style("width", null);

    // Az átméretezés után meghívandó függvény: finom átméretezés a scrollbarok esetleges megjelenése miatt.
    var callback = function() {
        if (!isAdjust) {
            that.resizeContainer(side, duration / 10, sizePercentage, true, false, false, panelNumberPerRow);
        } else if (duration !== 0) {
            that.resizeContainer(side, 0, sizePercentage, true, false, false, panelNumberPerRow);
        }

    };

    // Finom átméretezés a scrollbarok esetleges megjelenése miatt.
    if (global.mediators[0]) {
        global.mediators[side].publish("resize", duration, panelNumberPerRow, scaleRatio, callback);
    }

    d3.select("#container" + side).transition().duration(duration)
            .style({"width": parseInt((scrollWidth / scaleRatio) + 20) + "px"})
            .style(global.getStyleForScale(scaleRatio, 0, 0));

    // A vágólap mérete, hogy ne lógjon túl IE-ben.
    if (isAdjust) {
        var cutterHeight = parseInt(d3.select("#container" + side).style("height")) * scaleRatio;
        d3.select("#cutter" + side).transition().duration(duration).style("height", cutterHeight + "px");
    } else {
        d3.select("#cutter" + side).style("height", "100%");
    }

    if (scaleRatio > 0) {
        global.scaleRatio = scaleRatio;
    }
};

/**
 * Új report kiválasztása.
 * 
 * @param {Integer} side Erre az oldalra.
 * @param {Object} reportSuperMeta A report superMetája.
 * @param {Object} startObject a kezdetben megnyitandó report.
 * @returns {undefined}
 */
Container.prototype.newReport = function(side, reportSuperMeta, startObject) {
    global.mediators[side].remove("killListeners");
    this.isSideInUse[side] = true;
    global.facts[side] = new Fact(reportSuperMeta, side, this.newReportReady, startObject);
};

/**
 * Előre beállított helyről indítja az előre beállított reportot.
 * 
 * @param {Object} startObject Az indulási helyet leíró objektum.
 * @returns {undefined}
 */
Container.prototype.navigateTo = function(startObject) {

    // A 0-ás és az 1-es oldalban megnyitandó report szétválogatása és meghívása
    for (var side = 0; side < 2; side++) {
        var sideInit = startObject.p[side];
        if (sideInit.v) {
            var reportMeta = global.getFromArrayByProperty(global.superMeta, 'name', sideInit.c); // A reporthoz tartozó meta.
            sideInit.v = global.minifyInits(sideInit.v, true).split(';'); // A panelek indító konstruktorai.
            this.newReport(side, reportMeta, sideInit);
        }
    }

    // 1 vagy 2 oldalas nézet beállítása
    if (startObject.d !== 0) {
        global.mediators[0].publish("changepanels");
        if (startObject.d === 1) {
            global.mediators[0].publish("changepanels");
        }
    }
};

/**
 * Az új report adatbázisból való betöltése után létrehozza a report elemzőfelületét.
 * Létrehozza a metában kért paneleket is.
 * 
 * @param {Integer} side Erre az oldalra.
 * @param {Object} reportMeta Az új report metája.
 * @returns {undefined}
 */
Container.prototype.newReportReady = function(side, reportMeta) {

    // Megjelenítés a meta alapján
    for (var i = 0, iMax = reportMeta.visualization.length; i < iMax; i++) {
        // De előbb a megfelelő oldalra kell hozni...
        var initString = reportMeta.visualization[i].toLowerCase();
        if (initString.indexOf("})") > -1) {
            initString = initString.replace("})", ", group: " + side + "})");
            initString = initString.replace("({, ", "({");
        } else if (initString.indexOf("()") > -1) {
            initString = initString.replace("()", "({group: " + side + "})");
        } else {
            initString = "";
        }
        eval("new " + initString);
    }

    global.mediators[side].publish("killPanel", "#panel" + side + "P-1");	// Esetleges régi fejlécpanel megölése.
    new HeadPanel_Report({group: side}, reportMeta);						// Fejlécpanel létrehozása.
    global.mediators[side].publish("drill", {dim: -1, direction: 0});		// Kezdeti belefúrás.
    global.mainToolbar_refreshState();										// A toolbar kiszürkültségi állapotának felfrissítése.
};

/**
 * Az egyik, pillanatnyilag nem létező oldalt inicializálja: feliratkozik a mediátorokra,
 * regisztrálja az adatrendezőt, elindítja a report-böngészőt.
 * 
 * @param {Integer} side Az inicializálandó oldal.
 * @returns {undefined}
 */
Container.prototype.initSide = function(side) {
    var that = this;

    if (global.mediators === undefined || global.mediators[side] === undefined) {
        global.mediators[side] = new Mediator();
    }

    global.mediators[side].subscribe("newreport", function(side, reportId) {
        that.newReport(side, reportId);
    });
    global.mediators[side].subscribe("changepanels", function(side) {
        that.switchPanels(side);
    });
    global.mediators[side].subscribe("killside", function(side) {
        that.killSide(side);
    });
    global.mediators[side].subscribe("magnify", function(direction) {
        that.magnify(direction);
    });
    global.mediators[side].subscribe("addPanel", function(panelType) {
        that.addPanel(side, panelType);
    });
    global.mediators[side].subscribe("save", function() {
        that.save(side);
    });

    that.isSideInUse[side] = false;
    new Draglayer(side, global.mediators[side]);

    new HeadPanel_Browser({group: side}, global.superMeta);						// Fejléc.
    this.dataDirector[side] = new DataDirector(side, global.mediators[side]);	// Adatrendező.
};

/**
 * Megöli, és alaphelyzetbe hozza az egyik böngészőoldalt.
 * 
 * @param {Integer} side A kérdéses oldal.
 * @returns {undefined}
 */
Container.prototype.killSide = function(side) {
    if (this.panelState / 2 === side && this.isSideInUse[side]) {
        global.mediators[side].publish("killListeners");
        global.mediators[side].publish("killPanel", undefined);

        global.mediators[side].remove("changeValue");
        global.mediators[side].remove("changeDimension");
        global.mediators[side].remove("changepanels");
        global.mediators[side].remove("drill");
        global.mediators[side].remove("killside");
        global.mediators[side].remove("newreport");
        global.mediators[side].remove("killListeners");
        global.mediators[side].remove("killPanel");
        global.mediators[side].remove("resize");
        global.mediators[side].remove("magnify");
        global.mediators[side].remove("register");
        global.mediators[side].remove("addDrag");
        global.mediators[side].remove("addPanel");
        global.mediators[side].remove("getConfig");
        global.mediators[side].remove("save");

        global.baseLevels[side] = [];

        global.facts[side] = null;
        this.dataDirector[side] = undefined;
        this.initSide(side);
        this.onResize();
        global.mainToolbar_refreshState();
    }
};

/**
 * Új panel hozzáadása a felülethez.
 * 
 * @param {Integer} side A hozzáadást kérő oldal.
 * @param {String} panelType A hozzáadandó panel névkódja.
 * @returns {undefined}
 */
Container.prototype.addPanel = function(side, panelType) {
    if (this.panelState / 2 === side && this.isSideInUse[side]) {
        var firstFreeId = this.dataDirector[side].getFirstFreeIndex();
        var guessedDim = this.dataDirector[side].guessDimension();
        if (firstFreeId >= 0) {
            switch (panelType) {
                case 'piechartpanel':
                    new panel_pie({group: side, position: firstFreeId, dim: guessedDim});
                    break;
                case 'mappanel':
                    new panel_map({group: side, position: firstFreeId, dim: guessedDim, poi: false});
                    break;
                case 'poimappanel':
                    new panel_map({group: side, position: firstFreeId, dim: guessedDim, poi: true});
                    break;
                case 'barpanel':
                    new panel_barline({group: side, position: firstFreeId, dim: guessedDim});
                    break;
                case 'strechedbarpanel':
                    new panel_barline({group: side, position: firstFreeId, streched: true, valbars: [0], dim: guessedDim});
                    break;
                case 'linepanel':
                    new panel_barline({group: side, position: firstFreeId, valbars: [], vallines: [0], dim: guessedDim});
                    break;
                case 'markedlinepanel':
                    new panel_barline({group: side, position: firstFreeId, valbars: [], vallines: [0], symbols: true, dim: guessedDim});
                    break;
                case 'bar2panel':
                    new panel_bar2d({group: side, position: firstFreeId, dimx: guessedDim, dimy: this.dataDirector[side].guessDimension(guessedDim)});
                    break;
                case 'strechedbar2panel':
                    new panel_bar2d({group: side, position: firstFreeId, dimx: guessedDim, dimy: this.dataDirector[side].guessDimension(guessedDim), streched: true});
                    break;
                case 'horizontalbarpanel':
                    new panel_horizontalbar({group: side, position: firstFreeId, centered: false, dim: guessedDim});
                    break;
                case 'fixedhorizontalbarpanel':
                    new panel_horizontalbar({group: side, position: firstFreeId, centered: true, dim: guessedDim});
                    break;
                case 'Panel_Table1D':
                    new panel_table1d({group: side, position: firstFreeId, dim: guessedDim});
                    break;
                case 'Panel_Table2D':
                    new panel_table2d({group: side, position: firstFreeId, dimr: guessedDim, dimc: this.dataDirector[side].guessDimension(guessedDim)});
                    break;
                case 'top10Barpanel' :
                    new panel_barline({group: side, position: firstFreeId, dim: guessedDim, top10: true});
                    break;
                case 'top10Linepanel' :
                    new panel_barline({group: side, position: firstFreeId, valbars: [], vallines: [0], dim: guessedDim, symbols: true, top10: true});
                    break;
            }
        }
        global.mainToolbar_refreshState();
        global.mediators[side].publish("drill", {dim: -1, direction: 0});
    }
};

/**
 * Adatok csv-be való mentését intézi. Feldob egy párbeszédablakot,
 * amelyben ki lehet választani az alábontandó dimenziókat.
 * 
 * @param {Integer} side A kérést leadó oldal.
 * @returns {undefined}
 */
Container.prototype.save = function(side) {
    var that = this;
    if (this.panelState / 2 === side && this.isSideInUse[side]) {
        var str = "";
        for (var d = 0, dMax = global.facts[side].reportMeta.dimensions.length; d < dMax; d++) {
            str = str + "<input class = 'saveCheckBox' type='checkbox' checked/>" + global.facts[side].reportMeta.dimensions[d].caption + "<br>";
        }

        global.setDialog(
                "Adatok mentése CSV-ként",
                "<div class='saveStaticText'>Az alábbi dimenziókat alábontva:</div>" +
                "<div class='saveVariableText'>" + str + "</div>",
                "Mégse",
                function() {
                    global.setDialog();
                },
                "Mentés",
                function() {
                    var requestedDims = [];
                    var checkBoxes = document.getElementsByClassName("saveCheckBox");
                    for (var c = 0, cMax = checkBoxes.length; c < cMax; c++) {
                        requestedDims.push((checkBoxes[c].checked) ? 1 : 0);
                    }
                    that.saveAsCsv(side, requestedDims);
                }
        );
    }
};

/**
 * Kimenti az adatokat csv-be.
 * 
 * @param {Integer} side A kérést leadó oldal.
 * @param {Array} requestedDims Az alábontandó dimenziókat 1-el jelölő tömb.
 * @returns {undefined}
 */
Container.prototype.saveAsCsv = function(side, requestedDims) {
    var meta = global.facts[side].reportMeta;
    var baseLevels = global.baseLevels[side];

    // A csv fejléce: Report neve, dimenziók lefúrási szintje.
    var headerString = "\"" + meta.caption + "\"\n\n";
    headerString += "\"Lefúrási szint:\"";
    for (var i = 0, iMax = baseLevels.length; i < iMax; i++) {
        var baseDim = baseLevels[i];
        headerString += ",\"" + meta.dimensions[i].caption + ":\",\"" + ((baseDim.length === 0) ? meta.dimensions[i].top_level_caption : baseDim[baseDim.length - 1].name) + "\"\n";
    }

    // A lekérdezés összeállítása.
    var baseLevelQueryString = "";
    var separator0 = "";
    for (var d = 0, dMax = baseLevels.length; d < dMax; d++) {
        var separator1 = "";
        baseLevelQueryString += separator0;
        for (var l = 0, lMax = baseLevels[d].length; l < lMax; l++) {
            baseLevelQueryString += separator1 + (baseLevels[d])[l].id;
            separator1 = ",";
        }
        separator0 = ":";
    }
    var query = meta.cube_unique_name + ";" + baseLevelQueryString + ";" + requestedDims.toString().replace(/,/g, ":");
    var encodedQuery = "queries=" + window.btoa(query);

    // Adatok letöltése, és a belőlük származó csv-törzs összerakása.
    global.get(global.url.fact, encodedQuery, function(resultJson) {
        var result = resultJson;

        // Dimenziók fejlécének hozzáadása.
        var resultString = "";
        var separator = "";
        for (var i = 0, iMax = baseLevels.length; i < iMax; i++) {
            if (requestedDims[i] === 1) {
                resultString += separator + "\"" + meta.dimensions[i].caption + "\"";
                separator = ",";
            }
        }

        // Értékek fejlécének hozzáadása.
        for (var v = 0, vMax = meta.indicators.length; v < vMax; v++) {
            var valueHeader = (meta.indicators[v].value.hide) ? "\"Nem értelmezett\"" : "\"" + (meta.indicators[v].caption + " (" + meta.indicators[v].value.unit + ")\"");
            var ratioHeader = (meta.indicators[v].fraction.hide) ? "\"Nem értelmezett\"" : "\"" + (meta.indicators[v].caption + " (" + meta.indicators[v].fraction.unit + ")\"");
            resultString += separator + valueHeader + "," + ratioHeader;
            separator = ",";
        }
        resultString = resultString + "\n";

        // Az értékekhez tartozó hányados-szorzó tömbbe kiszedése.
        var valMultipliers = [];
        for (var v = 0, vMax = meta.indicators.length; v < vMax; v++) {
            valMultipliers.push((isNaN(parseFloat(meta.indicators[v].fraction.multiplier))) ? 1 : parseFloat(meta.indicators[v].fraction.multiplier));
        }

        // Az eredmény feldolgozása soronként.
        for (var r = 0, rMax = result[0].response.rows.length; r < rMax; r++) {
            var row = result[0].response.rows[r];
            var resultline = "";

            // Dimenziók beírása a sorba.
            var separator = "";
            for (var d = 0, dMax = row.dims.length; d < dMax; d++) {
                resultline += separator + '"' + row.dims[d].name + '"';
                separator = ",";
            }

            // Értékek beírása a sorba.
            for (var v = 0, vMax = row.vals.length; v < vMax; v++) {
                var value = (meta.indicators[v].value.hide) ? "" : row.vals[v].sz;
                var ratio = (meta.indicators[v].fraction.hide) ? "" : valMultipliers[v] * row.vals[v].sz / row.vals[v].n;
                resultline += separator + value + "," + ratio;
                separator = ",";
            }

            // Sorvége.
            resultString = resultString + resultline + "\n";
        }

        resultString = headerString + "\n" + resultString;

        // A mentéshez használt fájlnév.
        var filename = "Pulzus_" + global.facts[side].reportMeta.caption
                .replace(/[őóö]/ig, "o")
                .replace(/[űüú]/ig, "u")
                .replace(/[á]/ig, "a")
                .replace(/[é]/ig, "e")
                .replace(/[í]/ig, "i")
                .replace(/[ŐÖÓ]/ig, "O")
                .replace(/[ŰÚÜ]/ig, "U")
                .replace(/[Á]/ig, "A")
                .replace(/[É]/ig, "E")
                .replace(/[Í]/ig, "I")
                .replace(/[^a-z0-9]/gi, "_")
                + ".csv";

        var blob = new Blob([resultString], {type: 'text/csv; charset=utf-8;'});
        var link = document.createElement("a");

        // Internet Explorer esetén...
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
            global.setDialog();

            // Ha a download attributum támogatott...
        } else if (link.download !== undefined) {
            var url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            global.setDialog();

            // Ha minden kötél szakad...
        } else {
            global.setDialog(
                    "A fájl mentése sikertelen",
                    "<div class='saveStaticText'>A manuális mentéshez a szövegdoboz tartalmát COPY+PASTE-el írd ki egy .csv kiterjesztésű fájlba.</div>" +
                    "<textarea id='saveTextArea' wrap='off' cols='80' rows='5'>" + resultString + "</textarea>",
                    "Kijelölés",
                    function() {
                        document.getElementById("saveTextArea").select();
                    },
                    "Tovább",
                    function() {
                        global.setDialog();
                    }
            );
        }
    }, false);
};