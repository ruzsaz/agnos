/* global Panel, d3 */

'use strict';

var barlinepanel = panel_barline;
/**
 * A kombinált oszlop és vonaldiagram konstruktora.
 * 
 * @param {Object} init Inicializáló objetum.
 * @returns {panel_barline}
 */
function panel_barline(init) {
    var that = this;

    this.constructorName = "panel_barline";

    // Inicializáló objektum beolvasása, feltöltése default értékekkel.
    this.defaultInit = {group: 0, position: undefined, dim: 0, valbars: [0], vallines: [], valavglines: [], multiplier: 1, ratio: false, streched: false, symbols: false, domain: [], domainr: [], top10: false, mag: 1, fromMag: 1};
    this.actualInit = global.combineObjects(that.defaultInit, init);

    // Ha széthúzottat kérnek, akkor vonalakat nem rajzolunk és kész.
    if (that.actualInit.streched) {
        that.actualInit.valavglines = [];
        that.actualInit.vallines = [];
    }

    this.valBarsToShow = that.actualInit.valbars;		// Ezeket kell oszlopon ábrázolni.
    this.valLinesToShow = that.actualInit.vallines;		// Ezeket kell vonallal ábrázolni.
    this.valAvgToShow = that.actualInit.valavglines;	// Ezek pedig a vonallal ábrázolandó átlagok.
    this.isStretched = that.actualInit.streched;		// 100%-ra széthúzott diagram kell-e?    
    this.buildValueVectors();

    Panel.call(that, that.actualInit, global.mediators[that.actualInit.group], !that.singleValMode, global.numberOffset, that.avgTextHeight); // A Panel konstruktorának meghívása.

    this.dimToShow = that.actualInit.dim;				// Ennyiedik dimenzió a panel dimenziója.
    this.valFraction = that.actualInit.ratio;			// Hányadost mutasson?
    this.valBarMultipliers = [];// Ennyiszeresét kell mutatni az értékeknek.
    this.valLineMultipliers = [];// Ennyiszeresét kell mutatni az értékeknek.
    this.valAvgMultipliers = [];	// Ennyiszeresét kell mutatni az értékeknek.
    this.isSymbolsRequired = that.actualInit.symbols;	// Rajzoljunk jelölőt a vonaldiagramra?
    this.processedData;									// A megjelenítendő feldolgozott adat.
    this.maxEntries = (this.actualInit.top10) ? 999999999 : global.maxEntriesIn1D;    // A panel által maximálisan megjeleníthető adatok száma.    
    this.shadowTimeout;									// A háttértéglalapokat létrehozó időzítés.
    this.maskId = global.randomString(12);              // A maszk réteg id-je. Véletlen, nehogy kettő azonos legyen.

    // Az x tengely szövegszínének meghatározása.
    this.xAxisColor = global.readableColor(global.colorValue[0]);

    // Vízszintes skála.
    this.xScale = d3.scaleLinear()
            .range([0, that.width]);

    // Függőleges skála.
    this.yScale = d3.scaleLinear()
            .range([that.height, 0])
            .nice(10);

    // Függőleges skála széthúzott módra.
    this.yScaleStreched = d3.scaleLinear()
            .range([that.height, 0])
            .domain([0, 1]);

    // A vízszintes tengely.
    this.xAxis = d3.axisBottom(that.xScale);

    // A függőleges tengelyt generáló függvény.
    this.yAxis = d3.axisLeft(that.yScale)
            .ticks(10)
            .tickFormat(global.cleverRound3);

    // Széthúzott módban a függőleges tengely %-okat kell hogy mutasson.
    if (that.isStretched) {
        that.yAxis.scale(this.yScaleStreched).tickFormat(d3.format(".0%"));
    }

    // Alsó dobómező.
    that.svg.insert("svg:g", ".title_group")
            .attr("class", "minus background listener droptarget droptarget1")
            .on('mouseover', function() {
                that.hoverOn(this, "bar");
            })
            .on('mouseout', function() {
                that.hoverOff();
            })
            .append("svg:rect")
            .attr("x", that.margin.left)
            .attr("y", (that.isStretched) ? that.margin.top : that.margin.top + that.height / 2)
            .attr("width", that.width)
            .attr("height", (that.isStretched) ? that.height : that.height / 2);

    // Felső dobómező.
    that.svg.insert("svg:g", ".title_group")
            .attr("class", "plus background listener droptarget droptarget1")
            .on('mouseover', function() {
                that.hoverOn(this, "line");
            })
            .on('mouseout', function() {
                that.hoverOff();
            })
            .append("svg:rect")
            .attr("x", that.margin.left)
            .attr("y", that.margin.top)
            .attr("width", that.width)
            .attr("height", (that.isStretched) ? 0 : that.height / 2);

    // Az alapréteg.
    var background = that.svg.insert("svg:g", ".title_group")
            .attr("class", "background listener droptarget droptarget0")
            .on('click', function() {
                that.drill();
            })
            .on('mouseover', function() {
                that.hoverOn(this);
            })
            .on('mouseout', function() {
                that.hoverOff();
            });
    background.append("svg:rect")
            .attr("width", that.w)
            .attr("height", that.h);

    // Top10 jelölés    
    if (this.actualInit.top10) {
        background.append("svg:g")
                .attr("class", "top_10_holder")
                .attr("transform", "matrix(" + 0.4 * that.magLevel + ",0,0," + 0.4 * that.magLevel + "," + 460 * that.magLevel + "," + 64 * 1 + ")")
                .html('<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon_top10"></use>');
    }

    // Vízszintes tengely szövegárnyék-rétege.
    this.gAxisXShadow = that.svg.insert("svg:g", ".title_group")
            .attr("class", "axis axisX")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")");

    // Oszlopdiagram rétege.
    this.gBars = that.svg.insert("svg:g", ".title_group")
            .attr("class", "bar_group")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")")
            .attr("mask", "url(#maskurl" + that.maskId + ")");

    // Vonaldiagramok rétege.
    this.gLines = that.svg.insert("svg:g", ".title_group")
            .attr("class", "line_group")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")")
            .attr("mask", "url(#maskurl" + that.maskId + ")");

    // Átlagvonal rétege.
    this.gAvgLines = that.svg.insert("svg:g", ".title_group")
            .attr("class", "avg_group")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")")
            .attr("mask", "url(#maskurl" + that.maskId + ")");

    // Vízszintes tengely rétege.
    this.gAxisX = that.svg.insert("svg:g", ".title_group")
            .attr("class", "axis axisX noEvents")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")");

    // Vízszintes tengelyvonal kirajzolása.
    that.gAxisX.append("svg:line")
            .attr("x1", 0)
            .attr("y1", that.height)
            .attr("x2", that.width)
            .attr("y2", that.height);

    // Függőleges tengely rétege.
    this.gAxisY = that.svg.insert("svg:g", ".title_group")
            .attr("class", "axis axisY noEvents")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")");

    // A kilógó oszlopok végét elhalványító.
    this.mask = that.svg.append("svg:mask")
            .attr("id", "maskurl" + that.maskId);

    that.mask
            .append("svg:rect")
            .attr("x", 0)
            .attr("width", "100%")
            .attr("y", -that.margin.top)
            .attr("height", that.h)
            .attr("fill", (that.magLevel === 1) ? "url(#overflow)" : "url(#overflow2)");

    // Feliratkozás az értékváltás mediátorra.
    var med;
    med = that.mediator.subscribe("changeValue", function(id, val, ratio, valToChange) {
        that.doChangeValue(id, val, ratio, valToChange);
    });
    that.mediatorIds.push({"channel": "changeValue", "id": med.id});

    // Feliratkozás a dimenzióváltó mediátorra.
    med = that.mediator.subscribe("changeDimension", function(panelId, newDimId, dimToChange) {
        that.doChangeDimension(panelId, newDimId);
    });
    that.mediatorIds.push({"channel": "changeDimension", "id": med.id});

    // Panel regisztrálása a nyilvántartóba.
    that.mediator.publish("register", that, that.panelId, [that.dimToShow], that.preUpdate, that.update, that.getConfig);
}

//////////////////////////////////////////////////
// Osztály-konstansok inicializálása.
//////////////////////////////////////////////////

{
    panel_barline.prototype = global.subclassOf(Panel); // A Panel metódusainak átvétele.

    panel_barline.prototype.barPadding = 0.1;			// Az oszlopok közötti rés az oszlopok szélességében.
    panel_barline.prototype.avgTextHeight = 16;			// Az "Átlag" szöveg magassága.
    panel_barline.prototype.avgText = _("Átlag");			// Az "Átlag" felirat szövege.
    panel_barline.prototype.symbolSize = 128;			// A jelölő mérete.
    panel_barline.prototype.symbolSize_background = 140;// A jelölő takaró hátterének mérete.
    panel_barline.prototype.cutLimit = 10;              // Ennyiszeres kiugó érték esetén változtatja a skálát a második legnagyobbhoz.
    panel_barline.prototype.cutConstant = 1.2;          // ... és ekkor a 2. érték ennyiszerese lesz a maximum.

    // Vonaldiagram path-generátora, az objektum x,y property-éből dolgozik.
    panel_barline.prototype.lineBarGenerator = d3.line()
            .x(function(d) {
                return d.x;
            })
            .y(function(d) {
                return d.y;
            });

    // A régi vonaldiagram path-generátora, az objektum oldX,oldY property-éből dolgozik.
    panel_barline.prototype.oldLineBarGenerator = d3.line()
            .x(function(d) {
                return d.oldX;
            })
            .y(function(d) {
                return d.oldY;
            });
}

//////////////////////////////////////////////////
// Kirajzolást segítő függvények
//////////////////////////////////////////////////

