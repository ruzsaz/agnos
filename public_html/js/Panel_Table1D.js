/* global Panel, d3 */

'use strict';

/**
 * A tábla-diagram konstruktora.
 * 
 * @param {Object} init Inicializáló objektum.
 * @returns {piechartpanel} A megkonstruált panel.
 */
function panel_table1d(init) {
    var that = this;

    this.constructorName = "panel_table1d";

    // Inicializáló objektum beolvasása, feltöltése default értékekkel.
    this.defaultInit = {group: 0, position: undefined, dim: 0, multiplier: 1, ratio: false};
    this.actualInit = global.combineObjects(that.defaultInit, init);

    Panel.call(that, that.actualInit, global.mediators[that.actualInit.group], false, 0, 0); // A Panel konstruktorának meghívása.

    this.dimToShow = that.actualInit.dim;			// A mutatott dimenzió.
    this.preparedData = [];							// Az ábrázolásra kerülő, feldolgozott adat.
    this.maxEntries = global.maxEntriesIn1D;        // A panel által maximálisan megjeleníthető adatok száma.    

    // A mutatók elrejtésvektora, és a fejlécvektor.
    this.columnHeadVector = [];						// Mit kell elrejteni? 0: semmit, 1: az értéket, 2: a hányadost, 3: mindkettőt.	
    this.columnColorIndex = [];						// A táblázat i. oszlopához tartozó indikátor színe.
    this.valuePositionVector = [];					// A megjelenítendő érték-felirat kezdőpozíciója.

    that.titleBox.titleSplitRatio = 1;
    that.titleBox.gContainer.classed("droptarget", false);
    that.titleBox.gContainer.classed("droptarget1", false);

    // Alapréteg.
    that.svg.insert("svg:g", ".title_group")
            .attr("class", "background listener droptarget droptarget0")
            .on('mouseover', function() {
                that.hoverOn(this);
            })
            .on('mouseout', function() {
                that.hoverOff();
            })
            .on("click", function() {
                that.drill();
            })
            .append("svg:rect")
            .attr("width", that.w)
            .attr("height", that.h);

    // Táblázat tartója.
    var tableHolder = that.svg.insert("svg:g", ".title_group")
            .attr("class", "svgTableHolder")
            .attr("transform", "translate(" + that.tableLeftMargin + "," + that.tableTopMargin + ")");

    // A sorfejeket tartó konténer.
    this.gRowHeads = tableHolder.append("svg:svg")
            .attr("x", 0)
            .attr("y", that.tableHeadHeight + that.tableElementGap)
            .attr("width", that.tableHeadWidth)
            .attr("height", that.tableHeight)
            .attr("viewBox", "0 0 " + that.tableHeadWidth + " " + that.tableHeight);

    // Az oszlopfejeket tartó konténer.
    this.gColumnHeads = tableHolder.append("svg:svg")
            .attr("x", that.tableHeadWidth + that.tableElementGap)
            .attr("y", 0)
            .attr("width", that.tableWidth)
            .attr("height", that.tableHeadHeight)
            .attr("viewBox", "0 0 " + that.tableWidth + " " + that.tableHeadHeight);

    // A táblát tartó konténer.
    this.gTable = tableHolder.append("svg:svg")
            .attr("x", that.tableHeadWidth + that.tableElementGap)
            .attr("y", that.tableHeadHeight + that.tableElementGap)
            .attr("width", that.tableWidth)
            .attr("height", that.tableHeight)
            .attr("viewBox", "0 0 " + that.tableWidth + " " + that.tableHeight);

    /**
     * Függőleges scrollozást végrehajtó függvény.
     * 
     * @param {Number} top A scrollbar kezdőpontja pixelben.
     * @returns {undefined}
     */
    var verticalScrollFunction = function(top) {
        var currentExtent = that.gTable.attr("viewBox").split(" ");
        that.gRowHeads.attr("viewBox", "0 " + top + " " + that.tableHeadWidth + " " + that.tableHeight);
        that.gTable.attr("viewBox", currentExtent[0] + " " + top + " " + that.tableWidth + " " + that.tableHeight);
    };

    /**
     * Vízszintes scrollozást végrehajtó függvény.
     * 
     * @param {Number} left A scrollbar kezdőpontja pixelben.
     * @returns {undefined}
     */
    var horizontalScrollFunction = function(left) {
        var currentExtent = that.gTable.attr("viewBox").split(" ");
        that.gColumnHeads.attr("viewBox", left + " 0 " + that.tableWidth + " " + that.tableHeadHeight);
        that.gTable.attr("viewBox", left + " " + currentExtent[1] + " " + that.tableWidth + " " + that.tableHeight);
    };
    
    // Nyelv-beállítás meghívása. Ez kialakítja az oszlopfejléceket, és a titleBoxot. Frissíti az oszlopadatokat.
    that.langSwitch(global.getAnimDuration(-1, that.panelId), true);
    
    // Vízszintes scrollbar elhelyezése.
    this.horizontalScrollbar = new SVGScrollbar(that.svg, true, that.tableWidth, horizontalScrollFunction, that.tableSpacingHorizontal);
    that.horizontalScrollbar.setPosition(that.tableHeadWidth + that.tableLeftMargin + that.tableElementGap, 400 - that.tableBottomMargin - that.innerScrollbarWidth + that.tableElementGap);
    that.horizontalScrollbar.set(that.columnColorIndex.length * that.tableSpacingHorizontal, null);

    // Függőleges scrollbar elhelyezése.
    this.verticalScrollbar = new SVGScrollbar(that.svg, false, that.tableHeight, verticalScrollFunction, that.tableSpacingVerical * 2, tableHolder);
    that.verticalScrollbar.setPosition(600 - that.tableLeftMargin - that.innerScrollbarWidth + that.tableElementGap, that.tableHeadHeight + that.tableTopMargin + that.tableElementGap);

    // Feliratkozás a dimenzióváltó mediátorra.
    var med = that.mediator.subscribe("changeDimension", function(panelId, newDimId, dimToChange) {
        that.doChangeDimension(panelId, newDimId, dimToChange);
    });
    that.mediatorIds.push({"channel": "changeDimension", "id": med.id});

    // Panel regisztrálása a nyilvántartóba.
    that.mediator.publish("register", that, that.panelId, [that.dimToShow], that.preUpdate, that.update, that.getConfig);
}

