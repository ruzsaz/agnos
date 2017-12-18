/* global Panel, d3 */

'use strict';

var horizontalbarpanel = panel_horizontalbar;
/**
 * Vízszintes oszlopdiagram konstruktora.
 * 
 * @param {Object} init Inicializáló objektum.
 * @returns {panel_horizontalbar}
 */
function panel_horizontalbar(init) {
    var that = this;

    this.constructorName = "panel_horizontalbar";

    this.defaultInit = {group: 0, position: undefined, dim: 0, valpos: [0], valneg: [], ratio: false, centered: false, domain: [], domainr: []};
    this.actualInit = global.combineObjects(that.defaultInit, init);

    this.valPosToShow = that.actualInit.valpos;			// Ezeket kell pozitív irányban ábrázolni.
    this.valNegToShow = that.actualInit.valneg;			// Ezeket kell negatív irányban ábrázolni.
    this.buildValueVectors();

    Panel.call(that, that.actualInit, global.mediators[that.actualInit.group], !that.singleValMode, global.legendOffsetX, global.legendOffsetX, 0, global.fontSizeSmall + 2); // A Panel konstruktorának meghívása.

    this.dimToShow = that.actualInit.dim;				// Ennyiedik dimenzió a panel dimenziója.
    this.valMultipliers = [];							// Ennyiszeresét kell mutatni az értékeknek.
    this.valFraction = that.actualInit.ratio;			// Hányadost mutasson?
    this.isAlwaysCentered = that.actualInit.centered;	// Mindig középen legyen az y tengely?
    this.preparedData;									// A megjelenítendő feldolgozott adat.
    this.maxEntries = global.maxEntriesIn1D;            // A panel által maximálisan megjeleníthető adatok száma.    
    this.shadowTimeout;									// A háttértéglalapokat létrehozó időzítés.

    // Az x tengely szövegszínének meghatározása.	
    this.xAxisColor = global.readableColor(global.colorValue(that.valBarsToShow[0]));

    // Vízszintes skála.
    this.xScale = d3.scaleLinear()
            .range([0, that.width])
            .nice(7);

    // Függőleges skála.
    this.yScale = d3.scaleLinear()
            .range([0, that.height]);

    // A vízszintes tengely.
    this.xAxis = d3.axisBottom(that.xScale)
            .ticks(7)
            .tickFormat(global.cleverRound3);

    // Baloldali dobómező.
    that.svg.insert("svg:g", ".title_group")
            .attr("class", "minus background listener droptarget droptarget1")
            .on('mouseover', function() {
                that.hoverOn(this, "minus");
            })
            .on('mouseout', function() {
                that.hoverOff();
            })
            .append("svg:rect")
            .attr("width", that.w / 2)
            .attr("height", that.h);

    // Jobboldali dobómező.
    that.svg.insert("svg:g", ".title_group")
            .attr("class", "plus background listener droptarget droptarget1")
            .on('mouseover', function() {
                that.hoverOn(this, "plus");
            })
            .on('mouseout', function() {
                that.hoverOff();
            })
            .append("svg:rect")
            .attr("x", that.w / 2)
            .attr("width", that.w / 2)
            .attr("height", that.h);

    // Az alapréteg.
    that.svg.insert("svg:g", ".title_group")
            .attr("class", "background listener droptarget droptarget0")
            .on("click", function() {
                that.drill();
            })
            .on('mouseover', function() {
                that.hoverOn(this);
            })
            .on('mouseout', function() {
                that.hoverOff();
            })
            .append("svg:rect")
            .attr("width", that.w)
            .attr("height", that.h);

    // Függőleges tengely szövegárnyék-rétege.
    this.gAxisYShadow = that.svg.insert("svg:g", ".title_group")
            .attr("class", "axisX axis")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")");

    // Oszlopdiagram rétege.
    this.gBars = that.svg.insert("svg:g", ".title_group")
            .attr("class", "bar_group")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")");

    // Vízszintes tengely rétege.
    this.gAxisX = that.svg.insert("svg:g", ".title_group")
            .attr("class", "axisY axis noEvents")
            .attr("transform", "translate(" + that.margin.left + ", " + (that.margin.top + that.height) + ")");

    // Függőleges tengely rétege.
    this.gAxisY = that.svg.insert("svg:g", ".title_group")
            .attr("class", "axisX axis noEvents")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")");

    // Függőleges tengelyvonal kirajzolása.
    that.gAxisY.append("svg:line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", that.height);

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
    panel_horizontalbar.prototype = global.subclassOf(Panel); // A Panel metódusainak átvétele.
    panel_horizontalbar.prototype.barPadding = 0.1;			// Az oszlopok közötti rés az oszlopok szélességében.
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
panel_horizontalbar.prototype.barValuesToShow = function(d) {
    var pos = this.valuesToShow(d, true);
    var neg = this.valuesToShow(d, false);
    for (var i = 0; i < neg.length; i++) {
        neg[i].accumulation = -neg[i].accumulation - neg[i].value;
    }
    return neg.concat(pos);
};