/**
 * Egy adatsorból meghatározza a megmutatandó oszlopdiagramokhoz
 * tartozó értékeket, és az alatta levők összegét, tömbként.
 * 
 * @param {Object} d Nyers adatsor.
 * @returns {Array} Az értékek tömbje.
 */
panel_barline.prototype.barValuesToShow = function(d) {
    var vals = [];
    if (d !== undefined && d.vals !== undefined) {
        var accumulation = 0; // Az alatta levő oszlopelemek érték-összege.
        for (var i = 0, iMax = this.valBarNumber; i < iMax; i++) {
            var val = (this.valFraction) ? this.valBarMultipliers[i] * d.vals[this.valBarsToShow[i]].sz / d.vals[this.valBarsToShow[i]].n : d.vals[this.valBarsToShow[i]].sz;
            var origVal = val;
            if (!isFinite(parseFloat(val))) {
                val = 0;
            }
            if (isNaN(parseFloat(origVal))) {
                origVal = "???";
            }
            vals.push({value: val, originalValue: origVal, accumulation: accumulation}); // value: az érték, accumulation: az alatta levő elemek érték-összege.
            accumulation += val;
        }
    }
    return vals;
};

/**
 * Egy adatsorból meghatározza a megmutatandó vonaldiagramokhoz tartozó értékeket.
 * 
 * @param {Object} d Nyers adatsor.
 * @returns {Array} Az értékek tömbje.
 */
panel_barline.prototype.lineValuesToShow = function(d) {
    var vals = [];
    if (d !== undefined && d.vals !== undefined) {
        for (var i = 0; i < this.valLineNumber; i++) {
            var val = (this.valFraction) ? this.valLineMultipliers[i] * d.vals[this.valLinesToShow[i]].sz / d.vals[this.valLinesToShow[i]].n : d.vals[this.valLinesToShow[i]].sz;
            var origVal = val;
            if (!isFinite(parseFloat(val))) {
                val = 0;
            }
            if (isNaN(parseFloat(origVal))) {
                origVal = "???";
            }
            vals.push({value: val, originalValue: origVal});
        }
    } else {
        for (var i = 0; i < this.valLineNumber; i++) {
            vals.push({value: 0, originalValue: "???"});
        }
    }
    return vals;
};

/**
 * Egy adatsorból meghatározza a megmutatandó értékek összegét.
 * 
 * @param {Object} d Nyers adatsor.
 * @returns {Number} Az értéek abszolútértékének összege.
 */
panel_barline.prototype.sumValueToShow = function(d) {
    var val = 0;
    var lineVals = this.lineValuesToShow(d);
    var barVals = this.barValuesToShow(d);
    for (var i = 0, iMax = lineVals.length; i < iMax; i++) {
        val = val + Math.abs(lineVals[i].value);
    }
    for (var i = 0, iMax = barVals.length; i < iMax; i++) {
        val = val + Math.abs(barVals[i].value);
    }
    return val;
};

/**
 * A nyers adatsorok tömbjéből meghatározza a megmutatandó átlagértékeket.
 * 
 * @param {Array} dataRows A nyers adatsorokat tartalmazó tömb.
 * @returns {Array} Az átlagértékek tömbje.
 */
panel_barline.prototype.avgLineValuesToShow = function(dataRows) {
    var vals = [];
    for (var ln = 0; ln < this.valAvgNumber; ln++) {
        var nominator = 0;
        var denominator = 0;
        for (var i = 0, iMax = dataRows.length; i < iMax; i++) {
            var d = dataRows[i];
            if (d !== undefined && d.vals !== undefined) {
                nominator += d.vals[this.valAvgToShow[ln]].sz;
                denominator += d.vals[this.valAvgToShow[ln]].n;
            }
        }
        var val = (this.valFraction) ? this.valAvgMultipliers[ln] * nominator / denominator : nominator / dataRows.length;
        if (isNaN(parseInt(val))) {
            val = 0;
        }
        vals.push({value: val});
    }
    return vals;
};

/**
 * Egy elemhez tartozó tooltipet legyártó függvény;
 * 
 * @param {Object} d Az elem.
 * @returns {String} A megjelenítendő tooltip.
 */
panel_barline.prototype.getTooltip = function(d) {
    var that = this;
    var vals = [];

    for (var i = 0; i < that.legendArray.length; i++) {
        var lVal = that.legendArray[i];
        var id = lVal.id;
        var value = undefined, avgValue = undefined;
        if (lVal.isBarRequired) {
            value = d.barValues[global.positionInArray(that.valBarsToShow, id)].originalValue;
        } else if (lVal.isLineRequired) {
            value = d.lineValues[global.positionInArray(that.valLinesToShow, id)].originalValue;
        }
        if (lVal.isAvgRequired) {
            avgValue = d.avgValues[global.positionInArray(that.valAvgToShow, id)].value;
        }

        var unitProperty = (value === 1) ? "unit" : "unitPlural";
        vals.push({
            name: that.localMeta.indicators[id].description,
            value: value,
            dimension: (that.valFraction) ? that.localMeta.indicators[id].fraction[unitProperty] : that.localMeta.indicators[id].value[unitProperty],
            avgValue: avgValue
        });

    }
    return that.createTooltip(
            [{
                    name: that.localMeta.dimensions[that.dimToShow].description,
                    value: (d.name) ? d.name : _("Nincs adat")
                }],
            vals);
};

/**
 * Adott magasságú és helyzetű vízszintes vonalat készít path-ként.
 * 
 * @param {type} x0 Kezdőpont x koordinátája.
 * @param {type} x1 Végpont x koordinátája.
 * @param {type} y A vonal y koordinátája.
 * @returns {String} A vonalat leíró path.
 */
panel_barline.prototype.horizontalLine = function(x0, x1, y) {
    return "M" + x0 + "," + y + "L" + x1 + "," + y;
};

/**
 * Egy töröttvonal koordinátahalmazából az egyik elem körüli töröttvonalelemet
 * határozza meg path-ként.
 * 
 * @param {Array} pointArray A kiinduló töröttvonal pontjait tartalmazó tömb.
 * @param {String} id Annak a pontnak az id-je, ami körüli részt kell meghatározni.
 * @returns {String} A töröttvonalat leíró path.
 */
panel_barline.prototype.veeLine = function(pointArray, id) {
    var that = this;
    var i = global.positionInArrayByProperty(pointArray, "id", id);
    return "M" + that.interpolate("x", pointArray[i - 1], pointArray[i], pointArray[i + 1], 0, 2) + "," + that.interpolate("y", pointArray[i - 1], pointArray[i], pointArray[i + 1], 0, 2) +
            "L" + that.interpolate("x", pointArray[i - 1], pointArray[i], pointArray[i + 1], 1, 2) + "," + that.interpolate("y", pointArray[i - 1], pointArray[i], pointArray[i + 1], 1, 2) +
            "L" + that.interpolate("x", pointArray[i - 1], pointArray[i], pointArray[i + 1], 2, 2) + "," + that.interpolate("y", pointArray[i - 1], pointArray[i], pointArray[i + 1], 2, 2);
};

/**
 * Egy törtlineáris függvény utolsó pontjától még továbbmegy lineárisan félszakasznyit.
 * 
 * @param {String} coord A pontok extrapolálandó property-je (jellemzően "x" vagy "y").
 * @param {Object} last Az utolsó pont (jellemzően {x: , y: } típusú).
 * @param {Object} prev Az előző pont.
 * @returns {Number} Az extrapolált érték.
 */
panel_barline.prototype.extrapolate = function(coord, last, prev) {
    return last[coord] + (last[coord] - prev[coord]) / 2;
};

/**
 * Egy 3 pontból álló törtlineáris "V" függvény középső felét néhány egyenlő
 * részre osztva visszaadja az i. osztópont függvényértékét. Ha az egyik végpont
 * "isFake" property-je true, akkor azt a pontot a "V" szárának felénél levőnek veszi.
 * 
 * @param {String} coord A pontok interpolálandó property-je (jellemzően "x" vagy "y").
 * @param {Object} a Bal szélső pont (jellemzően {x: , y: , isFake: } típusú).
 * @param {Object} b Középső pont.
 * @param {Object} c Jobb szélső pont.
 * @param {Integer} i Az aktuális osztópont sorszáma.
 * @param {Integer} iMax Az osztópontok száma.
 * @returns {Number} Az interpolált érték.
 */
panel_barline.prototype.interpolate = function(coord, a, b, c, i, iMax) {
    if (a === null || b === null || c === null || i === null || iMax === null || a === undefined || b === undefined || c === undefined || i === undefined || iMax === undefined || isNaN(a[coord]) || isNaN(b[coord]) || isNaN(c[coord]) || isNaN(i)) {
        return 1000;
    }
    var bb = b[coord];
    var aa = (a.isFake) ? 2 * a[coord] - bb : a[coord];
    var cc = (c.isFake) ? 2 * c[coord] - bb : c[coord];
    var x = (i / iMax) - 0.5;
    if (x < 0) {
        x = -x;
        cc = aa;
    }
    return x * cc + (1 - x) * bb;
};

/**
 * Beállítja az épp aktuális függőleges skálát. Ha az inicializáló objetum
 * fix skálát kért, akkor azt, ha nem, akkor az épp aktuális adatok alapján
 * automatikusan.
 * 
 * @param {Array} scale 2 elemű tömb a minimális és maximális értékkel.
 * @returns {undefined}
 */