//////////////////////////////////////////////////
// Osztály-konstansok inicializálása.
//////////////////////////////////////////////////

{
    panel_table1d.prototype = global.subclassOf(Panel); // A Panel metódusainak átvétele.

    panel_table1d.prototype.tableHeadWidth = 120;	// A táblázat sorai fejlécének szélessége.
    panel_table1d.prototype.tableHeadHeight = 34;	// A táblázat fejlécének magassága.
    panel_table1d.prototype.tableElementGap = 4;	// A táblázat fejlécei és a törzs közötti rés mérete.

    panel_table1d.prototype.tableLeftMargin = 40;	// Bal oldali margó mérete.
    panel_table1d.prototype.tableTopMargin = 70;	// Felső margó mérete.
    panel_table1d.prototype.tableBottomMargin = 15;	// Alsó margó mérete.
    panel_table1d.prototype.innerScrollbarWidth = 10;// A belső scrollbar vastagsága, pixel.

    panel_table1d.prototype.tableWidth = 600 - 2 * (panel_table1d.prototype.tableLeftMargin + panel_table1d.prototype.tableElementGap) - panel_table1d.prototype.tableHeadWidth - panel_table1d.prototype.innerScrollbarWidth; // A táblázat törzsének szélessége.
    panel_table1d.prototype.tableHeight = 400 - panel_table1d.prototype.tableTopMargin - panel_table1d.prototype.tableHeadHeight - panel_table1d.prototype.tableBottomMargin - panel_table1d.prototype.innerScrollbarWidth - 2 * panel_table1d.prototype.tableElementGap; // A táblázat törzsének magassága.

    panel_table1d.prototype.tableSpacingVerical = panel_table1d.prototype.tableHeight / 14;		// Egy táblázatsor magassága.
    panel_table1d.prototype.tableSpacingHorizontal = panel_table1d.prototype.tableWidth / 7;	// Egy táblázatoszlop szélessége.

    panel_table1d.prototype.darkenBrightenFactor = 0.25;	// A világosítás/sötétítés méréke.
}

//////////////////////////////////////////////////
// Kirajzolást segítő függvények
//////////////////////////////////////////////////

