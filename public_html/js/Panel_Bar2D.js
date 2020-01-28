/* global Panel, d3, global */

'use strict';

var bar2panel = panel_bar2d;
/**
 * A 2 dimenzió mentén ábrázoló oszlopdiagram konstruktora.
 * 
 * @param {Object} init Inicializáló objektum.
 * @returns {panel_bar2d}
 */
function panel_bar2d(init) {
    var that = this;

    this.constructorName = "panel_bar2d";

    // Inicializáló objektum beolvasása, feltöltése default értékekkel.
    this.defaultInit = {group: 0, position: undefined, dimx: 0, dimy: 1, val: 0, multiplier: 1, ratio: false, streched: false, domain: [], domainr: [], mag: 1, fromMag: 1};
    this.actualInit = global.combineObjects(that.defaultInit, init);

    Panel.call(that, that.actualInit, global.mediators[that.actualInit.group], true, global.numberOffset, 0); // A Panel konstruktorának meghívása.

    this.valToShow = that.actualInit.val;					// Az ennyiedik mutatót mutatja.
    this.valFraction = that.actualInit.ratio;				// Hányadost mutasson, vagy abszolútértéket?
    this.isStretched = that.actualInit.streched;			// 100%-ra széthúzott diagram kell-e?
    this.dimXToShow = that.actualInit.dimx;					// Az X tengely mentén mutatott dimenzió.
    this.dimYToShow = that.actualInit.dimy;					// Az Y tengely mentén mutatott dimenzió.
    this.valMultiplier = that.actualInit.multiplier;		// Ennyiszeresét kell mutatni az értékeknek.
    this.dimX = (that.dimXToShow <= that.dimYToShow) ? 0 : 1;// Az x tengelyen megjelenítendő dimenzió sorszáma (a data-n belül).
    this.dimY = (that.dimXToShow < that.dimYToShow) ? 1 : 0;// Az oszloposztásban megjelenítendő dimenzió sorszáma (a data-n belül).

    this.preparedData;										// A feldolgozott adat.
    this.maxEntries = global.maxEntriesIn2D;                // A panel által maximálisan megjeleníthető adatok száma.
    this.maxEntries1D = global.maxEntriesIn1D;              // A panel által 1 dimenzióban maximálisan megjeleníthető adatok száma.
    this.shadowTimeout;										// A háttértéglalapokat létrehozó időzítés.

    // Vízszintes skála.
    this.xScale = d3.scaleLinear()
            .range([0, that.width]);

    // Függőleges skála.
    this.yScale = d3.scaleLinear()
            .range([that.height, 0])
            .nice(10);

    // A vízszintes tengely.
    d3.axisBottom(that.xScale);

    // A függőleges tengelyt generáló függvény.
    this.yAxis = d3.axisLeft(that.yScale)
            .ticks(10)
            .tickFormat(global.cleverRound3);

    // Széthúzott módban a függőleges tengely %-okat kell hogy mutasson.
    if (that.isStretched) {
        that.yAxis.scale(d3.scaleLinear()
                .range([that.height, 0])
                .domain([0, 1]))
                .tickFormat(d3.format(".0%"));
    }

    // A fő alapréteg, ami mentén az X dimenzóban való furkálás történik.
    that.svg.insert("svg:g", ".title_group")
            .attr("class", "background listener droptarget droptarget0")
            .on('click', function () {
                that.drill(that.dimX);
            })
            .on('mouseover', function () {
                that.hoverOn(this, 0);
            })
            .on('mouseout', function () {
                that.hoverOff();
            })
            .append("svg:rect")
            .attr("width", that.w)
            .attr("height", that.height + that.margin.top);

    // Az alsó alapréteg, ami mentén az Y dimenzóban való furkálás történik.
    that.svg.insert("svg:g", ".title_group")
            .attr("class", "background listener droptarget droptarget0")
            .on('click', function () {
                that.drill(that.dimY);
            })
            .on('mouseover', function () {
                that.hoverOn(this, 1);
            })
            .on('mouseout', function () {
                that.hoverOff();
            })
            .append("svg:rect")
            .attr("width", that.w)
            .attr("height", that.h - that.height - that.margin.top)
            .attr("transform", "translate(0, " + (that.height + that.margin.top) + ")");

    // Vízszintes tengely szövegárnyék-rétege.
    this.gAxisXShadow = that.svg.insert("svg:g", ".title_group")
            .attr("class", "axisX axis")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")");

    // Oszlopdiagram rétege.
    this.gBars = that.svg.insert("svg:g", ".title_group")
            .attr("class", "bar_group")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")");

    // Vízszintes tengely rétege.
    this.gAxisX = that.svg.insert("svg:g", ".title_group")
            .attr("class", "axisX axis noEvents")
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

    // Feliratkozás az értékváltás mediátorra.
    var med;
    med = that.mediator.subscribe("changeValue", function (id, val, ratio) {
        that.doChangeValue(id, val, ratio);
    });
    that.mediatorIds.push({"channel": "changeValue", "id": med.id});

    // Feliratkozás a dimenzióváltó mediátorra.
    med = that.mediator.subscribe("changeDimension", function (panelId, newDimId, dimToChange) {
        that.doChangeDimension(panelId, newDimId, dimToChange);
    });
    that.mediatorIds.push({"channel": "changeDimension", "id": med.id});

    // Panel regisztrálása a nyilvántartóba.
    that.mediator.publish("register", that, that.panelId, [that.dimXToShow, that.dimYToShow], that.preUpdate, that.update, that.getConfig);
}