panel_barline.prototype.setYScale = function(scale) {
    var actualScaleDomain = (this.valFraction) ? this.actualInit.domainr : this.actualInit.domain;
    if ((actualScaleDomain instanceof Array) && actualScaleDomain.length === 2) {
        this.yScale.domain(actualScaleDomain);
    } else {
        this.yScale.domain(scale);
    }
    if (!this.isStretched) {
        this.yScale.nice(10);
    }
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
panel_barline.prototype.preUpdate = function(drill) {
    var that = this;
    var oldPreparedData = that.processedData;

    // Lefúrás esetén: mindent, kivéve amibe fúrunk, letörlünk.
    if (drill.direction === -1) {

        // Tengelyfeliratok: nem kellőek törlése.
        that.gAxisX.selectAll("text")
                .filter(function(d) {
                    return (d.id !== drill.toId);
                })
                .remove();
        that.gAxisXShadow.selectAll("rect")
                .on("click", null)
                .remove();

        // Oszlopok: nem kellőek letörlése.
        that.gBars.selectAll(".bar")
                .filter(function(d) {
                    return (d.id !== drill.toId);
                })
                .on("click", null)
                .remove();

        // Átlagvonalak: a megmaradó oszlopelem méretűre nyisszantás.
        that.gBars.selectAll(".bar")
                .each(function(d) {
                    var avgX0 = d.x - that.barPadding * d.width / 2;
                    var avgX1 = d.x + d.width + that.barPadding * d.width / 2;
                    that.gAvgLines.selectAll("path")
                            .attr("d", function(d2) {
                                return that.horizontalLine(avgX0, avgX1, d2.y);
                            });
                });

        // Átlagfelirat: törlés.
        that.gAvgLines.selectAll("text")
                .remove();

        // Vonalak: csökkentett méretűvel való pótlás.
        that.gLines.selectAll(".lineChart")
                .attr("d", function(d) {
                    return that.veeLine(d, drill.toId);
                });

        // Szimbólumok: törlés.
        that.gLines.selectAll(".lineSymbolHolder")
                .on("click", null)
                .remove();

        // Felfúrás esetén.
    } else if (drill.direction === 1 && oldPreparedData) {

        // Tengelyfeliratok: minden törlése.
        that.gAxisX.selectAll("text")
                .filter(function(d) {
                    return (d.id !== drill.fromId);
                })
                .remove();
        that.gAxisXShadow.selectAll("rect")
                .on("click", null)
                .remove();

        // Az oszlopok átlagértékének meghatározása.
        var avgValues = [];
        for (var j = 0, jMax = that.valBarNumber; j < jMax; j++) {
            var avgHeight = d3.mean(oldPreparedData.dataArray, function(d) {
                return d.barValues[j].height;
            });
            var avgY = d3.mean(oldPreparedData.dataArray, function(d) {
                return d.barValues[j].y;
            });
            avgValues.push({height: avgHeight, y: avgY});
        }

        // Minden oszlopelem eltörlése.
        that.gBars.selectAll(".bar")
                .on("click", null)
                .remove();

        // Átlaghoz tartozó oszlopelem kirajzolása.
        var level = (global.baseLevels[that.panelSide])[that.dimToShow].length;
        that.gBars.selectAll(".bar").data([{id: drill.fromId, uniqueId: level + "L" + drill.fromId}])
                .enter().append("svg:g")
                .attr("class", "bar bordered darkenable")
                .attr("transform", "translate(" + (that.xScale.range()[1] * (that.barPadding / 2)) + ", 0)")
                .attr("opacity", 1)
                .selectAll("rect").data(avgValues)
                .enter().append("svg:rect")
                .attr("class", function(d2, i2) {
                    return "controlled controlled" + that.valBarsToShow[i2];
                })
                .attr("x", 0)
                .attr("width", that.xScale.range()[1] * (1 - that.barPadding))
                .attr("y", function(d2) {
                    return d2.y;
                })
                .attr("height", function(d2) {
                    return d2.height;
                })
                .attr("fill", function(d2, i2) {
                    return global.colorValue(that.valBarsToShow[i2]);
                });

        // Átlagvonalak: széthúzás kilógóra.
        that.gAvgLines.selectAll("path")
                .attr("d", function(d) {
                    return that.horizontalLine(-that.margin.left, that.width + that.margin.right, d.y);
                });

        // Átlagfelirat: törlés.
        that.gAvgLines.selectAll("text")
                .remove();

        // Vonalak: az átlagértékel való pótlás.
        that.gLines.selectAll(".lineChart")
                .attr("d", function(d) {
                    var avgY = d3.mean(d, function(d2) {
                        return (d2.id < -10) ? undefined : d2.y;
                    });
                    return that.horizontalLine(-that.margin.left, that.width + that.margin.right, avgY);
                });

        // Szimbólumok: törlés.
        that.gLines.selectAll(".lineSymbolHolder")
                .on("click", null)
                .remove();
    }
};

/**
 * Kiszedi az adatokból a top 10 értéket, és sorbarendez eszerint.
 * 
 * @param {Array} newDataRows Az adatsorokat tartalmazó tömb.
 * @returns {Array} A top 10 adatokat rendezve tartalmazó tömb.
 */
panel_barline.prototype.getTop10 = function(newDataRows) {
    for (var i = 0, iMax = newDataRows.length; i < iMax; i++) {
        newDataRows[i].sumVal = this.sumValueToShow(newDataRows[i]);
    }

    newDataRows.sort(function(a, b) {
        return b.sumVal - a.sumVal;
    });
    return newDataRows.slice(0, 10);
};

/**
 * Az új adat előkészítése. Meghatározza hogy mit, honnan kinyílva kell kirajzolni.
 * 
 * @param {Object} oldPreparedData Az előzőleg kijelzett adatok.
 * @param {Array} newDataRows Az új adatsorokat tartalmazó tömb.
 * @param {Object} drill Az épp végrehajtandó fúrás.
 * @returns {Object} Az új megjelenítendő adatok.
 */
panel_barline.prototype.prepareData = function(oldPreparedData, newDataRows, drill) {
    var that = this;
    var level = (global.baseLevels[that.panelSide])[that.dimToShow].length;

    var dataArray = [];			// A fő adattörzs, ez fogja a téglalapok megjelenítését tartalmazni.

    // Sorbarendezzük az adatokat, ha kell, a top10-et csak.
    if (that.actualInit.top10) {
        newDataRows = that.getTop10(newDataRows); // Első 10 adat kérése és rendezése
    } else {
        newDataRows.sort(that.cmp); // Adatok névsorba rendezése.
    }

    // Vízszintes skála beállítása.
    that.xScale.domain([0, newDataRows.length]);

    // Lefúrás esetén: ebből a régi elemből kell kinyitni mindent.
    var openFromElement = (drill.direction === -1 && oldPreparedData) ? global.getFromArrayByProperty(oldPreparedData.dataArray, 'id', drill.toId) : null;
    openFromElement = openFromElement || null;

    // Felfúrás esetén: annak az elemnek az indexe az új adatokban, amit előzőleg kibontva mutattunk.
    var openToElementIndex;
    if (drill.direction === 1) {
        for (var i = 0, iMax = newDataRows.length; i < iMax; i++) {
            if (newDataRows[i].dims[0].id === drill.fromId) {
                openToElementIndex = i;
                break;
            }
        }
    }

    // Mutatandó átlagértékek tömbje, és azok maximuma, minimuma.
    var avgValues = that.avgLineValuesToShow(newDataRows);
    var maxAvgValue = d3.max(avgValues, function(d) {
        return d.value;
    }) || 0;
    var minAvgValue = d3.min(avgValues, function(d) {
        return d.value;
    }) || 0;

    // Első végigfutás: alapértékek beállítása, és a maximumok, minimumok meghatározása.
    var maxValue = 0;
    var minValue = 0;
    var max2ndValue = 0;
    var min2ndValue = 0;

    for (var i = 0, iMax = newDataRows.length; i < iMax; i++) {
        var dataRow = newDataRows[i];
        var element = {};
        element.index = i;
        element.id = dataRow.dims[0].id;
        element.uniqueId = level + "L" + element.id;
        element.name = dataRow.dims[0].name.trim();
        element.barValues = that.barValuesToShow(dataRow);
        element.lineValues = that.lineValuesToShow(dataRow);
        element.avgValues = avgValues;
        element.sumBarValues = (that.valBarNumber > 0) ? element.barValues[that.valBarNumber - 1].value + element.barValues[that.valBarNumber - 1].accumulation : 0;

        var mx = 0;

        var lineValsArray = global.getArrayFromObjectArrayByProperty(element.lineValues, 'value');
        var currentMaxValue = Math.max((element.sumBarValues || 0), (d3.max(lineValsArray) || 0));
        var currentMinValue = Math.min((element.sumBarValues || 0), (d3.min(lineValsArray) || 0));

        if (currentMaxValue >= maxValue) {
            max2ndValue = maxValue;
            maxValue = currentMaxValue;
        } else if (currentMaxValue >= max2ndValue) {
            max2ndValue = currentMaxValue;
        }

        if (currentMinValue <= minValue) {
            min2ndValue = minValue;
            minValue = currentMinValue;
        } else if (currentMinValue <= min2ndValue) {
            min2ndValue = currentMinValue;
        }

        element.tooltip = that.getTooltip(element);
        dataArray.push(element);
    }

    // Második végigfutás: a kirajzoláshoz szükséges értékek meghatározása.
    var onlyOneBarX = that.xScale.range()[1];	// Ha csak 1 diagramelem van, az ilyen széles a paddinggal együtt.
    var onlyOneBarWidth = onlyOneBarX * (1 - that.barPadding); // Ha csak 1 diagramelem van, az ilyen széles.

    // A második legnagyobb abszolutértékű kiszedése
    var numbers = [Math.abs(maxValue), Math.abs(minValue), Math.abs(max2ndValue), Math.abs(min2ndValue)];
    var maxAbsNumber = Math.max.apply(null, numbers);
    numbers.splice(numbers.indexOf(maxAbsNumber), 1);
    var secondAbsNumber = Math.max.apply(null, numbers);

    var dataMax = Math.max(maxValue, maxAvgValue, 0); // Az Y skála végpontja: a legnagyobb ábrázolandó érték.
    var dataMin = Math.min(minValue, minAvgValue, 0); // Az Y skála alsóvégpontja: a legkisebb ábrázolandó érték.	

    // Ha a maximum sokkal nagyobb, mint a következő abszolút értéke, és legalább 3 elem van, akkor úgy módosítjuk a skálát, hogy elszálljon felfelé.
    if (dataMax > that.cutLimit * secondAbsNumber && secondAbsNumber > 0 && newDataRows.length > 2) {
        dataMax = max2ndValue * that.cutConstant;
    }

    // Ha a minimum sokkal kisebb, mint a következő abszolút értéke, és legalább 3 elem van, akkor úgy módosítjuk a skálát, hogy elszálljon lefelé.
    if (dataMin < -that.cutLimit * secondAbsNumber && secondAbsNumber > 0 && newDataRows.length > 2) {
        dataMin = min2ndValue * that.cutConstant;
    }

    var oldDataMax = that.yScale.domain()[1]; // Az Y skála régi végpontja.
    var oldDataMin = that.yScale.domain()[0]; // Az Y skála régi alsó végpontja.

    that.setYScale([dataMin, dataMax]);	// Az új Y skála beállítása.
    var yMagRatio = (that.isStretched) ? 1 : (that.yScale.domain()[1] - that.yScale.domain()[0]) / (oldDataMax - oldDataMin); // A régi és az új Y skála közötti arány.

    var strechScale = d3.scaleLinear() // Identikus skála; ha széthúzott üzemmódban vagyunk, akkor minden egyes elemnél átalakítjuk.
            .domain([dataMin, dataMax])
            .range([dataMin, dataMax]);

    var elementWidth = that.xScale(1 - that.barPadding); // Az új elemek végső szélessége.
    var oldX = (openFromElement) ? openFromElement.x : 0; // Az új elemek kinyitásának kezdőpozíciója.

    for (var i = 0, iMax = dataArray.length; i < iMax; i++) {
        element = dataArray[i];
        if (that.isStretched) { // Ha 100%-ra széthúzott módban vagyunk, az oszlopok skáláját hozzáigazítjuk.
            strechScale.domain([0, element.sumBarValues]);
        }

        // Az új megjelenési koordináták beállítása.
        element.x = that.xScale(i + that.barPadding / 2);
        element.width = elementWidth;
        for (var j = 0, jMax = that.valBarNumber; j < jMax; j++) {
            var d = element.barValues[j];
            d.height = that.yScale(strechScale(0)) - that.yScale(strechScale(Math.abs(d.value)));
            d.y = (d.value >= 0) ? that.yScale(strechScale(d.value + d.accumulation)) : that.yScale(strechScale(d.accumulation));
            d.tooltip = element.tooltip;
        }

        // A régi koordináták beállítása: innen fog kinyílni az animáció.
        if (drill.direction === -1 && openFromElement) { // Ha bezoomolás van
            element.oldX = oldX || 0;
            element.oldWidth = (openFromElement.width / iMax) || 0;
            oldX = oldX + element.oldWidth;
            for (var j = 0, jMax = that.valBarNumber; j < jMax; j++) {
                element.barValues[j].oldHeight = openFromElement.barValues[j].height || 0;
                element.barValues[j].oldY = openFromElement.barValues[j].y || 0;
            }
        } else if (drill.direction === 1) { // Ha kizoomolás van
            element.oldX = (i - openToElementIndex + that.barPadding / 2) * onlyOneBarX || 0;
            element.oldWidth = onlyOneBarWidth || 0;
            for (var j = 0, jMax = that.valBarNumber; j < jMax; j++) {
                var value = element.barValues[j] || 0;
                value.oldHeight = global.orZero(yMagRatio * value.height) || 0;
                value.oldY = global.orZero(that.height * (1 - yMagRatio) + yMagRatio * value.y) || 0;
            }
        } else { // Szinten maradás esetén
            element.oldX = element.x || 0;
            element.oldWidth = element.width || 0;
            for (var j = 0, jMax = that.valBarNumber; j < jMax; j++) {
                var value = element.barValues[j] || 0;
                value.oldHeight = 0 || 0;
                value.oldY = that.yScale(0) || 0;
            }
        }
    }

    // Átlagértékek meghatározása
    for (var j = 0, jMax = that.valAvgNumber; j < jMax; j++) {
        var avgVal = avgValues[j];
        avgVal.id = that.valAvgToShow[j];
        avgVal.y = that.yScale(avgValues[j].value);
        avgVal.x0 = 1;
        avgVal.x1 = that.width + that.avgTextHeight;

        if (drill.direction === -1 && oldPreparedData) { // Ha bezoomolás van
            avgVal.oldY = oldPreparedData.avgValues[j].y || 0;
            avgVal.oldX0 = (openFromElement.x - (openFromElement.width * that.barPadding / 2)) || 0;
            avgVal.oldX1 = (openFromElement.x + (openFromElement.width * (1 + that.barPadding / 2))) || 0;
        } else if (drill.direction === 1 && oldPreparedData) { // Ha kizoomolás van
            avgVal.oldY = oldPreparedData.avgValues[j].y || 0;
            avgVal.oldX0 = ((-openToElementIndex + that.barPadding / 2) * onlyOneBarX) || 0;
            avgVal.oldX1 = ((dataArray.length - openToElementIndex + that.barPadding / 2) * onlyOneBarX) || 0;
        } else { // Szinten maradás esetén
            avgVal.oldY = (oldPreparedData) ? (oldPreparedData.avgValues[j].y || 0) : (that.height || 0);
            avgVal.oldX0 = 1;
            avgVal.oldX1 = that.width + that.avgTextHeight;
        }
    }

    // A vonaldiagramok adatainak meghatározása.
    var openFromIndex = (drill.direction === -1 && openFromElement) ? openFromElement.index + 1 : undefined;

    var lineArray = [];
    for (var j = 0, jMax = that.valLineNumber; j < jMax; j++) {
        var oldLineArray = (oldPreparedData) ? oldPreparedData.lineArray[j] : undefined;
        var oldAvg = (oldPreparedData) ? d3.mean(oldLineArray, function(d) {
            return (d.id < -10) ? undefined : d.y;
        }) : that.heiht;

        var line = [];
        line.push({id: -99, isFake: true, number: j}); // Kamu 0. elem berakása, hogy a vonal a széléig legyen kihúzva.
        for (var i = 0, iMax = dataArray.length; i < iMax; i++) {
            var lineElement = {};
            lineElement.id = dataArray[i].id;
            lineElement.number = j;
            lineElement.uniqueId = dataArray[i].uniqueId;
            lineElement.name = dataArray[i].name.trim();
            lineElement.value = dataArray[i].lineValues[j].value;
            lineElement.x = that.xScale(i + 0.5);
            lineElement.y = that.yScale(lineElement.value);
            lineElement.tooltip = dataArray[i].tooltip;
            line.push(lineElement);
        }
        var iMax = dataArray.length;
        line.push({id: -999, isFake: true, number: j});

        line[0].x = (iMax > 1) ? that.extrapolate("x", line[1], line[2]) : 0;
        line[0].y = (iMax > 1) ? that.extrapolate("y", line[1], line[2]) : line[1].y;

        line[iMax + 1].x = (iMax > 1) ? that.extrapolate("x", line[iMax], line[iMax - 1]) : that.width;
        line[iMax + 1].y = (iMax > 1) ? that.extrapolate("y", line[iMax], line[iMax - 1]) : line[iMax - 1].y;

        for (var i = 0, iMax = line.length; i < iMax; i++) {
            if (drill.direction === -1 && openFromIndex) { // Ha bezoomolás van
                line[i].oldX = that.interpolate("x", oldLineArray[openFromIndex - 1], oldLineArray[openFromIndex], oldLineArray[openFromIndex + 1], i, iMax - 1) || 0;
                line[i].oldY = that.interpolate("y", oldLineArray[openFromIndex - 1], oldLineArray[openFromIndex], oldLineArray[openFromIndex + 1], i, iMax - 1) || 0;
            } else if (drill.direction === 1) { // Ha kizoomolás van
                line[i].oldX = ((i - 0.5 - openToElementIndex) * onlyOneBarX) || 0;
                line[i].oldY = oldAvg || 0;
            } else { // Szinten maradás esetén.
                if (oldLineArray) { // Ha van előző adat.
                    var idx = line[i].id;
                    var oldElement = global.getFromArrayByProperty(oldLineArray, 'id', idx) || 0;
                    line[i].oldX = ((oldElement) ? oldElement.x : that.xScale(i - 0.5)) || 0;
                    line[i].oldY = ((oldElement) ? oldElement.y : that.height) || 0;
                } else { // Ha minden szűz.
                    line[i].oldX = ((i === 0) ? 0 : (i === iMax - 1) ? that.width : that.xScale(i - 0.5)) || 0;
                    line[i].oldY = that.height || 0;
                }
            }
        }
        lineArray.push(line);
    }

    return {avgValues: avgValues, dataArray: dataArray, lineArray: lineArray};
};

/**
 * Új adat megérkeztekor levezényli a panel frissítését.
 * 
 * @param {Object} data Az új adat.
 * @param {Object} drill Az épp végrehajzásra kerülő fúrás.
 * @param {Number} duration Az animáció ideje.
 * @returns {undefined}
 */
panel_barline.prototype.update = function(data, drill, duration) {
    var that = this;

    if (drill && drill.duration !== undefined) {
        duration = drill.duration;
    }
    that.data = data || that.data;
    drill = drill || {dim: -1, direction: 0};

    // A hányados kijelzés, és a szorzó felfrissítése.
    var forbidRatio = false;
    var forbidNominator = false;
    for (var i = 0, iMax = that.legendArray.length; i < iMax; i++) {
        if (that.meta.indicators[that.legendArray[i].id].value.hide) {
            forbidNominator = true;
            that.valFraction = true;
        }
        if (that.meta.indicators[that.legendArray[i].id].fraction.hide) {
            forbidRatio = true;
            that.valFraction = false;
        }
    }

    // Ha túl sok megjelenítendő adat van, akkor át se nézzük őket.
    if (that.data.rows.length > that.maxEntries) {
        that.panic(true, _("<html>A panel nem képes ") + that.data.rows.length + _(" értéket megjeleníteni.<br />A maximálisan megjeleníthető értékek száma ") + that.maxEntries + _(".</html>"));
        that.processedData = undefined;
    } else {

        // Ha meg van tiltva mind az egyenes adat, mint a hányados megjelenítése, akkor pánik!
        if (forbidRatio && forbidNominator) {
            that.panic(true, _("<html>Az ellentétes megjelenítési utasítások miatt<br />az adatok nem megjeleníthetőek.</html>"));
            that.processedData = undefined;

            // Különben normál működés.
        } else {
            that.panic(false);

            // A szorzó-tömb felfrissítése.
            that.valBarMultipliers = [];
            for (var i = 0, iMax = that.valBarNumber; i < iMax; i++) {
                var mult = parseFloat(that.meta.indicators[that.valBarsToShow[i]].fraction.multiplier);
                that.valBarMultipliers.push((isNaN(mult)) ? 1 : mult);
            }
            that.valLineMultipliers = [];
            for (var i = 0, iMax = that.valLineNumber; i < iMax; i++) {
                var mult = parseFloat(that.meta.indicators[that.valLinesToShow[i]].fraction.multiplier);
                that.valLineMultipliers.push((isNaN(mult)) ? 1 : mult);
            }
            that.valAvgMultipliers = [];
            for (var i = 0, iMax = that.valAvgNumber; i < iMax; i++) {
                var mult = parseFloat(that.meta.indicators[that.valAvgToShow[i]].fraction.multiplier);
                that.valAvgMultipliers.push((isNaN(mult)) ? 1 : mult);
            }

            // Adatok feldolgozása, a magejelenési adatok elkészítése.
            that.processedData = that.prepareData(that.processedData, that.data.rows, drill);

            // Tengelyek, oszlopelemek, vonalelemek, átlagelemek felfrissítése.
            var tweenDuration = (duration === undefined) ? global.getAnimDuration(-1, that.panelId) : duration;
            var trans = d3.transition().duration(tweenDuration);
            that.drawAxes(that.processedData, trans);
            that.drawBars(that.processedData, trans);
            that.drawLines(that.processedData, trans, (drill.dim !== -1));
            that.drawAvgLines(that.processedData, trans);
        }
    }

    // A fejléc és a jelkulcs felfrissítése.
    if (that.singleValMode) {
        var titleMeta = that.localMeta.indicators[that.legendArray[0].id];
        that.titleBox.update(that.legendArray[0].id, titleMeta.caption, titleMeta.value.unitPlural, titleMeta.fraction.unitPlural, that.valFraction, tweenDuration);
    } else {
        if (drill.toId === undefined || drill.dim === -1) {
            var titleMetaArray = that.localMeta.indicators;
            var idA = [], nameA = [], valueUnitA = [], fractionUnitA = [];
            for (var i = 0, iMax = that.legendArray.length; i < iMax; i++) {
                var id = that.legendArray[i].id;
                idA.push(id);
                nameA.push(titleMetaArray[id].caption);
                valueUnitA.push(titleMetaArray[id].value.unitPlural);
                fractionUnitA.push(titleMetaArray[id].fraction.unitPlural);
            }
            that.titleBox.update(idA, nameA, valueUnitA, fractionUnitA, that.valFraction, tweenDuration);
            that.drawLegend();
        }
    }
};

/**
 * Kirajzolja és helyére animálja az oszlopdiagramokat.
 * 
 * @param {Object} preparedData Az ábrázoláshoz előkészített adat.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_barline.prototype.drawBars = function(preparedData, trans) {
    var that = this;

    if (that.valBarNumber > 0) {

        // Egy téglalap konténere, és a hozzá tartozó adat hozzácsapása.
        var gBar = that.gBars.selectAll(".bar")
                .data(preparedData.dataArray, function(d) {
                    return d.uniqueId;
                });

        // Kilépő oszlopkonténer törlése.
        gBar.exit()
                .on("click", null)
                .remove();

        // A halmozott oszlopdiagramban az egyes értékek oszlopelemei, és az adat hozzápárosítása.
        gBar.selectAll("rect")
                .data(function(d) {
                    return d.barValues;
                });

        // Az új oszlopok tartójának elkészítése.
        var gBarNew = gBar.enter().append("svg:g")
                .attr("class", "bar bordered")
                .attr("transform", function(d) {
                    return "translate(" + d.oldX + ", 0)";
                })
                .attr("opacity", function(d) {
                    return (global.valueInRange(d.oldX + d.oldWidth / 2, 0, that.w)) ? 1 : 0;
                });

        // Elemi oszlopelemek megrajzolása.
        var oldWidth = preparedData.dataArray[0].oldWidth; // A régi téglalapszélesség; ki kell szedni, hogy minden elemhez használhassuk.
        gBarNew.selectAll("rect")
                .data(function(d) {
                    return d.barValues;
                })
                .enter().append("svg:rect")
                .attr("x", 0)
                .attr("width", oldWidth)
                .attr("y", function(d2) {
                    return d2.oldY;
                })
                .attr("height", function(d2) {
                    return d2.oldHeight;
                })
                .attr("fill", function(d2, i2) {
                    return global.colorValue(that.valBarsToShow[i2]);
                });

        // Új és maradó elemek összeöntése.
        gBar = gBarNew.merge(gBar);

        // Lefúrás eseménykezelőjének hozzácsapása az oszlopkonténerhez.
        gBar.classed("listener", true)
                .on("click", function(d) {
                    that.drill(d);
                });

        // Megjelenési animáció: akárhol is volt, a helyére megy.
        gBar.transition(trans)
                .attr("transform", function(d) {
                    return "translate(" + d.x + ", 0)";
                })
                .attr("opacity", 1)
                .on("end", function() {
                    d3.select(this).classed("darkenable", true);
                })
                .selectAll("rect")
                .attr("class", function(d, i) {
                    return "controlled controlled" + that.valBarsToShow[i];
                })
                .attr("y", function(d) {
                    return d.y;
                })
                .attr("height", function(d) {
                    return d.height;
                })
                .attr("width", that.xScale(1 - that.barPadding))
                .attr("fill", function(d2, i2) {
                    return global.colorValue(that.valBarsToShow[i2]);
                });

    }
};

/**
 * Kirajzolja és helyére animálja a vonaldiagramokat.
 * 
 * @param {Object} preparedData Az ábrázoláshoz előkészített adat.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @param {Boolean} isClearRequired Le kell-e törölni az előző vonalakat?
 * @returns {undefined}
 */
panel_barline.prototype.drawLines = function(preparedData, trans, isClearRequired) {
    var that = this;
    if (that.valLineNumber > 0) {

        // Ha kell, letöröljük a meglevő vonalakat.
        if (isClearRequired) {
            that.gLines.selectAll(".lineChart").remove();
        }

        // Vonalak, és az adat hozzájukcsapása.
        var line = this.gLines.selectAll(".lineChart")
                .data(preparedData.lineArray);

        // Új vonalelemek kirajzolása, és a régiekkel való összeöntése.
        line = line.enter().insert("svg:path", ".lineSymbolGroup")
                .attr("d", that.oldLineBarGenerator)
                .attr("stroke", function(d, i) {
                    return global.colorValue(that.valLinesToShow[i]);
                })
                .merge(line);

        // A maradó vonalakt jó helyre animáljuk, megjelenítjük.
        line.transition(trans)
                .attr("class", function(d, i) {
                    return "noEvents lineChart controlled controlled" + that.valLinesToShow[i];
                })
                .attr("d", that.lineBarGenerator)
                .attr("stroke", function(d, i) {
                    return global.colorValue(that.valLinesToShow[i]);
                });

        // Egy vonalhoz tartozó összes szimbólum tartója, és az adatok hozzátársítása.
        var lineSymbolGroups = this.gLines.selectAll(".lineSymbolGroup")
                .data(preparedData.lineArray);

        // Belépő szimbólumtartók létrehozása, a régiekkel való összeöntése.
        lineSymbolGroups = lineSymbolGroups.enter().append("svg:g").merge(lineSymbolGroups);

        // Összes szimbólumtartó osztályának beállítása.
        lineSymbolGroups.attr("class", function(d, i) {
            return "lineSymbolGroup controlled controlled" + that.valLinesToShow[i];
        });

        // Egy szimbólumelem tartója; ebbe kerül a szimbólum setét háttere, és maga a szimbólum.
        var lineSymbolHolder = lineSymbolGroups.selectAll(".lineSymbolHolder")
                .data(function(d) {
                    return d;
                }, function(d) {
                    return d.uniqueId + "s" + that.valLinesToShow[0];
                });

        // Eltűnő elemek levevése.
        lineSymbolHolder.exit()
                .classed("darkenable", false)
                .on("click", null)
                .transition(trans)
                .attr("opacity", 0)
                .attr("transform", function(d) {
                    return "translate(" + d.x + "," + that.height + ")";
                })
                .remove();

        // Megmaradók alakját és színét jóvá alakítjuk. A hátteret és a szimbólumot is.
        lineSymbolHolder.select(".shadow")
                .attr("d", function(d) {
                    return d3.symbol().type(d3.symbols[(that.valLinesToShow[d.number]) % 6]).size(that.symbolSize_background)();
                });
        lineSymbolHolder.select(".lineSymbol:not(.shadow)")
                .attr("d", function(d) {
                    return d3.symbol().type(d3.symbols[(that.valLinesToShow[d.number]) % 6]).size(that.symbolSize)();
                })
                .transition(trans)
                .attr("fill", function(d) {
                    return global.colorValue(that.valLinesToShow[d.number]);
                });

        // Az új szimbólumok tartócsoportjának létrehozása.
        var lineSymbolHolder_new = lineSymbolHolder.enter().append("svg:g")
                .attr("class", "lineSymbolHolder listener")
                .attr("transform", function(d) {
                    return "translate(" + d.oldX + "," + d.oldY + ")";
                })
                .on("click", function(d) {
                    if (!d.isFake) {
                        that.drill(d);
                    }
                });

        // Az új szimbólum sötét háttere.
        lineSymbolHolder_new.append("svg:path")
                .attr("class", "lineSymbol shadow")
                .attr("d", function(d) {
                    return d3.symbol().type(d3.symbols[(that.valLinesToShow[d.number]) % 6]).size(that.symbolSize_background)();
                });

        // Az új szimbólum maga.
        lineSymbolHolder_new.append("svg:path")
                .attr("class", "lineSymbol")
                .attr("d", function(d) {
                    return d3.symbol().type(d3.symbols[(that.valLinesToShow[d.number]) % 6]).size(that.symbolSize)();
                })
                .attr("fill", function(d) {
                    return global.colorValue(that.valLinesToShow[d.number]);
                });

        // Új és maradó elemek összeöntése.
        lineSymbolHolder = lineSymbolHolder_new.merge(lineSymbolHolder);

        // Maradó szimbólumok helyre mozgatása.
        lineSymbolHolder.transition(trans)
                .attr("opacity", function(d) {
                    return (!d.isFake && that.isSymbolsRequired) ? 1 : 0;
                })
                .attr("transform", function(d) {
                    return "translate(" + d.x + "," + d.y + ")";
                })
                .on("end", function(d) {
                    d3.select(this).select(".lineSymbol:not(.shadow)").classed("darkenable", !d.isFake);
                });
    }
};

/**
 * Kirajzolja és helyére animálja az átlagvonalakat.
 * 
 * @param {Object} preparedData Az ábrázoláshoz előkészített adat.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_barline.prototype.drawAvgLines = function(preparedData, trans) {
    var that = this;
    if (that.valAvgNumber > 0 && !that.isStretched) {

        // Az átlagvonalak, és a hozzájuk tartozó adatok társítása.
        var avgLine = this.gAvgLines.selectAll("path").data(preparedData.avgValues,
                function(d) {
                    return d.uniqueId;
                });

        // Kilépő átlagvonalak letörlése.
        avgLine.exit().remove();

        // Belépő átlagvonalak kirajzolása, és a maradókkal való összeöntése.
        avgLine = avgLine.enter().append("svg:path")
                .attr("opacity", 0)
                .merge(avgLine);

        // Az átlagvonalak kirajzolása, és helyre animálása.
        avgLine.attr("d", function(d) {
            return that.horizontalLine(d.oldX0, d.oldX1, d.oldY);
        })
                .attr("class", function(d, i) {
                    return "noEvents lineChart controlled controlled" + that.valAvgToShow[i];
                })
                .transition(trans)
                .attr("stroke", function(d, i) {
                    return d3.rgb(global.colorValue(that.valAvgToShow[i])).darker(2);
                })
                .attr("d", function(d) {
                    return that.horizontalLine(d.x0, d.x1, d.y);
                })
                .attr("opacity", 1);

        // Az "Átlag" szöveghez való adattársítás.
        var avgText = this.gAvgLines.selectAll("text").data(preparedData.avgValues,
                function(d) {
                    return d.id;
                });

        // Kilépő szöveg törlése.
        avgText.exit().remove();

        // Belépő szöveg felrajzolása, és a maradókkal való összeöntés.
        avgText = avgText.enter().append("svg:text")
                .attr("class", function(d, i) {
                    return "noEvents controlled controlled" + that.valAvgToShow[i];
                })
                .attr("text-anchor", "begin")
                .attr("x", function(d) {
                    return d.oldX1 + that.avgTextHeight;
                })
                .attr("y", function(d) {
                    return d.oldY;
                })
                .attr("dy", "-.25em")
                .attr("dx", ".35em")
                .attr("opacity", 0)
                .attr("transform", function(d) {
                    return "rotate(-90," + (d.oldX1 + that.avgTextHeight) + "," + d.oldY + ")";
                }).merge(avgText);

        // "Átlag" felirat helyre animálása.
        avgText.transition(trans)
                .attr("x", that.width + that.avgTextHeight)
                .attr("y", function(d) {
                    return d.y;
                })
                .attr("opacity", 1)
                .attr("stroke", function(d, i) {
                    return d3.rgb(global.colorValue(that.valAvgToShow[i])).darker(2);
                })
                .attr("transform", function(d) {
                    return "rotate(-90," + (that.width + that.avgTextHeight) + "," + d.y + ")";
                })
                .text(that.avgText);
    } else {
        this.gAvgLines.selectAll("*").remove();
    }
};

/**
 * Jelkulcs felrajzolása.
 * 
 * @returns {undefined}
 */
panel_barline.prototype.drawLegend = function() {
    var that = this;

    // Csak ha üres még a jelkulcs, ez ugyanis nem változhat.
    if (that.gLegend.selectAll(".legend").empty()) {

        var l_width = that.legendWidth / that.legendArray.length;	// A kirajzolandó jelkulcstéglalapok szélessége.
        var l_height = global.legendHeight;								// A kirajzolandó jelkulcstéglalapok magassága.

        // Belépő jelkulcselemek, az adatok hozzátársítása.
        var legendEntry = that.gLegend.selectAll("g.lineLegend")
                .data(that.legendArray).enter();

        // Oszlop- vagy vonaldiagramhoz tartozó jelkulcs tartójának kirajzolása. Fontos: a ".bar_group" elé kell tenni, hogy irányíthassa azt.
        var gLegend = legendEntry.insert("svg:g", ".bar_group")
                .attr("class", function(d, i) {
                    return "listener droptarget droptarget1 legend legendControl" + d.id;
                })
                .attr("transform", function(d, i) {
                    return "translate(" + (i * l_width + that.legendOffsetX * 1.5) + ", " + (that.h - l_height - global.legendOffsetY) + ")";
                })
                .on("mouseover", function(d) {
                    if (global.dragDropManager.draggedType === null) {
                        d3.select(this).classed("triggered", true);
                    } else {
                        that.hoverOn(this, d.id);
                    }
                })
                .on("mouseout", function() {
                    if (global.dragDropManager.draggedType === null) {
                        d3.select(this).classed("triggered", false);
                    } else {
                        that.hoverOff();
                    }
                })
                .on("click", function(d) {
                    that.toggleAvg(d.id);
                });

        // A jelkulcs-téglalap kirajzolása.
        gLegend.append("svg:rect")
                .attr("class", function(d) {
                    return (!d.isLineRequired && !d.isAvgRequired) ? "bordered " : "lineChartLegend ";
                })
                .attr("rx", global.rectRounding)
                .attr("ry", global.rectRounding)
                .attr("width", l_width - that.legendOffsetX)
                .attr("height", l_height)
                .attr("fill", function(d) {
                    return global.colorValue(d.id);
                })
                .attr("fill-opacity", function(d) {
                    return (d.isBarRequired) ? 1 : 0;
                })
                .attr("stroke", function(d) {
                    return global.colorValue(d.id);
                })
                .attr("stroke-opacity", function(d) {
                    return (d.isLineRequired) ? 1 : 0;
                });

        // Átlagvonalhoz tartozó jelkulcs kirajzolása.
        gLegend.append("svg:rect")
                .select(function(d) {
                    return (d.isAvgRequired) ? this : null;
                })
                .attr("class", function(d) {
                    return "lineChartLegend legend noEvents";
                })
                .attr("rx", global.rectRounding)
                .attr("ry", global.rectRounding)
                .attr("width", l_width - that.legendOffsetX)
                .attr("height", l_height)
                .attr("fill", "none")
                .attr("stroke", function(d) {
                    return d3.rgb(global.colorValue(d.id)).darker(2);
                })
                .attr("stroke-dasharray", function(d) {
                    return (d.isLineRequired) ? 10 : "none";
                });

        // Jelölők kirajzolása, ha szükséges.
        if (that.isSymbolsRequired) {

            // Jelölő-háttér.
            gLegend.append("svg:path")
                    .select(function(d) {
                        return (d.isLineRequired) ? this : null;
                    })
                    .attr("class", "lineSymbol legend shadow noEvents")
                    .attr("d", function(d) {
                        return d3.symbol().type(d3.symbols[d.id % 6]).size(that.symbolSize_background)();
                    })
                    .attr("transform", function(d, i) {
                        return "translate(" + (global.rectRounding / 2) + ", 0)";
                    });

            // Jelölő maga.
            gLegend.append("svg:path")
                    .select(function(d) {
                        return (d.isLineRequired) ? this : null;
                    })
                    .attr("class", "lineSymbol legend noEvents")
                    .attr("d", function(d) {
                        return d3.symbol().type(d3.symbols[d.id % 6]).size(that.symbolSize)();
                    })
                    .attr("fill", function(d) {
                        return global.colorValue(d.id);
                    })
                    .attr("transform", function(d, i) {
                        return "translate(" + (global.rectRounding / 2) + ", 0)";
                    });
        }

        // A jelkulcs-szöveg kiírása.
        var legendText = gLegend.append("svg:text")
                .attr("class", "legend noEvents")
                .attr("y", global.legendHeight / 2)
                .attr("dy", ".35em")
                .attr("fill", function(d) {
                    return global.readableColor((d.isBarRequired) ? global.colorValue(d.id) : global.panelBackgroundColor);
                })
                .text(function(d, i) {
                    return that.localMeta.indicators[that.legendArray[i].id].caption;
                });

        // Jelkulcs-szövegek formázása, hogy beférjenek.
        global.cleverCompress(legendText, l_width - 1.8 * that.legendOffsetX, 1, undefined, false, true, l_width - that.legendOffsetX);

        // A jelkulcselemek hozzácsapása a maszkhoz. (A jelkulcsnak a téglalapok előtt kell lennie a kódban, mert csak akkor tudja irányítani, de akkor bekúszna alája.)
        var legendEntryMask = that.mask.selectAll("g.lineLegend")
                .data(that.legendArray).enter();

        // Oszlop- vagy vonaldiagramhoz tartozó jelkulcs tartójának a maszkhoz adása.
        var gLegendMask = legendEntryMask.append("svg:g")
                .attr("transform", function(d, i) {
                    return "translate(" + (i * l_width + that.legendOffsetX * 1.5 - that.margin.left) + ", " + (that.h - l_height - global.legendOffsetY - that.margin.top) + ")";
                });

        // A jelkulcs-téglalap maszkra rajzolása.
        gLegendMask.append("svg:rect")
                .attr("class", function(d) {
                    return (!d.isLineRequired && !d.isAvgRequired) ? "bordered " : "lineChartLegend ";
                })
                .attr("rx", global.rectRounding)
                .attr("ry", global.rectRounding)
                .attr("width", l_width - that.legendOffsetX)
                .attr("height", l_height)
                .attr("fill", "black")
                .attr("stroke", "black")
                .attr("stroke-opacity", function(d) {
                    return (d.isLineRequired) ? 1 : 0;
                });
    }
};

/**
 * A tengelyek kirajzolása.
 * 
 * @param {Object} preparedData A panel által megjelenítendő, feldolgozott adatok.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_barline.prototype.drawAxes = function(preparedData, trans) {
    var that = this;

    var shadowSize = global.axisTextSize(that.xScale(1));	// A vízszintes tengely betűje mögötti klikk-téglalap mérete.
    var axisTextSize = (shadowSize < 6) ? 0 : shadowSize;	// A vízszintes tengely betűmérete.

    // Függőleges tengely kirajzolása, animálása.
    if (that.gAxisY.selectAll("path").nodes().length > 0) {
        that.gAxisY.transition(trans).call(that.yAxis);
    } else {
        that.gAxisY.call(that.yAxis);
    }

    // Vízszintes tengely elmozgatása (negatív értékek kijelzésekor nem alul kell lennie)
    that.gAxisX.select("line").transition(trans).attrs({
        x1: 0,
        y1: that.yScale(0),
        x2: that.width,
        y2: that.yScale(0)});

    // Feliratok a vízszintes tengelyre, és a hozzá tartozó adat.
    var axisLabelX = that.gAxisX.selectAll("text")
            .data(preparedData.dataArray, function(d) {
                return d.id + d.name;
            });

    // Kilépő feliratok letörlése.
    axisLabelX.exit()
            .transition(trans).attr("opacity", 0)
            .remove();

    // Belépő feliratok elhelyezése.
    var axisLabelXNew = axisLabelX.enter()
            .append("svg:text")
            .attr("class", "shadowedLabel")
            .attr("font-size", axisTextSize)
            .attr("opacity", function(d) {
                return (global.valueInRange(d.oldX + d.oldWidth / 2, 0, that.w)) ? 0 : global.axisTextOpacity;
            })
            .attr("transform", function(d) {
                return "rotate(-90)";
            })
            .attr("x", -that.height + 0.26 * axisTextSize)
            .attr("y", function(d) {
                return d.oldX + d.oldWidth / 2 + 0.35 * axisTextSize;
            })
            .attr("fill", that.xAxisColor)
            .attr("text-anchor", "beginning")
            .text(function(d) {
                return d.name;
            });

    // Új és maradó elemek összeöntése.
    axisLabelX = axisLabelXNew.merge(axisLabelX);

    // Maradó feliratok helyre animálása.
    axisLabelX.transition(trans)
            .attr("font-size", axisTextSize)
            .attr("x", -that.height + 0.26 * axisTextSize)
            .attr("y", function(d) {
                return d.x + d.width / 2 + 0.35 * axisTextSize;
            })
            .attr("opacity", global.axisTextOpacity);

    // Feliratok összenyomása, hogy tuti elférjenek.
    global.cleverCompress(axisLabelXNew, that.height, 0.95, undefined, true);

    // Háttértéglalapok, és azt azt létrehozó időzítés törlése.
    clearTimeout(that.shadowTimeout);
    that.gAxisXShadow.selectAll("rect")
            .on("click", null)
            .remove();

    // Háttértéglalapok, eseménykezelő létrehozása, de csak az animáció lefutása után.
    that.shadowTimeout = setTimeout(function() {
        that.gAxisXShadow.selectAll("rect")
                .data(preparedData.dataArray, function(d) {
                    return d.id + d.name;
                })
                .enter().append("svg:rect")
                .classed("listener", true)
                .attr("width", shadowSize * 1.05)
                .attr("height", function(d) {
                    return Math.max(50, 0.5 * shadowSize + Math.min(that.gAxisX.selectAll("text").filter(function(d2) {
                        return d === d2;
                    }).nodes()[0].getComputedTextLength(), 0.7 * that.h));
                })
                .attr("y", function(d) {
                    return that.height - Math.max(50, 0.5 * shadowSize + Math.min(that.gAxisX.selectAll("text").filter(function(d2) {
                        return d === d2;
                    }).nodes()[0].getComputedTextLength(), 0.7 * that.h));
                })
                .attr("x", function(d) {
                    return d.x + (d.width - shadowSize) / 2;
                })
                .attr("opacity", 0)
                .on("click", function(d) {
                    that.drill(d);
                });
    }, trans.duration());

};

//////////////////////////////////////////////////
// Irányítást végző függvények
//////////////////////////////////////////////////

/**
 * Kiveszi a duplikált ábrázolandó értékeket, felépíti az értékek
 * megjelenítéséhez szükséges mennyiségeket.
 * 
 * @returns {undefined}
 */
panel_barline.prototype.buildValueVectors = function() {
    var that = this;

    // Ha széthúzott a megrendelés, akkor kidobjuk a kért vonalakat és átlagot.
    if (that.isStretched) {
        that.valLinesToShow.length = 0;
        that.valAvgToShow.length = 0;
    }

    // Kiveszi a duplikátumokat az oszlopok, grafikonok és átlagértékek tömbjéből.
    that.valBarsToShow = that.valBarsToShow.filter(function(item, pos) {
        return that.valBarsToShow.indexOf(item) === pos;
    });
    that.valLinesToShow = that.valLinesToShow.filter(function(item, pos) {
        return that.valLinesToShow.indexOf(item) === pos;
    });
    that.valAvgToShow = that.valAvgToShow.filter(function(item, pos) {
        return that.valAvgToShow.indexOf(item) === pos;
    });

    // Kiveszi a grafikonok közül az oszlopként is megjelenítettet.
    that.valLinesToShow = that.valLinesToShow.filter(function(item) {
        return that.valBarsToShow.indexOf(item) === -1;
    });

    // Kiveszi az átlagelemek közül a másutt nem szereplőket.
    that.valAvgToShow = that.valAvgToShow.filter(function(item) {
        return (that.valLinesToShow.indexOf(item) !== -1 || that.valBarsToShow.indexOf(item) !== -1);
    });

    that.valBarNumber = that.valBarsToShow.length;		// Ennyi oszlopelem kell.
    that.valLineNumber = that.valLinesToShow.length;	// Ennyi vonal kell.
    that.valAvgNumber = that.valAvgToShow.length;		// Ennyi átlagvonal kell.
    that.legendArray = that.createLegendArray();		// A jelkulcshoz kellő értékek.
    that.singleValMode = (that.legendArray.length === 1);	// True: csak 1 érték kerül kijelzésre, false: több.	
};

/**
 * Létrehozza az épp aktuális megjelnítendő oszlop-vonal-átlagelemekhez tartozó
 * megjelenítendő jelkulcs-tömböt. (Nem csak a jelkulcsnál használjuk.)
 * 
 * @returns {Array} A megjelenítendő értékek tömbje.
 */
panel_barline.prototype.createLegendArray = function() {
    var that = this;

    var maxValToShow = d3.max([d3.max(that.valBarsToShow), d3.max(that.valLinesToShow), d3.max(that.valAvgToShow)]); // A maximális ábrázolandó érték száma.
    var combinedToShow = [];	// Olyan tömb, ami az i. pozícióban az i. érték megjelenítésének adatait tartalmazza.

    // Az id-k feltöltése.
    for (var i = 0, iMax = maxValToShow + 1; i < iMax; i++) {
        combinedToShow.push({id: i});
    }

    // A megjelenítendő értékek beleírása.
    for (var i = 0, iMax = that.valBarNumber; i < iMax; i++) {
        combinedToShow[that.valBarsToShow[i]].isBarRequired = true;
    }

    // A megjelenítendő átlagvonalak beleírása.
    for (var i = 0, iMax = that.valAvgNumber; i < iMax; i++) {
        combinedToShow[that.valAvgToShow[i]].isAvgRequired = true;
    }

    // A megjelenítendő vonaldiagramok beleírása.
    for (var i = 0, iMax = that.valLineNumber; i < iMax; i++) {
        combinedToShow[that.valLinesToShow[i]].isLineRequired = true;
    }

    // A legend-ben megjelenítendő értékek: az előző tömbből kihagyjuk az üreseket.
    var legendArray = [];
    for (var i = 0, iMax = maxValToShow + 1; i < iMax; i++) {
        if (combinedToShow[i].isBarRequired || combinedToShow[i].isAvgRequired || combinedToShow[i].isLineRequired) {
            legendArray.push(combinedToShow[i]);
        }
    }

    return legendArray;
};

/**
 * Az aktuális dimenzióban történő le vagy felfúrást kezdeményező függvény.
 * 
 * @param {Object} d Lefúrás esetén a lefúrás céleleme. Ha undefined, akkor felfúrásról van szó.
 * @returns {undefined}
 */
panel_barline.prototype.drill = function(d) {
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
 * Átlagkijelzés negálása.
 * 
 * @param {Integer} id A megváltoztatandó érték id-ja.
 * @returns {undefined}
 */
panel_barline.prototype.toggleAvg = function(id) {
    var oldPos = global.positionInArray(this.valAvgToShow, id);
    if (oldPos === -1) {
        this.valAvgToShow.push(id);
    } else {
        this.valAvgToShow.splice(oldPos, 1);
    }
    this.buildValueVectors(); // Segéd értékmutató mennyiségek feltöltése.
    this.processedData = undefined;						// Régi adatok letörlése.
    this.gLegend.selectAll(".legend").remove();			// Jelkulcs letörlése.

    this.update(undefined, undefined, 0);
};

/**
 * A mutató- és hányadosválasztást végrehajtó függvény.
 * 
 * @param {String} panelId A váltást végrehajtó panel azonosítója. Akkor vált, ha az övé, vagy ha undefined.
 * @param {Integer} value Az érték, amire váltani kell. Ha -1 akkor a következőre vált, ha undefined, nem vált.
 * @param {Boolean | Number} ratio Hányadost mutasson-e. Ha -1 akkor a másikra ugrik, ha undefined, nem vált.
 * @param {Number | String} targetId A felcserélendő mutató id-je, vagy "plus"/"minus", ha új értéket kell hozzáadni.
 * @returns {undefined}
 */
panel_barline.prototype.doChangeValue = function(panelId, value, ratio, targetId) {
    var that = this;
    if (panelId === undefined || panelId === that.panelId) {

        // Hányados váltás, vagy értéktáblára kattintás esetén.
        if (ratio !== undefined) {
            that.valFraction = (ratio === -1) ? !that.valFraction : ratio;
            if (value !== undefined && that.singleValMode) {
                if (that.valBarNumber === 1) {
                    that.valBarsToShow[0] = value;
                }
                if (that.valLineNumber === 1) {
                    that.valLinesToShow[0] = value;
                }
                if (that.valAvgNumber === 1) {
                    that.valAvgToShow[0] = value;
                }
                that.buildValueVectors();
            }
        }

        // Különben.
        else {
            var oldvalBarNumber = that.valBarNumber;
            var oldvalLineNumber = that.valLineNumber;
            var oldvalAvgNumber = that.valAvgNumber;
            var anythingchanged = false;

            // A fejlécre klikkelés esetén.
            if (value === -1 && that.singleValMode) {
                anythingchanged = true;
                var newVal = (that.legendArray[0].id + 1) % that.meta.indicators.length;
                if (that.valBarNumber === 1) {
                    that.valBarsToShow[0] = newVal;
                }
                if (that.valLineNumber === 1) {
                    that.valLinesToShow[0] = newVal;
                }
                if (that.valAvgNumber === 1) {
                    that.valAvgToShow[0] = newVal;
                }
            }

            // Új érték hozzáadása esetén.
            if (value > -1 && (targetId === "bar" || targetId === "line")) {
                anythingchanged = true;
                if (targetId === "bar") {
                    that.valBarsToShow.push(value);
                } else {
                    that.valLinesToShow.push(value);
                    var index = that.valBarsToShow.indexOf(value);
                    if (index !== -1) {
                        that.valBarsToShow.splice(index, 1);
                    }
                }
            }

            // Érték fejlécre ejtése esetén.
            if (targetId === undefined) {
                anythingchanged = true;
                if (that.valBarNumber < that.valLineNumber) {
                    that.valLinesToShow[0] = value;
                    that.valLinesToShow.length = 1;
                    that.valBarsToShow.length = 0;
                    that.valAvgToShow.length = 0;
                } else {
                    that.valBarsToShow[0] = value;
                    that.valBarsToShow.length = 1;
                    that.valLinesToShow.length = 0;
                    that.valAvgToShow.length = 0;
                }
                if (that.valAvgNumber > 0) {
                    that.valAvgToShow[0] = value;
                    that.valAvgToShow.length = 1;
                }
            }

            // Értékcsere esetén.
            if (!isNaN(value) && !isNaN(targetId)) {
                anythingchanged = true;
                var oldPos = global.positionInArray(that.valBarsToShow, targetId);
                if (oldPos !== -1) {
                    that.valBarsToShow[oldPos] = value;
                }

                var oldPos = global.positionInArray(that.valLinesToShow, targetId);
                if (oldPos !== -1) {
                    that.valLinesToShow[oldPos] = value;
                }

                var oldPos = global.positionInArray(that.valAvgToShow, targetId);
                if (oldPos !== -1) {
                    that.valAvgToShow[oldPos] = value;
                }
                that.gLegend.selectAll(".legend").remove();
                that.mask.selectAll("g").remove();                   // Jelkulcs-maszk.
            }

            if (anythingchanged) {
                that.buildValueVectors(); // Segéd értékmutató mennyiségek feltöltése.
                that.changeConfiguration(!that.singleValMode, global.numberOffset, that.avgTextHeight, 0, 0); // Konfiguráció beállítása.

                // Letöröljük azokat, amiket újra kell rajzolni:
                that.processedData = undefined;						// Régi adatok.

                // Oszlopdiagramok.
                if (oldvalBarNumber !== this.valBarNumber) {
                    that.gBars.selectAll("*").remove();
                }

                // Vonaldiagramok.
                if (oldvalLineNumber !== this.valLineNumber) {
                    that.gLines.selectAll("*").remove();
                }

                // Átlagvonalak.
                if (oldvalAvgNumber !== this.valAvgNumber) {
                    that.gAvgLines.selectAll("*").remove();
                }

                that.gLegend.selectAll(".legend").remove();			// Jelkulcs.
                that.mask.selectAll("g").remove();                   // Jelkulcs-maszk.
                that.svg.selectAll(".hoveredDropTarget").remove();	// A dobóterület-kijelzés.
            }
        }

        that.actualInit.valbars = that.valBarsToShow;
        that.actualInit.vallines = that.valLinesToShow;
        that.actualInit.valavglines = that.valAvgToShow;
        that.actualInit.ratio = that.valFraction;
        that.update();
        global.getConfig2();
    }
};

/**
 * A dimenzióváltást végrehajtó függvény.
 * 
 * @param {String} panelId A dimenzióváltást kapó panel ID-ja.
 * @param {Integer} newDimId A helyére bejövő dimenzió ID-ja.
 * @returns {undefined}
 */
panel_barline.prototype.doChangeDimension = function(panelId, newDimId) {
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
 * Átkonfigurálja a panelt többérték/egyérték között.
 * 
 * @param {Boolean} isLegendRequired Kell-e jelkulcs?
 * @param {Number} leftOffset Bal oldali extra margó mérete.
 * @param {Number} rightOffset Jobb oldali extra margó mérete.
 * @param {Number} topOffset Felső extra margó mérete.
 * @param {Number} bottomOffset Alsó extra margó mérete.
 * @returns {undefined}
 */
panel_barline.prototype.changeConfiguration = function(isLegendRequired, leftOffset, rightOffset, topOffset, bottomOffset) {
    if (this.isLegendRequired !== isLegendRequired) {
        this.isLegendRequired = isLegendRequired;

        this.margin = {
            top: global.panelTitleHeight + 3 * global.legendOffsetY + topOffset,
            right: this.legendOffsetX + rightOffset,
            bottom: bottomOffset + ((isLegendRequired) ? global.legendHeight + 2 * global.legendOffsetY : global.legendOffsetY + global.legendHeight / 2),
            left: this.legendOffsetX + leftOffset
        };

        this.width = this.w - this.margin.left - this.margin.right;
        this.height = this.h - this.margin.top - this.margin.bottom;

        this.yScale.range([this.height, 0]);
        this.yScaleStreched.range([this.height, 0]);

        this.gAxisX.select("line").attr({
            x1: 0,
            y1: this.height,
            x2: this.width,
            y2: this.height});
        this.gAxisX.selectAll("text").remove();
        this.gAxisXShadow.selectAll("text")
                .on("click", null)
                .remove();

        // Dobómezők igazítása.
        this.svg.select(".background.minus rect")
                .attr("y", (this.isStretched) ? this.margin.top : this.margin.top + this.height / 2)
                .attr("height", (this.isStretched) ? this.height : this.height / 2);
        this.svg.select(".background.plus rect")
                .attr("height", (this.isStretched) ? 0 : this.height / 2);
    }
};

/**
 * Nyelvváltást végrehajtó függvény.
 * 
 * @returns {undefined}
 */
panel_barline.prototype.langSwitch = function() {
    // "Átlag" felirat átírása.
    this.avgText = _("Átlag");

    // Jelkulcs letörlése, és újrarajzolása.
    if (this.isLegendRequired) {
        this.gLegend.selectAll(".legend").remove();
        this.drawLegend();
    }
};