/**
 * Egy adatsorból meghatározza a megmutatandó értéket.
 * 
 * @param {Object} d Nyers adatsor.
 * @returns {Array} Az értékek tömbje.
 */
panel_table1d.prototype.valuesToShow = function(d) {
    var that = this;
    var vals = [];
    if (d !== undefined && d.vals !== undefined) {
        for (var i = 0, iMax = d.vals.length; i < iMax; i++) {
            if (that.columnHeadVector[i].hide % 2 === 0) { // Ha az értéket meg kell mutatni.
                var val = d.vals[i].sz;
                if (isNaN(parseFloat(val))) {
                    val = 0;
                }
                var unitProperty = (val === 1) ? "unit" : "unitPlural";
                vals.push({value: val,
                    tooltip: that.createTooltip(
                            [{
                                    name: that.localMeta.dimensions[that.dimToShow].description,
                                    value: (d.dims[0].name !== undefined) ? d.dims[0].name : _("Nincs adat")
                                }],
                            [{
                                    name: that.localMeta.indicators[i].description,
                                    value: val,
                                    dimension: that.localMeta.indicators[i].value[unitProperty]
                                }])
                });
            }
            if (that.columnHeadVector[i].hide >> 1 === 0) { // Ha a hányadost meg kell mutatni.
                var val = that.meta.indicators[i].fraction.multiplier * d.vals[i].sz / d.vals[i].n;
                if (isNaN(parseFloat(val))) {
                    val = 0;
                }
                var unitProperty = (val === 1) ? "unit" : "unitPlural";
                vals.push({value: val,
                    tooltip: that.createTooltip(
                            [{
                                    name: that.localMeta.dimensions[that.dimToShow].description,
                                    value: (d.dims[0].name !== undefined) ? d.dims[0].name : _("Nincs adat")
                                }],
                            [{
                                    name: that.localMeta.indicators[i].description,
                                    value: val,
                                    dimension: that.localMeta.indicators[i].fraction[unitProperty]
                                }])
                });
            }
        }
    }
    return vals;
};


//////////////////////////////////////////////////
// Rajzolási folyamat függvényei 
//////////////////////////////////////////////////

/**
 * A klikkeléskor azonnal végrehajtandó animáció.
 * 
 * @param {Object} drill A lefúrást leíró objektum: {dim: a fúrás dimenziója, direction: iránya (+1 fel, -1 le), fromId: az előzőleg kijelzett elem azonosítója, toId: az új elem azonosítója}
 * @returns {undefined}
 */
panel_table1d.prototype.preUpdate = function(drill) {
    var that = this;

    // Ha az X dimenzió mentén történik valami.
    if (drill.dim === that.dimToShow) {

        // Ha az lefúrás, mindent, kivéve amibe fúrunk, letörlünk.
        if (drill.direction === -1) {

            // Sorfejek: nem kellőek törlése.
            that.gRowHeads.selectAll(".svgRowHead")
                    .filter(function(d) {
                        return (d.id !== drill.toId);
                    })
                    .remove();

            // Táblázatsorok: nem kellőek törlése.
            that.gTable.selectAll(".svgTableRow")
                    .filter(function(d) {
                        return (d.id !== drill.toId);
                    })
                    .remove();
        }

        // Ha felfúrás történik.
        else if (drill.direction === 1) {

            // Ha nem a legalsó szinten vagyunk, akkor minden sor törlése.
            if ((global.baseLevels[that.panelSide])[that.dimToShow].length + 2 !== that.meta.dimensions[that.dimToShow].levels.length) {
                that.gRowHeads.selectAll(".svgRowHead").remove();
                that.gTable.selectAll(".svgTableRow").remove();
            }
        }
    }
};

/**
 * Az új adat előkészítése. Meghatározza hogy mit, honnan kinyílva kell kirajzolni.
 * 
 * @param {Array} oldPreparedData Az előzőleg kijelzett adatok.
 * @param {Array} newDataRows Az új adatsorokat tartalmazó tömb.
 * @param {Object} drill Az épp végrehajtandó fúrás.
 * @returns {Array} Az új megjelenítendő adatok.
 */