/**
 * Egy adatsorból meghatározza a megmutatandó oszlopdiagramokhoz
 * tartozó pozitív vagy negatív értékeket, és az alatta levők összegét, tömbként.
 * 
 * @param {Object} d Nyers adatsor.
 * @param {Boolean} pos True: a pozitívokat, false: a negatívokat hatáozza meg.
 * @returns {Array} Az értékek tömbje, mindenképpen pozitív előjelekkel.
 */
panel_horizontalbar.prototype.valuesToShow = function(d, pos) {
    var valToShow = (pos) ? this.valPosToShow : this.valNegToShow;
    var vals = [];
    if (d !== undefined && d.vals !== undefined) {
        var accumulation = 0;
        for (var i = 0; i < valToShow.length; i++) {
            var mult = (pos) ? this.valMultipliers[this.valNegNumber + i] : this.valMultipliers[i];
            var val = (this.valFraction) ? mult * d.vals[valToShow[i]].sz / d.vals[valToShow[i]].n : d.vals[valToShow[i]].sz;
            if (isNaN(parseInt(val))) {
                val = 0;
            }
            vals[i] = {value: val, accumulation: accumulation};
            accumulation += val;
        }
    }
    return vals;
};

/**
 * Egy elemhez tartozó tooltipet legyártó függvény;
 * 
 * @param {Object} d Az elem.
 * @returns {String} A megjelenítendő tooltip.
 */