//////////////////////////////////////////////////
// Osztály-konstansok inicializálása.
//////////////////////////////////////////////////

{
    panel_bar2d.prototype = global.subclassOf(Panel); // A Panel metódusainak átvétele.
    panel_bar2d.prototype.barPadding = 0.1;			// Az oszlopok közötti rés az oszlopok szélességében.
    panel_bar2d.prototype.xAxisTectColor = global.panelBackgroundColor; // A vízszintes dimenziókra írás színe.
}

//////////////////////////////////////////////////
// Kirajzolást segítő függvények
//////////////////////////////////////////////////

/**
 * Egy adatsorból meghatározza a megmutatandó értéket.
 * 
 * @param {Object} d Nyers adatsor.
 * @returns {Number} Az értékek.
 */
panel_bar2d.prototype.valueToShow = function (d) {
    var that = this;
    if (d !== undefined && d.vals !== undefined) {
        var val = (that.valFraction) ? that.valMultiplier * d.vals[that.valToShow].sz / d.vals[that.valToShow].n : d.vals[that.valToShow].sz;
        var origVal = val;
        if (!isFinite(parseFloat(val))) {
            val = 0;
        }
        if (isNaN(parseFloat(origVal))) {
            origVal = "???";
        }
        return {value: val, originalValue: origVal};
    } else {
        return null;
    }
};

/**
 * Egy elemhez tartozó tooltipet legyártó függvény;
 * 
 * @param {Object} xElement Az X dimenzió mentén az elemet tartalmazó objektum.
 * @param {type} yElement Az Y dimenzió mentén az érték.
 * @returns {String} A megjelenítendő tooltip.
 */
panel_bar2d.prototype.getTooltip = function (xElement, yElement) {
    var that = this;
    //var xUnitProperty = (xElement.value === 1) ? "unit" : "unitPlural";
    var yUnitProperty = (yElement.value === 1) ? "unit" : "unitPlural";
    return that.createTooltip(
            [{
                    name: that.localMeta.dimensions[that.dimXToShow].description,
                    value: (xElement.name) ? xElement.name : _("Nincs adat")
                }, {
                    name: that.localMeta.dimensions[that.dimYToShow].description,
                    value: (yElement.dimYName) ? yElement.dimYName : _("Nincs adat")

                }],
            [{
                    name: that.localMeta.indicators[that.valToShow].description,
                    value: yElement.originalValue,
                    dimension: ((that.valFraction) ? that.localMeta.indicators[that.valToShow].fraction[yUnitProperty] : that.localMeta.indicators[that.valToShow].value[yUnitProperty])
                }]
            );
};

/**
 * Egy összetett névsor-összehasonlítót generál, amely az elemi adatsorokat
 * előszőr az X dimenzió mentén rendezi sorba, azon belül az Y szerint.
 * 
 * @returns {Function} Az összehasonlító-függvény.
 */
panel_bar2d.prototype.getCmpFunction = function () {
    var that = this;
    return function (a, b) {
        return global.realCompare(a.dims[that.dimX].name + ":" + a.dims[that.dimY].name, b.dims[that.dimX].name + ":" + b.dims[that.dimY].name);
    };
};

/**
 * Az adatok névsor szerinti sorbarendezéséhez szükséges névsor-összehasonlító.
 * 
 * @param {Object} a Egy adatelem.
 * @param {Object} b Egy másik adatelem.
 * @returns {boolean} Az összehasonlítás eredménye.
 */
panel_bar2d.prototype.simpleCmp = function (a, b) {
    return a.name.localeCompare(b.name);
};

/**
 * Beállítja az épp aktuális függőleges skálát. Ha az inicializáló objetum
 * fix skálát kért, akkor azt, ha nem, akkor az épp aktuális adatok alapján
 * automatikusan.
 * 
 * @param {Array} scale 2 elemű tömb a minimális és maximális értékkel.
 * @returns {undefined}
 */