panel_table1d.prototype.prepareData = function(oldPreparedData, newDataRows, drill) {
    var that = this;
    var level = (global.baseLevels[that.panelSide])[that.dimToShow].length;

    newDataRows.sort(that.cmp);	// Elemi adatok sorbarendezése.
    var dataArray = [];		// Az adatok tömbje, az X dimenzió mentén tárolva, azon belül pedig az Y mentén.

    // Alapértékek beállítása.
    for (var i = 0; i < newDataRows.length; i++) {
        var d = newDataRows[i];
        var dim = d.dims[0];
        var element = {
            index: i,
            oldRowIndex: i,
            id: dim.id,
            uniqueId: level + "L" + dim.id,
            name: dim.name.trim(),
            values: that.valuesToShow(d),
            startOpacity: 0
        };
        element.tooltip = that.createTooltip(
                [{
                        name: that.localMeta.dimensions[that.dimToShow].description,
                        value: (element.name) ? element.name : _("Nincs adat")
                    }],
                []);
        dataArray.push(element);
    }

    // Honnan nyíljon ki az animáció?
    if (oldPreparedData && drill.dim === that.dimToShow && drill.direction === -1) { // Ha sorba való lefúrás történt.
        var oldRowIndex = global.getFromArrayByProperty(oldPreparedData, 'id', drill.toId).index;
        for (var r = 0, rMax = dataArray.length; r < rMax; r++) {
            dataArray[r].oldRowIndex = oldRowIndex;
            dataArray[r].startOpacity = (1 / rMax) + 0.2;
        }
    } else if (oldPreparedData && drill.dim === that.dimToShow && drill.direction === 1) { // Ha sorból való felfúrás történt.
        var offset = (oldPreparedData.length - 1) / 2;
        var newRowIndex = global.getFromArrayByProperty(dataArray, 'id', drill.fromId).index;
        for (var r = 0, rMax = dataArray.length; r < rMax; r++) {
            dataArray[r].oldRowIndex = (dataArray[r].index - newRowIndex) * 5 + offset;
            dataArray[r].startOpacity = (dataArray[r].index === newRowIndex) ? 1 : 0;
        }
    }

    return dataArray;
};

/**
 * Új adat megérkeztekor levezényli a panel frissítését.
 * 
 * @param {Object} data Az új adat.
 * @param {Object} drill Az épp végrehajzásra kerülő fúrás.
 * @returns {undefined}
 */
panel_table1d.prototype.update = function(data, drill) {
    var that = this;
    that.data = data || that.data;
    drill = drill || {dim: -1, direction: 0};

    var tweenDuration = global.getAnimDuration(-1, that.panelId);
    var trans = d3.transition().duration(tweenDuration);

    // Ha túl sok értéket kéne megjeleníteni, pánik
    if (that.data.rows.length > that.maxEntries) {
        that.verticalScrollbar.set(0, null, trans);
        that.panic(true, _("<html>A panel nem képes ") + that.data.rows.length + _(" értéket megjeleníteni.<br />A maximálisan megjeleníthető értékek száma ") + that.maxEntries + _(".</html>"));
        that.preparedData = undefined;
    } else {
        that.panic(false);
        that.preparedData = that.prepareData(that.preparedData, that.data.rows, drill);

        // Sorfejlécek és cellák kirajzolása.
        that.drawRowHeaders(that.preparedData, trans);
        that.drawCells(that.preparedData, trans);

        // Függőleges scrollbar beállítása.
        that.verticalScrollbar.set(that.preparedData.length * that.tableSpacingVerical, null, trans);
    }
};