panel_horizontalbar.prototype.getTooltip = function(d) {
    var that = this;
    var vals = [];

    for (var i = 0; i < that.legendArray.length; i++) {
        var lVal = that.legendArray[i];
        var id = lVal.id;
        var value = undefined;
        if (lVal.isNegRequired) {
            value = d.values[global.positionInArray(that.valBarsToShow, id)].value;
        } else {
            value = d.values[global.positionInArray(that.valBarsToShow, id)].value;
        }

        var unitProperty = (value === 1) ? "unit" : "unitPlural";
        vals.push({
            name: that.localMeta.indicators[id].description,
            value: value,
            dimension: (that.valFraction) ? that.localMeta.indicators[id].fraction[unitProperty] : that.localMeta.indicators[id].value[unitProperty]
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
 * Beállítja az épp aktuális vízszintes skálát. Ha az inicializáló objetum
 * fix skálát kért, akkor azt, ha nem, akkor az épp aktuális adatok alapján
 * automatikusan.
 * 
 * @param {Array} scale 2 elemű tömb a minimális és maximális értékkel.
 * @returns {undefined}
 */
panel_horizontalbar.prototype.setXScale = function(scale) {
    var actualScaleDomain = (this.valFraction) ? this.actualInit.domainr : this.actualInit.domain;
    if ((actualScaleDomain instanceof Array) && actualScaleDomain.length === 2) {
        this.xScale.domain(actualScaleDomain);
    } else {
        this.xScale.domain(scale);
    }
    this.xScale.nice(10);
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
panel_horizontalbar.prototype.preUpdate = function(drill) {
    var that = this;
    var oldPreparedData = that.preparedData;

    // Lefúrás esetén: mindent, kivéve amibe fúrunk, letörlünk.
    if (drill.direction === -1) {

        // Tengelyfeliratok: nem kellőek törlése.
        that.gAxisY.selectAll("text")
                .filter(function(d) {
                    return (d.id !== drill.toId);
                })
                .remove();
        that.gAxisYShadow.selectAll("rect")
                .on("click", null)
                .remove();

        // Oszlopok: nem kellőek letörlése.
        that.gBars.selectAll(".bar")
                .filter(function(d) {
                    return (d.id !== drill.toId);
                })
                .on("click", null)
                .remove();

        // Felfúrás esetén.
    } else if (drill.direction === 1 && oldPreparedData) {

        // Tengelyfeliratok: minden törlése.
        that.gAxisY.selectAll("text")
                .filter(function(d) {
                    return (d.id !== drill.fromId);
                })
                .remove();
        that.gAxisYShadow.selectAll("rect")
                .on("click", null)
                .remove();

        // Az oszlopok átlagértékének meghatározása.
        var avgValues = [];
        for (var j = 0, jMax = that.valBarNumber; j < jMax; j++) {
            var avgWidth = d3.mean(oldPreparedData.dataArray, function(d) {
                return d.values[j].width;
            });
            var avgX = d3.mean(oldPreparedData.dataArray, function(d) {
                return d.values[j].x;
            });
            avgValues.push({width: avgWidth, x: avgX});
        }

        // Minden oszlopelem eltörlése.
        that.gBars.selectAll(".bar")
                .on("click", null)
                .remove();

        // Átlaghoz tartozó oszlopelem kirajzolása.
        var level = (global.baseLevels[that.panelSide])[this.dimToShow].length;
        that.gBars.selectAll(".bar").data([{id: drill.fromId, uniqueId: level + "L" + drill.fromId}])
                .enter().append("svg:g")
                .attr("class", "bar bordered darkenable")
                .attr("transform", "translate(0," + (that.yScale.range()[1] * (that.barPadding / 2)) + ")")
                .attr("opacity", 1)
                .selectAll("rect").data(avgValues)
                .enter().append("svg:rect")
                .attr("class", function(d2, i2) {
                    return "controlled controlled" + that.valBarsToShow[i2];
                })
                .attr("y", 0)
                .attr("height", that.yScale.range()[1] * (1 - that.barPadding))
                .attr("x", function(d2) {
                    return d2.x;
                })
                .attr("width", function(d2) {
                    return d2.width;
                })
                .attr("fill", function(d2, i2) {
                    return global.colorValue(that.valBarsToShow[i2]);
                });
    }
};

/**
 * Az új adat előkészítése. Meghatározza hogy mit, honnan kinyílva kell kirajzolni.
 * 
 * @param {Object} oldPreparedData Az előzőleg kijelzett adatok.
 * @param {Array} newDataRows Az új adatsorokat tartalmazó tömb.
 * @param {Object} drill Az épp végrehajtandó fúrás.
 * @returns {Object} Az új megjelenítendő adatok.
 */
panel_horizontalbar.prototype.prepareData = function(oldPreparedData, newDataRows, drill) {
    var that = this;
    var level = (global.baseLevels[that.panelSide])[this.dimToShow].length;

    var dataArray = [];			// A fő adattörzs, ez fogja a téglalapok megjelenítését tartalmazni.
    newDataRows.sort(that.cmp); // Adatok névsorba rendezése.

    // Vízszintes skála beállítása.
    that.yScale.domain([0, newDataRows.length]);

    // Lefúrás esetén: ebből a régi elemből kell kinyitni mindent.
    var openFromElement = (drill.direction === -1 && oldPreparedData) ? global.getFromArrayByProperty(oldPreparedData.dataArray, 'id', drill.toId) : null;

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

    // Első végigfutás: alapértékek beállítása, és a maximumok meghatározása.
    var maxBarValue = 0;
    var minBarValue = 0;
    for (var i = 0, iMax = newDataRows.length; i < iMax; i++) {
        var dataRow = newDataRows[i];
        var element = {};
        element.index = i;
        element.id = dataRow.dims[0].id;
        element.uniqueId = level + "L" + element.id;
        element.name = dataRow.dims[0].name.trim();
        element.values = that.barValuesToShow(dataRow);
        var sumPosValues = (that.valPosNumber > 0) ? element.values[element.values.length - 1].value + element.values[element.values.length - 1].accumulation : 0;
        var sumNegValues = (that.valNegNumber > 0) ? element.values[that.valNegNumber - 1].accumulation : 0;
        maxBarValue = Math.max(maxBarValue, sumPosValues);
        minBarValue = Math.min(minBarValue, sumNegValues);
        element.tooltip = that.getTooltip(element);
        dataArray.push(element);
    }

    // Ha centrálni kell, akkor a minimumokat és maximumokat ennek megfelelően meghamisítjuk.
    if (that.isAlwaysCentered) {
        maxBarValue = Math.max(-minBarValue, maxBarValue);
        minBarValue = -maxBarValue;
    }

    // Második végigfutás: a kirajzoláshoz szükséges értékek meghatározása.
    var onlyOneBarY = that.yScale.range()[1];	// Ha csak 1 diagramelem van, az ilyen magas a paddinggal együtt.
    var onlyOneBarHeight = onlyOneBarY * (1 - that.barPadding); // Ha csak 1 diagramelem van, az ilyen magas.

    var oldDataExtent = that.xScale.domain()[1] - that.xScale.domain()[0]; // Az X skála régi szélessége.
    that.setXScale([minBarValue, maxBarValue]); // Az új X skála beállítása.
    var xMagRatio = (that.xScale.domain()[1] - that.xScale.domain()[0]) / oldDataExtent; // A régi és az új X skála közötti arány.
    var elementHeight = that.yScale(1 - that.barPadding); // Az új elemek végső magassága.
    var oldY = (openFromElement) ? openFromElement.y : 0; // Az új elemek kinyitásának kezdőpozíciója.

    for (var i = 0, iMax = dataArray.length; i < iMax; i++) {
        element = dataArray[i];

        // Az új megjelenési koordináták beállítása.
        element.y = that.yScale(i + that.barPadding / 2);
        element.height = elementHeight;
        for (var j = 0, jMax = that.valBarNumber; j < jMax; j++) {
            var d = element.values[j];
            d.width = that.xScale(d.value) - that.xScale(0);
            d.x = that.xScale(d.accumulation);
            d.tooltip = element.tooltip;
        }

        // A régi koordináták beállítása: innen fog kinyílni az animáció.
        if (drill.direction === -1 && openFromElement) { // Ha bezoomolás van
            element.oldY = oldY;
            element.oldHeight = (openFromElement.height / iMax);
            oldY = oldY + element.oldHeight;
            for (var j = 0, jMax = that.valBarNumber; j < jMax; j++) {
                element.values[j].oldWidth = openFromElement.values[j].width;
                element.values[j].oldX = openFromElement.values[j].x;
            }
        } else if (drill.direction === 1) { // Ha kizoomolás van
            element.oldY = (i - openToElementIndex + that.barPadding / 2) * onlyOneBarY;
            element.oldHeight = onlyOneBarHeight;
            for (var j = 0, jMax = that.valBarNumber; j < jMax; j++) {
                element.values[j].oldWidth = global.orZero(xMagRatio * element.values[j].width);
                element.values[j].oldX = global.orZero(xMagRatio * (element.values[j].x - that.xScale(0)) + that.xScale(0));
            }
        } else { // Szinten maradás esetén
            element.oldY = element.y;
            element.oldHeight = element.height;
            for (var j = 0, jMax = that.valBarNumber; j < jMax; j++) {
                element.values[j].oldWidth = 0;
                element.values[j].oldX = that.xScale(0);
            }
        }
    }

    return {dataArray: dataArray};
};

/**
 * Új adat megérkeztekor levezényli a panel frissítését.
 * 
 * @param {Object} data Az új adat.
 * @param {Object} drill Az épp végrehajzásra kerülő fúrás.
 * @returns {undefined}
 */
panel_horizontalbar.prototype.update = function(data, drill) {
    var that = this;
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
        that.preparedData = undefined;
    } else {

        // Ha meg van tiltva mind az egyenes adat, mint a hányados megjelenítése, akkor pánik!
        if (forbidRatio && forbidNominator) {
            that.panic(true, _("<html>Az ellentétes megjelenítési utasítások miatt<br />az adatok nem megjeleníthetőek.</html>"));
            that.preparedData = undefined;

            // Különben normál működés.
        } else {
            that.panic(false);

            // A szorzó-tömb felfrissítése.
            that.valMultipliers = [];
            for (var i = 0, iMax = that.valBarNumber; i < iMax; i++) {
                var mult = parseFloat(that.meta.indicators[that.valBarsToShow[i]].fraction.multiplier);
                that.valMultipliers.push((isNaN(mult)) ? 1 : mult);
            }

            // Adatok feldolgozása, a magejelenési adatok elkészítése.
            that.preparedData = that.prepareData(that.preparedData, that.data.rows, drill);

            // Tengelyek, oszlopelemek, vonalelemek, átlagelemek felfrissítése.
            var tweenDuration = global.getAnimDuration(-1, that.panelId);
            var trans = d3.transition().duration(tweenDuration);
            that.drawAxes(that.preparedData, trans);
            that.drawBars(that.preparedData, trans);
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
panel_horizontalbar.prototype.drawBars = function(preparedData, trans) {
    var that = this;

    // Egy téglalap konténere, és az adat.
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
                return d.values;
            });

    // Az új oszlopok tartójának elkészítése.
    var gBarNew = gBar.enter().append("svg:g")
            .attr("class", "bar bordered")
            .attr("transform", function(d) {
                return "translate(0," + d.oldY + ")";
            })
            .attr("opacity", function(d) {
                return (global.valueInRange(d.oldY + d.oldHeight / 2, 0, that.h)) ? 1 : 0;
            });

    // Elemi oszlopelemek megrajzolása.
    var oldHeight = preparedData.dataArray[0].oldHeight;
    gBarNew.selectAll("rect")
            .data(function(d) {
                return d.values;
            })
            .enter().append("svg:rect")
            .attr("y", 0)
            .attr("height", oldHeight)
            .attr("x", function(d2) {
                return d2.oldX;
            })
            .attr("width", function(d2) {
                return d2.oldWidth;
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
                return "translate(0," + d.y + ")";
            })
            .attr("opacity", 1)
            .on("end", function() {
                d3.select(this).classed("darkenable", true);
            })
            .selectAll("rect")
            .attr("class", function(d, i) {
                return "controlled controlled" + that.valBarsToShow[i];
            })
            .attr("x", function(d) {
                return d.x;
            })
            .attr("width", function(d) {
                return d.width;
            })
            .attr("height", that.yScale(1 - that.barPadding))
            .attr("fill", function(d, i) {
                return global.colorValue(that.valBarsToShow[i]);
            });

};

/**
 * Jelkulcs felrajzolása.
 * 
 * @returns {undefined}
 */
panel_horizontalbar.prototype.drawLegend = function() {
    var that = this;

    // Csak ha üres még a jelkulcs, ez ugyanis nem változhat.
    if (that.gLegend.selectAll(".legend").empty()) {

        var l_width = that.legendWidth / that.legendArray.length;	// A kirajzolandó jelkulcstéglalapok szélessége.
        var l_height = global.legendHeight;							// A kirajzolandó jelkulcstéglalapok magassága.global.legendHeight;

        // Oszlop- vagy vonaldiagramhoz tartozó jelkulcs tartójának kirajzolása. Fontos: a ".bar_group" elé kell tenni, hogy irányíthassa azt.
        var gLegend = that.gLegend.selectAll("g.barLegend").data(that.legendArray)
                .enter().insert("svg:g", ".bar_group")
                .attrs({
                    class: function(d) {
                        return "listener droptarget droptarget1 legend legendControl" + d.id;
                    }})
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
                });

        // A jelkulcs elemi téglalpja.
        gLegend.append("svg:rect")
                .attr("class", "bordered")
                .attr("rx", global.rectRounding)
                .attr("ry", global.rectRounding)
                .attr("x", function(d, i) {
                    return (i * l_width + global.legendOffsetX * 1.5);
                })
                .attr("y", that.h - l_height - global.legendOffsetY)
                .attr("width", l_width - global.legendOffsetX)
                .attr("height", l_height)
                .attr("fill", function(d) {
                    return global.colorValue(d.id);
                });

        // A jelkulcs-szöveg kiírása.
        var legendText = gLegend.append("svg:text")
                .attr("class", "legend noEvents")
                .attr("text-anchor", "middle")
                .attr("x", function(d, i) {
                    return (i * l_width + l_width / 2 + global.legendOffsetX);
                })
                .attr("y", that.h - l_height / 2 - global.legendOffsetY)
                .attr("dy", ".35em")
                .attr("fill", function(d) {
                    return global.readableColor(global.colorValue(d.id));
                })
                .text(function(d, i) {
                    return that.localMeta.indicators[that.legendArray[i].id].caption;
                });

        // Jelkulcs-szövegek formázása, hogy beférjenek.
        global.cleverCompress(legendText, l_width - 1.8 * global.legendOffsetX, 1, undefined);
    }
};

/**
 * A tengelyek, és a pozitív, negatív értékelkapómező kirajzolása.
 * 
 * @param {Object} preparedData A panel által megjelenítendő, feldolgozott adatok.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_horizontalbar.prototype.drawAxes = function(preparedData, trans) {
    var that = this;

    var shadowSize = global.axisTextSize(that.yScale(1));	// A függőleges tengely betűje mögötti klikk-téglalap mérete.
    var axisTextSize = (shadowSize < 6) ? 0 : shadowSize;	// A függőleges tengely betűmérete.

    // Vízszintes tengely kirajzolása, animálása.
    if (that.gAxisX.selectAll("path").nodes().length > 0) {
        that.gAxisX.transition(trans).call(that.xAxis);
    } else {
        that.gAxisX.call(that.xAxis);
    }

    var isRightBound = (that.xScale(0) < that.width / 1.8);		// A tengelyfeliratok jobbra nyúlnak a tengelytől?
    var textAlign = (isRightBound) ? "beginning" : "end";
    var dx = (isRightBound) ? 0.2 * axisTextSize : -0.2 * axisTextSize;

    // Függőleges tengely helyreanimálása.
    that.gAxisY.selectAll("line")
            .transition(trans)
            .attr("y2", that.height);

    that.gAxisY.transition(trans)
            .attr("transform", "translate(" + (that.margin.left + that.xScale(0)) + "," + that.margin.top + ")");

    that.svg.select(".minus rect")
            .attr("x", 0)
            .attr("y", that.margin.top)
            .attr("width", that.xScale(0) + that.margin.left)
            .attr("height", that.height);

    that.svg.select(".plus rect")
            .attr("x", that.margin.left + that.xScale(0))
            .attr("y", that.margin.top)
            .attr("width", that.w - that.xScale(0) - that.margin.left)
            .attr("height", that.height);

    // Feliratok a függőleges tengelyre, és a hozzá tartozó adat.
    var axisLabelY = that.gAxisY.selectAll("text")
            .data(preparedData.dataArray, function(d) {
                return d.id + d.name;
            });

    // Kilépő feliratok letörlése.
    axisLabelY.exit()
            .transition(trans).attr("opacity", 0)
            .remove();

    // Belépő feliratok elhelyezése.
    var axisLabelYNew = axisLabelY.enter()
            .append("svg:text")
            .attr("class", "shadowedLabel")
            .attr("font-size", axisTextSize)
            .attr("opacity", function(d) {
                return (global.valueInRange(d.oldY + d.oldHeight / 2, 0, that.h)) ? 0 : global.axisTextOpacity;
            })
            .attr("y", function(d) {
                return d.oldY + d.oldHeight / 2 + 0.35 * axisTextSize;
            });

    axisLabelY = axisLabelYNew.merge(axisLabelY);

    // Megmaradó feliratok beállítása.
    axisLabelY
            .attr("dx", dx)
            .attr("text-anchor", textAlign)
            .text(function(d) {
                return d.name;
            });

    // Maradó feliratok helyre animálása.
    axisLabelY
            .transition(trans)
            .attr("font-size", axisTextSize)
            .attr("y", function(d) {
                return d.y + d.height / 2 + 0.35 * axisTextSize;
            })
            .attr("opacity", global.axisTextOpacity);

    // Feliratok összenyomása, hogy tuti elférjenek.
    global.cleverCompress(axisLabelYNew, that.w, 0.85 * Math.max(that.width - that.xScale(0), that.xScale(0)) / that.width, undefined);

    // Háttértéglalapok, és azt azt létrehozó időzítés törlése.
    clearTimeout(that.shadowTimeout);
    that.gAxisYShadow.selectAll("rect")
            .on("click", null)
            .remove();

    // Háttértéglalapok, eseménykezelő létrehozása, de csak az animáció lefutása után.
    that.shadowTimeout = setTimeout(function() {
        that.gAxisYShadow.selectAll("rect")
                .data(preparedData.dataArray, function(d) {
                    return d.id + d.name;
                })
                .enter().append("svg:rect")
                .classed("listener", true)
                .attr("height", shadowSize * 1.05)
                .attr("width", function(d) {
                    return Math.max(30, Math.min(0.5 * shadowSize + that.gAxisY.selectAll("text").filter(function(d2) {
                        return d === d2;
                    }).nodes()[0].getComputedTextLength(), Math.max(that.width - that.xScale(0), that.xScale(0))));
                })
                .attr("y", function(d) {
                    return d.y + (d.height - shadowSize) / 2;
                })
                .attr("x", function() {
                    return (isRightBound) ? that.xScale(0) : that.xScale(0) - parseInt(d3.select(this).attr("width"));
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
panel_horizontalbar.prototype.buildValueVectors = function() {
    var that = this;

    // Kiveszi a duplikátumokat a pozitív és negatív tömbből.
    that.valPosToShow = that.valPosToShow.filter(function(item, pos) {
        return that.valPosToShow.indexOf(item) === pos;
    });
    that.valNegToShow = that.valNegToShow.filter(function(item, pos) {
        return that.valNegToShow.indexOf(item) === pos;
    });

    // Kiveszi a negatív tömbből a pozitívban is szereplőket.
    that.valNegToShow = that.valNegToShow.filter(function(item) {
        return that.valPosToShow.indexOf(item) === -1;
    });

    // Globális segédváltozók beállítása.
    that.valBarsToShow = that.valNegToShow.concat(that.valPosToShow); // neg+pos
    that.valPosNumber = that.valPosToShow.length;		// Ennyi pozitív oszlopelem kell.
    that.valNegNumber = that.valNegToShow.length;		// Ennyi negatív oszlopelem kell.
    that.valBarNumber = that.valPosNumber + that.valNegNumber;
    that.legendArray = that.createLegendArray();		// A jelkulcshoz kellő értékek.
    that.singleValMode = (that.legendArray.length === 1);
};

/**
 * Létrehozza az épp aktuális megjelnítendő oszlop-vonal-átlagelemekhez tartozó
 * megjelenítendő jelkulcs-tömböt. (Nem csak a jelkulcsnál használjuk.)
 * 
 * @returns {Array} A megjelenítendő értékek tömbje.
 */
panel_horizontalbar.prototype.createLegendArray = function() {
    var that = this;

    var maxValToShow = d3.max([d3.max(that.valPosToShow), d3.max(that.valNegToShow)]); // A maximális ábrázolandó érték száma.
    var combinedToShow = [];	// Olyan tömb, ami az i. pozícióban az i. érték megjelenítésének adatait tartalmazza.

    // Az id-k feltöltése.
    for (var i = 0, iMax = maxValToShow + 1; i < iMax; i++) {
        combinedToShow.push({id: i});
    }

    // A pozitív irányba megjelenítendő értékek beleírása.
    for (var i = 0, iMax = that.valPosNumber; i < iMax; i++) {
        combinedToShow[that.valPosToShow[i]].isPosRequired = true;
    }

    // A negatív irányba megjelenítendő átlagvonalak beleírása.
    for (var i = 0, iMax = that.valNegNumber; i < iMax; i++) {
        combinedToShow[that.valNegToShow[i]].isNegRequired = true;
    }

    // A legend-ben megjelenítendő értékek: az előző tömbből kihagyjuk az üreseket.
    var legendArray = [];
    for (var i = 0, iMax = maxValToShow + 1; i < iMax; i++) {
        if (combinedToShow[i].isPosRequired || combinedToShow[i].isNegRequired) {
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
panel_horizontalbar.prototype.drill = function(d) {
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
 * A mutató- és hányadosválasztást végrehajtó függvény.
 * 
 * @param {String} panelId A váltást végrehajtó panel azonosítója. Akkor vált, ha az övé, vagy ha undefined.
 * @param {Integer} value Az érték, amire váltani kell. Ha -1 akkor a következőre vált, ha undefined, nem vált.
 * @param {Boolean | Number} ratio Hányadost mutasson-e. Ha -1 akkor a másikra ugrik, ha undefined, nem vált.
 * @param {Number | String} targetId A felcserélendő mutató id-je, vagy "plus"/"minus", ha új értéket kell hozzáadni.
 * @returns {undefined}
 */
panel_horizontalbar.prototype.doChangeValue = function(panelId, value, ratio, targetId) {
    var that = this;
    if (panelId === undefined || panelId === that.panelId) {
        var oldNumOfValues = that.legendArray.length;

        // Hányados váltás, vagy értéktáblára kattintás esetén.
        if (ratio !== undefined) {
            that.valFraction = (ratio === -1) ? !that.valFraction : ratio;
            if (value !== undefined && that.singleValMode) {
                if (that.valPosNumber === 1) {
                    that.valPosToShow[0] = value;
                }
                if (that.valNegNumber === 1) {
                    that.valNegToShow[0] = value;
                }
                that.buildValueVectors();
            }
        }

        // Különben.
        else {

            // A fejlécre klikkelés esetén.
            if (value === -1 && that.singleValMode) {
                var newVal = (that.legendArray[0].id + 1) % that.meta.indicators.length;
                if (that.valPosNumber === 1) {
                    that.valPosToShow[0] = newVal;
                }
                if (that.valNegNumber === 1) {
                    that.valNegToShow[0] = newVal;
                }
            }

            // Új érték hozzáadása esetén.
            if (value > -1 && (targetId === "plus" || targetId === "minus")) {
                if (targetId === "plus") {
                    that.valPosToShow.push(value);
                } else {
                    that.valNegToShow.push(value);
                    var index = that.valPosToShow.indexOf(value);
                    if (index !== -1) {
                        that.valPosToShow.splice(index, 1);
                    }
                }
            }

            // Érték fejlécre ejtése esetén.
            if (targetId === undefined) {
                that.valPosToShow[0] = value;
                that.valPosToShow.length = 1;
                that.valNegToShow.length = 0;
            }

            // Értékcsere esetén.
            if (!isNaN(value) && !isNaN(targetId)) {
                var oldPos = global.positionInArray(that.valPosToShow, targetId);
                if (oldPos !== -1) {
                    that.valPosToShow[oldPos] = value;
                }

                var oldPos = global.positionInArray(that.valNegToShow, targetId);
                if (oldPos !== -1) {
                    that.valNegToShow[oldPos] = value;
                }
                that.gLegend.selectAll(".legend").remove();
            }

            that.buildValueVectors(); // Segéd értékmutató mennyiségek feltöltése.
            that.changeConfiguration(!that.singleValMode, global.legendOffsetX, global.legendOffsetX, 0, global.fontSizeSmall + 2); // Konfiguráció beállítása.

            // Ha megváltozott a kijelzett értékek száma, törlünk, hogy újrarajzolódjanak.
            if (oldNumOfValues !== that.legendArray.length) {
                that.gBars.selectAll(".bar").remove();
                that.gLegend.selectAll(".legend").remove();
            }

            that.svg.selectAll(".hoveredDropTarget").remove(); // A dobóterület-kijelzés letörlése.
        }
        that.actualInit.valpos = that.valPosToShow;
        that.actualInit.valneg = that.valNegToShow;
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
panel_horizontalbar.prototype.doChangeDimension = function(panelId, newDimId) {
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
panel_horizontalbar.prototype.changeConfiguration = function(isLegendRequired, leftOffset, rightOffset, topOffset, bottomOffset) {
    if (this.isLegendRequired !== isLegendRequired) {
        this.isLegendRequired = isLegendRequired;

        this.margin = {
            top: global.panelTitleHeight + 3 * global.legendOffsetY + topOffset,
            right: global.legendOffsetX + rightOffset,
            bottom: bottomOffset + ((isLegendRequired) ? global.legendHeight + 2 * global.legendOffsetY : global.legendOffsetY + global.legendHeight / 2),
            left: global.legendOffsetX + leftOffset
        };

        this.width = this.w - this.margin.left - this.margin.right;
        this.height = this.h - this.margin.top - this.margin.bottom;

        this.yScale.range([0, this.height]);

        this.gAxisX.attr('transform', "translate(" + this.margin.left + ", " + (this.margin.top + this.height) + ")");
    }
};

/**
 * Nyelvváltást végrehajtó függvény.
 * 
 * @returns {undefined}
 */
panel_horizontalbar.prototype.langSwitch = function() {
    // Jelkulcs letörlése, és újrarajzolása.
    if (this.isLegendRequired) {
        this.gLegend.selectAll(".legend").remove();
        this.drawLegend();
    }
};