panel_bar2d.prototype.setYScale = function (scale) {
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
panel_bar2d.prototype.preUpdate = function (drill) {
    var that = this;
    var oldPreparedData = this.preparedData;

    // Ha az X dimenzió mentén történik valami.
    if (drill.dim === that.dimXToShow) {

        // Ha az lefúrás, mindent, kivéve amibe fúrunk, letörlünk.
        if (drill.direction === -1) {

            // Tengelyfeliratok: nem kellőek törlése.
            that.gAxisX.selectAll("text")
                    .filter(function (d) {
                        return (d.id !== drill.toId);
                    })
                    .remove();

            that.gAxisXShadow.selectAll("rect")
                    .on("click", null)
                    .remove();

            // Oszlopok: nem kellőek letörlése.
            that.gBars.selectAll(".bar")
                    .filter(function (d) {
                        return (d.id !== drill.toId);
                    })
                    .on("click", null)
                    .remove();
        }

        // Ha felfúrás történik.
        else if (drill.direction === 1 && (that.dimXToShow !== that.dimYToShow) && oldPreparedData) {

            // Tengelyfeliratok: minden törlése.
            that.gAxisX.selectAll("text")
                    .filter(function (d) {
                        return (d.id !== drill.fromId);
                    })
                    .remove();

            that.gAxisXShadow.selectAll("rect")
                    .on("click", null)
                    .remove();

            // Az oszlopok átlagértékének meghatározása.
            var avgValues = [];
            var levelY = (global.baseLevels[that.panelSide])[that.dimYToShow].length;
            for (var j = 0, jMax = oldPreparedData.dimYArray.length; j < jMax; j++) {
                var avgHeight = d3.mean(oldPreparedData.dataArray, function (d) {
                    return (d.values[j] === undefined) ? undefined : d.values[j].height;
                });
                var avgY = d3.mean(oldPreparedData.dataArray, function (d) {
                    return (d.values[j] === undefined) ? undefined : d.values[j].y;
                });
                avgValues.push({dimYId: oldPreparedData.dimYArray[j].id, dimYUniqueId: levelY + "L" + oldPreparedData.dimYArray[j].id, height: avgHeight, y: avgY, startOpacity: 1});
            }

            // Minden oszlopelem eltörlése.
            that.gBars.selectAll(".bar")
                    .on("click", null)
                    .remove();

            // Átlaghoz tartozó oszlopelem kirajzolása.
            var levelX = (global.baseLevels[that.panelSide])[that.dimXToShow].length;
            that.gBars.selectAll(".bar").data([{id: drill.fromId, uniqueId: levelX + "L" + drill.fromId}])
                    .enter().append("svg:g")
                    .attr("class", "bar bordered darkenable")
                    .attr("transform", "translate(" + (that.xScale.range()[1] * (that.barPadding / 2)) + ", 0)")
                    .selectAll("rect").data(avgValues)
                    .enter().append("svg:rect")
                    .attr("x", 0)
                    .attr("width", that.xScale.range()[1] * (1 - that.barPadding))
                    .attr("y", function (d) {
                        return d.y;
                    })
                    .attr("height", function (d) {
                        return d.height;
                    })
                    .attr("fill", function (d) {
                        return global.color(d.dimYId);
                    })
                    .attr("opacity", 1);
        }
    }

    // Ha az Y dimenzió mentén történik valami.	
    else if (drill.dim === that.dimYToShow) {

        // Ha az lefúrás, mindent, kivéve amibe fúrunk, törlünk.
        if (drill.direction === -1) {

            // Jelkulcstéglalapok és feliratok: nem kellőek letörlése.
            that.gLegend.selectAll(".legendEntry")
                    .filter(function (d) {
                        return (d.id !== drill.toId);
                    })
                    .on("click", null)
                    .on("mouseover", null)
                    .on("mouseout", null)
                    .remove();

            // Oszlopok: mindent, kivéve amibe fúrunk, törlünk.
            that.gBars.selectAll(".bar rect")
                    .filter(function (d) {
                        return (d.dimYId !== drill.toId);
                    })
                    .remove();
        }

        // Ha felfúrás.		
        else if (drill.direction === 1) {

            // Mindent jelkulcsot törlünk.
            that.gLegend.selectAll(".legendEntry")
                    .on("mouseover", null)
                    .on("mouseout", null)
                    .on("click", null)
                    .remove();

            // Kirajzolunk egy teljes téglalapot a szülő színével.
            that.gLegend.selectAll("g").data([1])
                    .enter().append("svg:g")
                    .append("svg:path")
                    .attr("d", global.rectanglePath(
                            that.legendOffsetX, // x
                            that.h - global.legendHeight - global.legendOffsetY, // y
                            that.legendWidth, // width
                            global.legendHeight, // height
                            global.rectRounding, // Minden sarka lekerekített.
                            global.rectRounding,
                            global.rectRounding,
                            global.rectRounding))
                    .attr("class", "legend bordered darkenable")
                    .attr("fill", global.color(drill.fromId));
        }
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
panel_bar2d.prototype.prepareData = function (oldPreparedData, newDataRows, drill) {
    var that = this;
    var levelX = (global.baseLevels[that.panelSide])[that.dimXToShow].length;
    var levelY = (global.baseLevels[that.panelSide])[that.dimYToShow].length;

    newDataRows.sort(that.getCmpFunction());	// Elemi adatok sorbarendezése.

    var dimYArray = [];		// Értékek az Y dimenzió mentén. (Azért kell, mert az adatok az X mentén kerülnek tárolásra.)
    var dataArray = [];		// Az adatok tömbje, az X dimenzió mentén tárolva, azon belül pedig az Y mentén.

    // Maximális oszlophossz meghatározása, oszlop x, y helyének adatbaírása
    var currentXDimId;
    var currentXPosition = -1;

    // Első végigfutás: alapértékek beállítása, a maximumok meghatározása, és az y dimenziók feltöltése.
    for (var i = 0; i < newDataRows.length; i++) {
        var d = newDataRows[i];

        // Ha új X-dimenzióbeli elemről van szó, létrehozunk egy új üres element.
        if (d.dims[that.dimX].id !== currentXDimId) {
            currentXDimId = d.dims[that.dimX].id;
            currentXPosition++;
            var element = {};
            element.index = currentXPosition;
            element.id = currentXDimId;
            element.uniqueId = levelX + "L" + element.id;
            element.name = d.dims[that.dimX].name.trim();
            element.values = [];
            element.sumValues = 0;
            dataArray.push(element);
        }

        var dimY = d.dims[that.dimY];
        var index = global.positionInArrayByProperty(dimYArray, "id", dimY.id);

        // Y dimenzió hozzáadása, ha még nem volt benne.
        if (index === -1) {
            index = dimYArray.length;
            var dimYElement = {
                index: index,
                id: dimY.id,
                uniqueId: levelY + "L" + dimY.id,
                knownId: dimY.knownId,
                name: dimY.name.trim(),
                parentId: dimY.parentId,
                tooltip: "<html>" + dimY.name.trim() + "</html>"
            };
            dimYArray.push(dimYElement);
        }

        // Az utolsó x-dimenzióhoz tartozó rekeszbe beleírjuk az y dimenzió szerinti értéket.
        var element = dataArray[dataArray.length - 1];
        var val = that.valueToShow(d);
        element.values.push({
            index: index,
            value: val.value,
            originalValue: val.originalValue,
            dimYId: dimY.id,
            dimYUniqueId: levelY + "L" + dimY.id,
            dimYName: dimY.name.trim()});
        element.sumValues = element.sumValues + val.value;
    }

    // X irányú lefúrás esetén: ebből a régi elemből kell kinyitni mindent.
    var openFromXElement = (drill.dim === that.dimXToShow && drill.direction === -1 && oldPreparedData !== undefined) ? global.getFromArrayByProperty(oldPreparedData.dataArray, 'id', drill.toId) : null;
    var oldX = (openFromXElement) ? openFromXElement.x : 0; // Az új elemek kinyitásának kezdőpozíciója.

    // X irányú felfúrás esetén: annak az elemnek az indexe az új adatokban, amit előzőleg kibontva mutattunk.
    var openToXElementIndex = (drill.dim === that.dimXToShow && drill.direction === 1) ? global.positionInArrayByProperty(dataArray, 'id', drill.fromId) : null;

    var onlyOneBarX = that.xScale.range()[1];	// Ha csak 1 diagramelem van, az ilyen széles a paddinggal együtt.
    var onlyOneBarWidth = onlyOneBarX * (1 - that.barPadding); // Ha csak 1 diagramelem van, az ilyen széles.

    var oldDataMax = that.yScale.domain()[1]; // Az Y skála régi végpontja.
    var dataMax = d3.max(dataArray, function (d) {
        return d.sumValues;
    });

    // Új skálák beállítása.
    that.xScale.domain([0, dataArray.length]);
    that.setYScale([0, dataMax]);

    // A régi és az új Y skála közötti arány.
    var yMagRatio = ((that.isStretched) ? 1 : that.yScale.domain()[1] / oldDataMax);

    // Identikus skála; ha széthúzott üzemmódban vagyunk, akkor minden egyes elemnél átalakítjuk.
    var strechScale = d3.scaleLinear()
            .domain([0, dataMax])
            .range([0, dataMax]);

    var elementWidth = that.xScale(1 - that.barPadding); // Az új elemek végső szélessége.

    // Második végigfutás: a kirajzoláshoz szükséges értékek meghatározása.
    for (var i = 0, iMax = dataArray.length; i < iMax; i++) {
        var element = dataArray[i];
        var oldElement = (oldPreparedData !== undefined) ? global.getFromArrayByProperty(oldPreparedData.dataArray, 'id', element.id) : undefined;
        if (that.isStretched) { // Ha 100%-ra széthúzott módban vagyunk, az oszlopok skáláját hozzáigazítjuk.
            strechScale.domain([0, element.sumValues]);
        }

        // Az új megjelenési koordináták beállítása.
        element.x = that.xScale(i + that.barPadding / 2);
        element.width = elementWidth;

        // A régi x koordináták beállítása: innen fog kinyílni az animáció.
        if (drill.dim === that.dimXToShow && drill.direction === -1 && openFromXElement) { // Ha x mentén lefúrás van.
            element.oldX = oldX;
            element.oldWidth = (openFromXElement.width / iMax);
            oldX = oldX + element.oldWidth;
        } else if (drill.dim === that.dimXToShow && drill.direction === 1) { // Ha x mentén kifúrás van.
            element.oldX = (i - openToXElementIndex + that.barPadding / 2) * onlyOneBarX;
            element.oldWidth = onlyOneBarWidth;
        } else { // Különben.
            element.oldX = element.x;
            element.oldWidth = element.width;
        }

        var values = element.values;

        // Az elemi téglalapok új y koordinátáinak meghatározása.
        var accumulation = 0;
        for (var j = 0, jMax = values.length; j < jMax; j++) {
            var d = element.values[j];
            d.height = that.yScale(strechScale(0)) - that.yScale(strechScale(d.value));
            d.y = that.yScale(strechScale(d.value + accumulation));
            d.tooltip = that.getTooltip(element, d);
            accumulation = accumulation + d.value;
        }

        // A régi y koordináta-értékek meghatározása.
        if (drill.dim === that.dimXToShow && drill.direction === -1 && openFromXElement) { // Ha X mentén való lefúrás történt.
            for (var j = 0, jMax = values.length; j < jMax; j++) {
                var d = element.values[j];
                d.oldY = openFromXElement.values[j].y;
                d.oldHeight = openFromXElement.values[j].height;
                d.startOpacity = 1;
            }
        } else if (drill.dim === that.dimXToShow && drill.direction === 1) { // Ha X mentén való felfúrás történt.
            for (var j = 0, jMax = values.length; j < jMax; j++) {
                var d = element.values[j];
                d.oldY = global.orZero(that.height * (1 - yMagRatio) + yMagRatio * d.y);
                d.oldHeight = global.orZero(yMagRatio * d.height);
                d.startOpacity = (i === openToXElementIndex) ? 1 : 0;
            }
        } else if (drill.dim === that.dimYToShow && drill.direction === -1 && oldElement !== undefined) { // Ha Y mentén való lefúrás történt.
            var openFromYElement = global.getFromArrayByProperty(oldElement.values, 'dimYId', drill.toId);
            var oldY = openFromYElement.y + openFromYElement.height;
            for (var j = 0, jMax = values.length; j < jMax; j++) {
                var d = element.values[j];
                d.oldHeight = openFromYElement.height / jMax;
                oldY = oldY - d.oldHeight;
                d.oldY = oldY;
                d.startOpacity = 1;
            }
        } else if (drill.dim === that.dimYToShow && drill.direction === 1 && oldElement !== undefined) { // Ha Y mentén való felfúrás történt.
            var oldValues = oldElement.values;
            var openToYElementIndex = global.positionInArrayByProperty(values, "dimYId", drill.fromId);
            var yHeightRatio = (oldValues[0].y - oldValues[oldValues.length - 1].y + oldValues[0].height) / values[openToYElementIndex].height;
            for (var j = 0, jMax = values.length; j < jMax; j++) {
                var d = element.values[j];
                d.oldY = (that.isStretched) ? (openToYElementIndex - j) * that.height : (d.y - values[openToYElementIndex].y) * yHeightRatio + oldValues[oldValues.length - 1].y || that.height;
                d.oldHeight = (that.isStretched) ? that.height : d.height * yHeightRatio || 0;
                d.startOpacity = (j === openToYElementIndex) ? 1 : 0;
            }
        } else { // Különben.
            for (var j = 0, jMax = values.length; j < jMax; j++) {
                var d = element.values[j];
                d.oldY = that.height;
                d.oldHeight = 0;
                d.startOpacity = 1;
            }
        }
    }

    // Az y dimenzió mentén a jelkulcstömb pozíciókkal való kiegészítése.
    dimYArray.sort(that.simpleCmp);
    var openFromLegendElement = (drill.dim === that.dimYToShow && drill.direction === -1 && oldElement !== undefined) ? global.getFromArrayByProperty(oldPreparedData.dimYArray, 'id', drill.toId) : null;
    var openToLegendIndex = (drill.dim === that.dimYToShow && drill.direction === 1) ? global.positionInArrayByProperty(dimYArray, 'id', drill.fromId) : null;
    var l_width = that.legendWidth / dimYArray.length;
    for (var i = 0, iMax = dimYArray.length; i < iMax; i++) {
        var yElement = dimYArray[i];
        yElement.x = i * l_width;
        yElement.width = l_width;
        if (drill.dim === that.dimXToShow && drill.direction === -1) { // Ha X mentén való lefúrás történt.
            yElement.oldX = yElement.x;
            yElement.oldWidth = yElement.width;
            yElement.startOpacity = 0;
        } else if (drill.dim === that.dimXToShow && drill.direction === 1) { // Ha X mentén való felfúrás történt.
            yElement.oldX = yElement.x;
            yElement.oldWidth = yElement.width;
            yElement.startOpacity = 0;
        } else if (drill.dim === that.dimYToShow && drill.direction === -1 && oldElement !== undefined) { // Ha Y mentén való lefúrás történt.
            yElement.oldX = openFromLegendElement.x + i * openFromLegendElement.width / iMax;
            yElement.oldWidth = openFromLegendElement.width / iMax;
            yElement.startOpacity = 1;
        } else if (drill.dim === that.dimYToShow && drill.direction === 1) { // Ha Y mentén való felfúrás történt.
            yElement.oldX = (i - openToLegendIndex) * that.legendWidth;
            yElement.oldWidth = that.legendWidth;
            yElement.startOpacity = (i === openToLegendIndex) ? 1 : 0;
        } else { // Különben.
            yElement.oldX = yElement.x;
            yElement.oldWidth = yElement.width;
            yElement.startOpacity = 0;
        }
    }

    return {dataArray: dataArray, dimYArray: dimYArray};
};

/**
 * Új adat megérkeztekor levezényli a panel frissítését.
 * 
 * @param {Object} data Az új adat.
 * @param {Object} drill Az épp végrehajzásra kerülő fúrás.
 * @returns {undefined}
 */
panel_bar2d.prototype.update = function (data, drill) {
    var that = this;
    that.data = data || that.data;
    drill = drill || {dim: -1, direction: 0};

    // A hányados kijelzés, és a szorzó felfrissítése.
    that.valMultiplier = (isNaN(parseFloat(that.meta.indicators[that.valToShow].fraction.multiplier))) ? 1 : parseFloat(that.meta.indicators[that.valToShow].fraction.multiplier);
    if (that.valFraction && that.meta.indicators[that.valToShow].fraction.hide) {
        that.valFraction = false;
    }
    if (!that.valFraction && that.meta.indicators[that.valToShow].value.hide) {
        that.valFraction = true;
    }

    var tweenDuration = (drill.duration === undefined) ? global.getAnimDuration(-1, that.panelId) : drill.duration;
    if (that.data.rows.length > that.maxEntries) {
        that.panic(true, _("<html>A panel nem képes ") + that.data.rows.length + _(" értéket megjeleníteni.<br />A maximálisan megjeleníthető értékek száma ") + that.maxEntries + _(".</html>"));
        that.preparedData = undefined;
    } else {
        that.preparedData = that.prepareData(that.preparedData, that.data.rows, drill);
        var maxInDim = Math.max(that.preparedData.dimYArray.length, Math.ceil(that.data.rows.length / that.preparedData.dimYArray.length));
        if (maxInDim > that.maxEntries1D) {
            that.panic(true, _("<html>A panel nem képes ") + maxInDim + " értéket egy dimenzió mentén megjeleníteni.<br />A maximálisan megjeleníthető értékek száma " + that.maxEntries1D + ".</html>");
            that.preparedData = undefined;
        } else {
            that.panic(false);
            var trans = d3.transition().duration(tweenDuration);
            that.drawAxes(that.preparedData, trans);
            that.drawBars(that.preparedData, trans);
            that.drawLegend(that.preparedData, trans);
        }
    }
    var titleMeta = that.localMeta.indicators[that.valToShow];
    that.titleBox.update(that.valToShow, titleMeta.caption, titleMeta.value.unitPlural, titleMeta.fraction.unitPlural, that.valFraction, tweenDuration);
};

/**
 * Kirajzolja és helyére animálja az oszlopdiagramokat.
 * 
 * @param {Object} preparedData Az ábrázoláshoz előkészített adat.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_bar2d.prototype.drawBars = function (preparedData, trans) {
    var that = this;

    // Egy téglalap konténere, és a hozzá tartozó adat hozzácsapása.
    var gBar = that.gBars.selectAll(".bar")
            .data(preparedData.dataArray, function (d) {
                return d.uniqueId;
            });

    // Kilépő oszlopkonténer törlése.
    gBar.exit()
            .on("click", null)
            .remove();

    // Az új oszlopok tartójának elkészítése.
    gBar = gBar.enter().append("svg:g")
            .attr("class", "bar bordered darkenable")
            .attr("transform", function (d) {
                return "translate(" + d.oldX + ", 0)";
            })
            .merge(gBar);

    // Lefúrás eseménykezelőjének hozzácsapása az oszlopkonténerhez.
    gBar.classed("listener", true)
            .on("click", function (d) {
                that.drill(that.dimX, d);
            });

    // Elemi oszlopelemek megrajzolása, kilépők letörlése.
    var oldWidth = preparedData.dataArray[0].oldWidth; // A régi téglalapszélesség; ki kell szedni, hogy minden elemhez használhassuk.
    var barRect = gBar.selectAll("rect")
            .data(function (d) {
                return d.values;
            }, function (d) {
                return d.dimYUniqueId;
            });

    barRect.exit().remove();

    barRect.enter().append("svg:rect")
            .attr("x", 0)
            .attr("width", oldWidth)
            .attr("y", function (d2) {
                return d2.oldY;
            })
            .attr("height", function (d2) {
                return d2.oldHeight;
            })
            .attr("fill", function (d2) {
                return global.color(d2.dimYId);
            })
            .attr("opacity", function (d2) {
                return d2.startOpacity;
            });

    // Megjelenési animáció: akárhol is volt, a helyére megy.
    gBar.transition(trans)
            .attr("transform", function (d) {
                return "translate(" + d.x + ", 0)";
            })
            .selectAll("rect")
            .attr("y", function (d2) {
                return d2.y;
            })
            .attr("height", function (d2) {
                return d2.height;
            })
            .attr("width", that.xScale(1 - that.barPadding))
            .attr("fill", function (d2) {
                return global.color(d2.dimYId);
            })
            .attr("opacity", 1)
            .on("end", function () {
                d3.select(this).attr("class", function (d2) {
                    return "controlled controlled" + d2.index;
                });
            });
};

/**
 * Jelkulcs (ami egyben az Y dimenziók vezérlője) felrajzolása.
 * 
 * @param {Object} preparedData Az ábrázoláshoz előkészített adat.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_bar2d.prototype.drawLegend = function (preparedData, trans) {
    var that = this;
    var legendArray = preparedData.dimYArray;

    // Egy elem tartó g-je, ebbe kerül a téglalp, és rá a szöveg.
    var legend = that.gLegend.selectAll(".legendEntry")
            .data(legendArray, function (d) {
                return d.uniqueId;
            });

    // Kilépő tartók letörlése.
    legend.exit()
            .on("click", null)
            .on("mouseover", null)
            .on("mouseout", null)
            .remove();

    // Új elemek létrehozása.
    var legend_new = legend.enter().insert("svg:g", ".bar_group")
            .attr("transform", function (d) {
                return "translate(" + (d.oldX + that.legendOffsetX) + ", " + (that.h - global.legendHeight - global.legendOffsetY) + ")";
            })
            .on("click", function (d) {
                that.drill(that.dimY, d);
            })
            .on("mouseover", function () {
                d3.select(this).classed("triggered", true);
            })
            .on("mouseout", function () {
                d3.select(this).classed("triggered", false);
            });

    // Kezdőtéglalap rajzolása az új tartókba.
    legend_new.append("svg:path")
            .attr("class", "legend bordered")
            .attr("d", function (d) {
                return global.rectanglePath(
                        0, // x
                        0, // y
                        d.oldWidth, // width
                        global.legendHeight, // height
                        0, 0, 0, 0);  // rounding
            })
            .attr("fill", function (d) {
                return global.color(d.id);
            })
            .attr("opacity", function (d) {
                return d.startOpacity;
            });

    // Szöveg beleírása a tartókba.
    legend_new.append("svg:text")
            .attr("class", "legend noEvents")
            .attr("x", 0)
            .attr("y", global.legendHeight / 2)
            .attr("dy", "0.35em")
            .attr("opacity", 0)
            .text(function (d) {
                return d.name;
            });

    legend = legend_new.merge(legend);

    legend.attr("class", function (d) {
        return "legendEntry listener legendControl" + d.index;
    })
            .select("text")
            .attr("fill", function (d) {
                return global.readableColor(global.color(d.id));
            });

    // A téglalapok helyre animálása.
    legend.transition(trans)
            .attr("transform", function (d) {
                return "translate(" + (d.x + that.legendOffsetX) + ", " + (that.h - global.legendHeight - global.legendOffsetY) + ")";
            });

    legend.select("path")
            .attr("fill", function (d) {
                return global.color(d.id);
            })
            .transition(trans)
            .attr("d", function (d, i) {
                return global.rectanglePath(
                        0, // x
                        0, // y
                        d.width, // width
                        global.legendHeight, // height
                        (i === 0) ? global.rectRounding : 0, // balfelső roundsága
                        (i === legendArray.length - 1) ? global.rectRounding : 0, // jobbfelső
                        (i === legendArray.length - 1) ? global.rectRounding : 0, // jobbalsó
                        (i === 0) ? global.rectRounding : 0); // balalsó
            })
            .attr("opacity", 1)
            .on("end", function () {
                d3.select(this).classed("darkenable", true);
            });

    // Szövegelemek helyre animálása.
    legend.select("text")
            .text(function (d) {
                return d.name;
            })
            .transition(trans)
            .attr("opacity", 1);

    // A szövegek összenyomása, hogy elférjenek.
    var legendText = legend.selectAll("text");
    global.cleverCompress(legendText, that.legendWidth / legendArray.length - 0.5 * that.legendOffsetX, 1, undefined, false, true, that.legendWidth / legendArray.length);
};

/**
 * A tengelyek kirajzolása.
 * 
 * @param {Object} preparedData A panel által megjelenítendő, feldolgozott adatok.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_bar2d.prototype.drawAxes = function (preparedData, trans) {
    var that = this;

    that.xAxisTextColor = global.readableColor(global.colorValue(0));
    var shadowSize = global.axisTextSize(that.xScale(1));	// A vízszintes tengely betűje mögötti klikk-téglalap mérete.
    var axisTextSize = (shadowSize < 6) ? 0 : shadowSize;	// A vízszintes tengely betűmérete.

    // Függőleges tengely kirajzolása, animálása.
    if (that.gAxisY.selectAll("path").nodes().length > 0) {
        that.gAxisY.transition(trans).call(that.yAxis);
    } else {
        that.gAxisY.call(that.yAxis);
    }

    // Feliratok a vízszintes tengelyre, és a hozzá tartozó adat.
    var axisLabelX = that.gAxisX.selectAll("text")
            .data(preparedData.dataArray, function (d) {
                return d.id + d.name;
            });

    // Kilépő feliratok letörlése.
    axisLabelX.exit()
            .transition(trans).attr("opacity", 0)
            .remove();

    // Belépő feliratok elhelyezése.
    var axisLabelXText = axisLabelX.enter()
            .append("svg:text")
            .attr("class", "shadowedLabel")
            .attr("font-size", axisTextSize)
            .attr("opacity", function (d) {
                return (global.valueInRange(d.oldX, 0, that.w)) ? 0 : global.axisTextOpacity;
            })
            .attr("transform", function (d) {
                return "rotate(-90)";
            })
            .attr("x", -that.height + 0.26 * axisTextSize)
            .attr("y", function (d) {
                return d.oldX + d.oldWidth / 2 + 0.35 * axisTextSize;
            })
            .attr("text-anchor", "beginning")
            .text(function (d) {
                return d.name;
            });

    axisLabelX = axisLabelXText.merge(axisLabelX);

    // Maradó feliratok helyre animálása.
    axisLabelX
            .attr("fill", that.xAxisTextColor)
            .transition(trans)
            .attr("font-size", axisTextSize)
            .attr("x", -that.height + 0.26 * axisTextSize)
            .attr("y", function (d) {
                return d.x + d.width / 2 + 0.35 * axisTextSize;
            })
            .attr("opacity", global.axisTextOpacity);

    // Feliratok összenyomása, hogy tuti elférjenek.
    global.cleverCompress(axisLabelXText, that.height, 0.95, undefined, true);

    // Háttértéglalapok, és azt azt létrehozó időzítés törlése.
    clearTimeout(that.shadowTimeout);
    that.gAxisXShadow.selectAll("rect")
            .on("click", null)
            .remove();

    // Háttértéglalapok, eseménykezelő létrehozása, de csak az animáció lefutása után.
    that.shadowTimeout = setTimeout(function () {
        that.gAxisXShadow.selectAll("rect")
                .data(preparedData.dataArray, function (d) {
                    return d.id + d.name;
                })
                .enter()
                .append("svg:rect")
                .classed("listener", true)
                .attr("width", shadowSize * 1.05)
                .attr("height", function (d) {
                    return Math.max(30, 0.5 * shadowSize + Math.min(that.gAxisX.selectAll("text").filter(function (d2) {
                        return d === d2;
                    }).nodes()[0].getComputedTextLength(), 0.7 * that.h));
                })
                .attr("y", function (d) {
                    return that.height - Math.max(30, 0.5 * shadowSize + Math.min(that.gAxisX.selectAll("text").filter(function (d2) {
                        return d === d2;
                    }).nodes()[0].getComputedTextLength(), 0.7 * that.h));
                })
                .attr("x", function (d) {
                    return d.x + (d.width - shadowSize) / 2;
                })
                .attr("opacity", 0)
                .on("click", function (d) {
                    that.drill(that.dimX, d);
                });
    }, trans.duration());

};

//////////////////////////////////////////////////
// Irányítást végző függvények
//////////////////////////////////////////////////

/**
 * Valamely dimenzióban történő le vagy felfúrást kezdeményező függvény.
 * 
 * @param {Integer} dim A lefúrás dimenziója (0 vagy 1).
 * @param {Object} d Lefúrás esetén a lefúrás céleleme. Ha undefined, akkor felfúrásról van szó.
 * @returns {undefined}
 */
panel_bar2d.prototype.drill = function (dim, d) {
    global.tooltip.kill();
    var drill = {
        dim: (dim === this.dimX) ? this.dimXToShow : this.dimYToShow,
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
 * @param {boolean} ratio Hányadost mutasson-e. Ha -1 akkor a másikra ugrik, ha undefined, nem vált.
 * @returns {undefined}
 */
panel_bar2d.prototype.doChangeValue = function (panelId, value, ratio) {
    var that = this;
    if (panelId === undefined || panelId === that.panelId) {
        if (value !== undefined) {
            that.valToShow = (value === -1) ? (that.valToShow + 1) % that.meta.indicators.length : value;
            that.actualInit.val = that.valToShow;
        }
        if (ratio !== undefined) {
            that.valFraction = (ratio === -1) ? !that.valFraction : ratio;
            that.actualInit.ratio = that.valFraction;
        }
        that.update();
        global.getConfig2();
    }
};

/**
 * A dimenzióváltást végrehajtó függvény.
 * 
 * @param {String} panelId A dimenzióváltást kapó panel ID-ja.
 * @param {Integer} newDimId A helyére bejövő dimenzió ID-ja.
 * @param {Integer} dimToChange A megváltoztatandó dimenzió sorszáma (0 vagy 1).
 * @returns {undefined}
 */
panel_bar2d.prototype.doChangeDimension = function (panelId, newDimId, dimToChange) {
    var that = this;
    if (panelId === that.panelId) {
        if (dimToChange === 0) {
            that.dimXToShow = newDimId;
            that.actualInit.dimx = that.dimXToShow;
        } else {
            that.dimYToShow = newDimId;
            that.actualInit.dimy = that.dimYToShow;
        }
        that.dimX = (that.dimXToShow <= that.dimYToShow) ? 0 : 1; // Az x tengelyen megjelenítendő dimenzió sorszáma (a data-n belül).
        that.dimY = (that.dimXToShow < that.dimYToShow) ? 1 : 0; // Az oszloposztásban megjelenítendő dimenzió sorszáma (a data-n belül).

        that.mediator.publish("register", that, that.panelId, [that.dimXToShow, that.dimYToShow], that.preUpdate, that.update, that.getConfig);

        global.tooltip.kill();
        that.mediator.publish("drill", {dim: -1, direction: 0, toId: undefined});
    }
};