/**
 * A táblázat celláinak kirajzolása.
 * 
 * @param {Array} preparedData A megjelenítendő adatokat tartalmazó előkészített adattömb.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_table1d.prototype.drawCells = function(preparedData, trans) {
    var that = this;

    // A sorok adathoz társítása. Kulcs: a táblázatsor dimenziója.
    var row = that.gTable.selectAll(".svgTableRow")
            .data(preparedData, function(d) {
                return d.name;
            });

    // Kilépő sorok törlése.
    row.exit().remove();

    // A belépő sorok tartója, egyesítés a maradókkal.
    row = row.enter().append("svg:g")
            .attr("class", "svgTableRow")
            .attr("transform", function(d) {
                return "translate(0," + (d.oldRowIndex * that.tableSpacingVerical) + ")";
            })
            .attr("opacity", function(d) {
                return d.startOpacity;
            })
            .merge(row);

    // A sor helyremozgási animációja.
    row.transition(trans)
            .attr("transform", function(d) {
                return "translate(0, " + d.index * that.tableSpacingVerical + ")";
            })
            .attr("opacity", 1);

    // Cellákhoz való adattársítás.
    var cell = row.selectAll(".svgTableCell")
            .data(function(d) {
                return d.values;
            });

    // Kilépő cellák letörlése.
    cell.exit().remove();

    // Új cella tartójának elkészítése.
    var newCell = cell.enter().append("svg:g")
            .attr("class", "svgTableCell showValue")
            .attr("transform", function(d, i) {
                return "translate(" + (i * that.tableSpacingHorizontal) + ",0)";
            });

    // Új cella háttértéglalapjának kirajzolása.
    newCell.append("svg:rect")
            .attr("class", "backgroundRect")
            .attr("width", that.tableSpacingHorizontal)
            .attr("height", that.tableSpacingVerical);

    // Új cella szövegdobozának elkészítése.
    newCell.append("svg:text")
            .attr("x", that.tableSpacingHorizontal / 2)
            .attr("y", that.tableSpacingVerical / 2)
            .attr("dy", ".35em");

    // Maradók és új elemek összeöntése.
    cell = newCell.merge(cell);

    // Cellák váltakozó háttérszínének beállítása.
    cell.select("rect")
            .attr("fill", function(d, i, j) {
                return (j % 2 === 0) ? that.columnColorIndex[i].brighter(that.darkenBrightenFactor) : that.columnColorIndex[i].darker(that.darkenBrightenFactor);
            });

    // A cellák szövegének beállítása, és megjelnési animációja.
    cell.select("text")
            .attr("opacity", function(d) {
                return (global.cleverRound5(d.value) === d3.select(this).text()) ? 1 : 0;
            })
            .text(function(d) {
                return global.cleverRound5(d.value);
            })
            .transition(trans)
            .attr("opacity", 1);
};

/**
 * Kirajzolja az oszlopfejlécet. Csak 1x kell meghívni, mert nem változik.
 * 
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_table1d.prototype.drawColumnHeaders = function(trans) {
    var that = this;

    // Feliratok az oszlopok elején.
    var gColumnHead = that.gColumnHeads.selectAll(".svgColumnHead")
            .data(that.columnHeadVector);

    // Belépő oszlopfejkonténerek elhelyezése.
    var newGColumnHead = gColumnHead.enter().append("svg:g")
            .attr("class", "svgColumnHead showValue")
            .attr("transform", function(d, i) {
                return "translate(" + (that.valuePositionVector[i] * that.tableSpacingHorizontal) + ",0)";
            })
            .attr("opacity", 0);

    // Az indikátor fejléce.
    newGColumnHead.append("svg:rect")
            .attr("class", "backgroundRect")
            .attr("width", function(d) {
                return (d.hide !== 3) ? (((d.hide === 0) ? 2 : 1) * that.tableSpacingHorizontal) : 0;
            })
            .attr("height", that.tableHeadHeight / 2)
            .style("fill", function(d, i) {
                return global.colorValue(i);
            });

    // Az indikátor megnevezése.
    newGColumnHead.append("svg:text")
            .attr("opacity", 1)
            .attr("class", "svgColumnHeadLabel svgTableHeadLabel")
            .attr("x", function(d) {
                return (d.hide === 0) ? that.tableSpacingHorizontal : that.tableSpacingHorizontal / 2;
            })
            .attr("y", that.tableHeadHeight / 4)
            .attr("dy", "0.35em")
            .attr("dx", "0em")
            .classed("double", function(d) {
                return (d.hide === 0);
            })
            .text(function(d, i) {
                return (d.hide !== 3) ? that.localMeta.indicators[i].caption : "";
            });

    // Az indikátor érték-fejléce.
    newGColumnHead.append("svg:rect")
            .attr("class", "backgroundRect")
            .attr("width", function(d, i) {
                return (d.hide % 2 === 0) ? that.tableSpacingHorizontal : 0;
            })
            .attr("height", that.tableHeadHeight / 2)
            .attr("y", that.tableHeadHeight / 2)
            .style("fill", function(d, i) {
                return d3.rgb(global.colorValue(i)).brighter(that.darkenBrightenFactor);
            });

    //Az indikátor érték megnevezése.
    newGColumnHead.append("svg:text")
            .attr("opacity", 1)
            .attr("class", "svgColumnHeadLabel svgTableHeadLabel")
            .attr("x", that.tableSpacingHorizontal / 2)
            .attr("y", 3 * that.tableHeadHeight / 4)
            .attr("dy", "0.35em")
            .attr("dx", "0em")
            .text(function(d, i) {
                return (d.hide % 2 === 0) ? that.localMeta.indicators[i].value.unitPlural : "";
            });

    // Az indikátor hányados-fejléce.
    newGColumnHead.append("svg:rect")
            .attr("class", "backgroundRect")
            .attr("width", function(d) {
                return (d.hide >> 1 === 0) ? that.tableSpacingHorizontal : 0;
            })
            .attr("height", that.tableHeadHeight / 2)
            .attr("y", that.tableHeadHeight / 2)
            .attr("x", function(d, i) {
                return (d.hide % 2 === 0) ? that.tableSpacingHorizontal : 0;
            })
            .style("fill", function(d, i) {
                return d3.rgb(global.colorValue(i)).darker(that.darkenBrightenFactor);
            });

    // Az indikátor hányados megnevezése.
    newGColumnHead.append("svg:text")
            .attr("opacity", 1)
            .attr("class", "svgColumnHeadLabel svgTableHeadLabel")
            .attr("x", function(d) {
                return ((d.hide % 2 === 0) ? 3 : 1) * that.tableSpacingHorizontal / 2;
            })
            .attr("y", 3 * that.tableHeadHeight / 4)
            .attr("dy", "0.35em")
            .attr("dx", "0em")
            .text(function(d, i) {
                return (d.hide >> 1 === 0) ? that.localMeta.indicators[i].fraction.unitPlural : "";
            });

    // Maradók és új elemek összeöntése.
    gColumnHead = newGColumnHead.merge(gColumnHead);

    // Helyremozgási, színezési animáció.
    gColumnHead.transition(trans)
            .attr("opacity", 1);

    // Szöveg belepaszírozása a rendelkezésre álló helyre.
    global.cleverCompress(that.gColumnHeads.selectAll("text.double"), 2 * that.tableSpacingHorizontal, .85, 1.4);
    global.cleverCompress(that.gColumnHeads.selectAll("text:not(.double)"), that.tableSpacingHorizontal, .85, 1.4);
};

/**
 * Kirajzolja a táblázat oszlopfejlécét.
 * 
 * @param {Array} preparedData Az előkészített adat.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_table1d.prototype.drawRowHeaders = function(preparedData, trans) {
    var that = this;

    // Feliratok a sorok elején.
    var gRowHead = that.gRowHeads.selectAll(".svgRowHead")
            .data(preparedData, function(d) {
                return d.uniqueId + d.name;
            });

    // Kilépő sorfejkonténer törlése.
    gRowHead.exit()
            .on("click", null)
            .remove();

    // Belépő sorfejkonténerek elhelyezése.
    var newGRowHead = gRowHead.enter().append("svg:g")
            .attr("class", "svgRowHead listener alterColored")
            .on("click", function(d) {
                that.drill(d);
            })
            .attr("transform", function(d) {
                return "translate(0," + (d.oldRowIndex * that.tableSpacingVerical) + ")";
            })
            .attr("opacity", function(d) {
                return d.startOpacity;
            });

    // Sorfej háttértéglalapjának elkészítése.
    newGRowHead.append("svg:rect")
            .attr("class", "backgroundRect")
            .attr("width", that.tableHeadWidth)
            .attr("height", that.tableSpacingVerical);

    // A sorfej szövegdobozának elkészítése.
    newGRowHead.append("svg:text")
            .attr("opacity", 1)
            .attr("class", "svgRowHeadLabel svgTableHeadLabel")
            .attr("y", that.tableSpacingVerical / 2)
            .attr("x", 0)
            .attr("dy", "0.35em")
            .attr("dx", ".26em");

    // Maradók és új elemek összeöntése.
    gRowHead = newGRowHead.merge(gRowHead);

    gRowHead.select("text").text(function(d) {
        return d.name;
    });

    // A sorfejlécekhez tartozó adat befrissítése.
    gRowHead.select("rect");
    gRowHead.select("text");

    // Helyremozgási, színezési animáció.
    gRowHead.attr("parity", function(d) {
        return d.index % 2;
    })
            .classed("darkenable", false)
            .transition(trans)
            .attr("opacity", 1)
            .attr("transform", function(d) {
                return "translate(0, " + d.index * that.tableSpacingVerical + ")";
            })
            .on("end", Panel.prototype.classedDarkenable);

    // Felirat összenyomása a kitöltendő területre.
    global.cleverCompress(that.gRowHeads.selectAll("text"), that.tableHeadWidth, 0.94, 1.4);
};

//////////////////////////////////////////////////
// Irányítást végző függvények
//////////////////////////////////////////////////

/**
 * Valamely dimenzióban történő le vagy felfúrást kezdeményező függvény.
 * 
 * @param {Object} d Lefúrás esetén a lefúrás céleleme. Ha undefined, akkor felfúrásról van szó.
 * @returns {undefined}
 */
panel_table1d.prototype.drill = function(d) {
    global.tooltip.kill();
    var drill = {
        dim: this.dimToShow,
        direction: (d === undefined) ? 1 : -1,
        toId: (d === undefined) ? undefined : d.id,
        toName: (d === undefined) ? undefined : d.name
    };
    this.mediator.publish("drill", drill);
};

/**
 * A dimenzióváltást végrehajtó függvény.
 * 
 * @param {String} panelId A dimenzióváltást kapó panel ID-ja.
 * @param {Integer} newDimId A helyére bejövő dimenzió ID-ja.
 * @returns {undefined}
 */
panel_table1d.prototype.doChangeDimension = function(panelId, newDimId) {
    var that = this;
    if (panelId === that.panelId) {
        that.dimToShow = newDimId;
        that.actualInit.dim = that.dimToShow;
        that.mediator.publish("register", that, that.panelId, [that.dimToShow], that.preUpdate, that.update, that.getConfig);
        global.tooltip.kill();
        this.mediator.publish("drill", {dim: -1, direction: 0, toId: undefined});
    }
};

/**
 * Nyelvváltást végrehajtó függvény.
 * 
 * @param {Number} duration A megjelenítési animáció ideje.
 * @param {Boolean} isInitial Ez az első megjelenés?
 * @returns {undefined}
 */
panel_table1d.prototype.langSwitch = function(duration, isInitial) {
    var that = this;
    var idA = [];									// Megjelenítendő értékek id-vektora a tooltiphez.
    var valueNamesVector = [];						// A megjelenítendő értékek neveinek tömbje.
    this.valuePositionVector = [];					// A megjelenítendő érték-felirat kezdőpozíciója.
    var pos = 0;
    that.columnHeadVector = [];

    // Az oszlopfejléc-adatok összerakása.
    for (var i = 0, iMax = that.meta.indicators.length; i < iMax; i++) {
        var ind = that.meta.indicators[i];
        that.columnHeadVector.push({
            hide: ((ind.value.hide) ? 1 : 0) + ((ind.fraction.hide) ? 2 : 0),
            tooltip: that.createTooltip(
                    [{name: that.localMeta.indicators[i].description}], [])
        });
        this.valuePositionVector.push(pos);

        if (that.columnHeadVector[i].hide !== 3) {
            idA.push(i);
            valueNamesVector.push(that.localMeta.indicators[i].caption);
            pos += (that.columnHeadVector[i].hide === 0) ? 2 : 1;
            if (that.columnHeadVector[i].hide % 2 === 0) {
                that.columnColorIndex.push(d3.rgb(global.colorValue(i)).brighter(that.darkenBrightenFactor));
            }
            if (that.columnHeadVector[i].hide >> 1 === 0) {
                that.columnColorIndex.push(d3.rgb(global.colorValue(i)).darker(that.darkenBrightenFactor));
            }
        }
    }
    
    var trans =  d3.transition().duration((isInitial) ? duration : 0);
    that.gColumnHeads.selectAll(".svgColumnHead").remove();
    that.drawColumnHeaders(trans);
    that.titleBox.update(idA, valueNamesVector, [], [], true, global.selfDuration);
};