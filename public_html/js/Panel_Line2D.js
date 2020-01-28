/* global Panel, d3, global */

'use strict';

var line2panel = panel_line2d;
/**
 * A 2 dimenzió mentén ábrázoló oszlopdiagram konstruktora.
 * 
 * @param {Object} init Inicializáló objektum.
 * @returns {panel_line2d}
 */
function panel_line2d(init) {
    var that = this;

    this.constructorName = "panel_line2d";

    // Inicializáló objektum beolvasása, feltöltése default értékekkel.
    this.defaultInit = {group: 0, position: undefined, dimx: 0, dimy: 1, val: 0, multiplier: 1, ratio: false, symbols: false, domain: [], domainr: [], mag: 1, fromMag: 1};
    this.actualInit = global.combineObjects(that.defaultInit, init);

    Panel.call(that, that.actualInit, global.mediators[that.actualInit.group], true, global.numberOffset, 0); // A Panel konstruktorának meghívása.

    this.valToShow = that.actualInit.val;					// Az ennyiedik mutatót mutatja.
    this.valFraction = that.actualInit.ratio;				// Hányadost mutasson, vagy abszolútértéket?
    this.dimXToShow = that.actualInit.dimx;					// Az X tengely mentén mutatott dimenzió.
    this.dimYToShow = that.actualInit.dimy;					// Az Y tengely mentén mutatott dimenzió.
    this.valMultiplier = that.actualInit.multiplier;		// Ennyiszeresét kell mutatni az értékeknek.
    this.dimX = (that.dimXToShow <= that.dimYToShow) ? 0 : 1;// Az x tengelyen megjelenítendő dimenzió sorszáma (a data-n belül).
    this.dimY = (that.dimXToShow < that.dimYToShow) ? 1 : 0;// Az oszloposztásban megjelenítendő dimenzió sorszáma (a data-n belül).
    this.isSymbolsRequired = that.actualInit.symbols;	// Rajzoljunk jelölőt a vonaldiagramra?
    this.preparedData;										// A feldolgozott adat.
    this.maxEntries = global.maxEntriesIn2D;                // A panel által maximálisan megjeleníthető adatok száma.
    this.maxEntries1D = global.maxEntriesIn1D;              // A panel által 1 dimenzióban maximálisan megjeleníthető adatok száma.
    this.shadowTimeout;                                     // A háttértéglalapokat létrehozó időzítés.
    this.maskId = global.randomString(12);                  // A maszk réteg id-je. Véletlen, nehogy kettő azonos legyen.    

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

    // Vonaldiagramok rétege.
    this.gLines = that.svg.insert("svg:g", ".title_group")
            .attr("class", "line_group")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")")
            .attr("mask", "url(#maskurl" + that.maskId + ")");


    // Függőleges tengely rétege.
    this.gAxisY = that.svg.insert("svg:g", ".title_group")
            .attr("class", "axis axisY noEvents")
            .attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")");

    // A kilógó oszlopok végét elhalványító.
    this.mask = that.svg.append("svg:mask")
            .attr("id", "maskurl" + that.maskId);

    // A halványító gradiens maszkra rajzolása.
    that.mask
            .append("svg:rect")
            .attr("x", 0)
            .attr("width", "100%")
            .attr("y", -that.margin.top)
            .attr("height", that.h)
            .attr("fill", (that.magLevel === 1) ? "url(#overflow)" : "url(#overflow2)");

    // A jelkulcs maszkra rajzolása.
    that.mask.append("svg:rect")
            .attr("x", that.legendOffsetX - that.margin.left)
            .attr("y", (that.h - global.legendHeight - global.legendOffsetY - that.margin.top))
            .attr("rx", global.rectRounding)
            .attr("ry", global.rectRounding)
            .attr("width", that.legendWidth)
            .attr("height", global.legendHeight)
            .attr("fill", "black");

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
    panel_line2d.prototype = global.subclassOf(Panel); // A Panel metódusainak átvétele.
    panel_line2d.prototype.barPadding = 0.1;			// Az oszlopok közötti rés az oszlopok szélességében.
    panel_line2d.prototype.xAxisTectColor = global.panelBackgroundColor; // A vízszintes dimenziókra írás színe.
    panel_line2d.prototype.symbolSize = 128;			// A jelölő mérete.
    panel_line2d.prototype.symbolSize_background = 140;// A jelölő takaró hátterének mérete.

    // Vonaldiagram path-generátora, az objektum x,y property-éből dolgozik.
    panel_line2d.prototype.lineBarGenerator = d3.line()
            .x(function (d) {
                return d.x;
            })
            .y(function (d) {
                return d.y;
            });

    // A régi vonaldiagram path-generátora, az objektum oldX,oldY property-éből dolgozik.
    panel_line2d.prototype.oldLineBarGenerator = d3.line()
            .x(function (d) {
                return d.oldX;
            })
            .y(function (d) {
                return d.oldY;
            });
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
panel_line2d.prototype.valueToShow = function (d) {
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
 * @param {Object} yElement Az Y dimenzió mentén az érték.
 * @returns {String} A megjelenítendő tooltip.
 */
panel_line2d.prototype.getTooltip = function (xElement, yElement) {
    var that = this;
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
panel_line2d.prototype.getCmpFunction = function () {
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
panel_line2d.prototype.simpleCmp = function (a, b) {
    return a.name.localeCompare(b.name);
};

/**
 * Adott magasságú és helyzetű vízszintes vonalat készít path-ként.
 * 
 * @param {type} x0 Kezdőpont x koordinátája.
 * @param {type} x1 Végpont x koordinátája.
 * @param {type} y A vonal y koordinátája.
 * @returns {String} A vonalat leíró path.
 */
panel_line2d.prototype.horizontalLine = function (x0, x1, y) {
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
panel_line2d.prototype.veeLine = function (pointArray, id) {
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
panel_line2d.prototype.extrapolate = function (coord, last, prev) {
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
panel_line2d.prototype.interpolate = function (coord, a, b, c, i, iMax) {
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
panel_line2d.prototype.setYScale = function (scale) {
    var actualScaleDomain = (this.valFraction) ? this.actualInit.domainr : this.actualInit.domain;
    if ((actualScaleDomain instanceof Array) && actualScaleDomain.length === 2) {
        this.yScale.domain(actualScaleDomain);
    } else {
        this.yScale.domain(scale);
    }
    this.yScale.nice(10);
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
panel_line2d.prototype.preUpdate = function (drill) {
    var that = this;
    var oldPreparedData = this.preparedData;

    if (drill.dim === that.dimXToShow && that.dimXToShow === that.dimYToShow) { // Ha az X és Y dimenzióban ugyanaz van, és amentén fúrunk

        // Tengelyfeliratok: nem kellőek törlése.
        that.gAxisX.selectAll("text")
                .filter(function (d) {
                    return (d.id !== drill.toId);
                })
                .remove();

        // Vonalak: mindent, kivéve amibe fúrunk, törlünk.
        that.gLines.selectAll(".lineChart")
                .filter(function (d) {
                    return (d.idY !== drill.toId);
                })
                .remove();

        // Szimbólumok: törlés.
        that.gLines.selectAll(".lineSymbolHolder")
                .on("click", null)
                .remove();

        // Ha az lefúrás, mindent, kivéve amibe fúrunk, törlünk.
        // Jelkulcstéglalapok és feliratok: nem kellőek letörlése.
        that.gLegend.selectAll(".legendEntry")
                .filter(function (d) {
                    return (d.id !== drill.toId);
                })
                .on("click", null)
                .on("mouseover", null)
                .on("mouseout", null)
                .remove();
    }

    // Ha az X dimenzió mentén történik valami.
    else if (drill.dim === that.dimXToShow) {

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

            // Vonalak: csökkentett méretűvel való pótlás.
            that.gLines.selectAll(".lineChart")
                    .attr("d", function (d) {
                        return that.veeLine(d, drill.toId);
                    });

            // Szimbólumok: törlés.
            that.gLines.selectAll(".lineSymbolHolder")
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

            // Vonalak: az átlagértékel való pótlás.
            that.gLines.selectAll(".lineChart")
                    .attr("d", function (d) {
                        var avgY = d3.mean(d, function (d2) {
                            return (d2.id < -10) ? undefined : d2.y;
                        });
                        return that.horizontalLine(-that.margin.left, that.width + that.margin.right, avgY);
                    });

            // Szimbólumok: törlés.
            that.gLines.selectAll(".lineSymbolHolder")
                    .on("click", null)
                    .remove();
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

            // Vonalak: mindent, kivéve amibe fúrunk, törlünk.
            that.gLines.selectAll(".lineChart")
                    .filter(function (d) {
                        return (d.idY !== drill.toId);
                    })
                    .remove();

            // Szimbólumok: törlés.
            that.gLines.selectAll(".lineSymbolHolder")
                    .on("click", null)
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

            // Vonalak: mindent, kivéve amibe fúrunk, törlünk.
            that.gLines.selectAll(".lineChart")
                    .filter(function (d, i) {
                        return (i !== 0);
                    })
                    .remove();

            that.gLines.selectAll(".lineChart");

            that.gLines.selectAll(".lineChart")
                    .attr("stroke", global.color(drill.fromId));

            // Szimbólumok: törlés.
            that.gLines.selectAll(".lineSymbolHolder")
                    .on("click", null)
                    .remove();
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
panel_line2d.prototype.prepareData = function (oldPreparedData, newDataRows, drill) {
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
            var currentYDimId = d.dims[that.dimY].id;
            currentXPosition++;
            var Xelement = {};
            Xelement.index = currentXPosition;
            Xelement.id = currentXDimId;
            Xelement.uniqueId = levelX + "L" + currentYDimId;
            Xelement.name = d.dims[that.dimX].name.trim();
            Xelement.values = [];
            Xelement.minValues = 0;
            Xelement.maxValues = 0;
            dataArray.push(Xelement);
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
        var Xelement = dataArray[dataArray.length - 1];
        var val = that.valueToShow(d);
        var YElement = {
            index: index,
            value: val.value,
            originalValue: val.originalValue,
            dimYId: dimY.id,
            dimYUniqueId: levelY + "L" + dimY.id,
            dimYName: dimY.name.trim()
        };
        YElement.tooltip = that.getTooltip(Xelement, YElement);
        Xelement.values.push(YElement);

        Xelement.minValues = Math.min(Xelement.minValues, val.value);
        Xelement.maxValues = Math.max(Xelement.maxValues, val.value);
    }

    // X irányú lefúrás esetén: ebből a régi elemből kell kinyitni mindent.
    var openFromXElement = (drill.dim === that.dimXToShow && drill.direction === -1 && oldPreparedData !== undefined) ? global.getFromArrayByProperty(oldPreparedData.dataArray, 'id', drill.toId) : null;
    var oldX = (openFromXElement) ? openFromXElement.x : 0; // Az új elemek kinyitásának kezdőpozíciója.

    // X irányú felfúrás esetén: annak az elemnek az indexe az új adatokban, amit előzőleg kibontva mutattunk.
    var openToXElementIndex = (drill.dim === that.dimXToShow && drill.direction === 1) ? global.positionInArrayByProperty(dataArray, 'id', drill.fromId) : null;

    var onlyOneBarX = that.xScale.range()[1];	// Ha csak 1 diagramelem van, az ilyen széles a paddinggal együtt.
    var onlyOneBarWidth = onlyOneBarX * (1 - that.barPadding); // Ha csak 1 diagramelem van, az ilyen széles.

    var dataMax = d3.max(dataArray, function (d) {
        return d.maxValues;
    });
    var dataMin = d3.min(dataArray, function (d) {
        return d.minValues;
    });

    // Új skálák beállítása.
    that.xScale.domain([0, dataArray.length]);
    that.setYScale([dataMin, dataMax]);

    var elementWidth = that.xScale(1 - that.barPadding); // Az új elemek végső szélessége.

    // Második végigfutás: a kirajzoláshoz szükséges értékek meghatározása.
    var lineArray = [];
    var lines = dimYArray.length;

    // Kamu 0. elem berakása, hogy a vonal a széléig legyen kihúzva.
    for (var j = 0; j < lines; j++) {
        var line = [];
        line.number = dimYArray[j].index;
        line.idY = dimYArray[j].id;
        line.push({id: -99, isFake: true, number: j, idY: line.idY});
        lineArray.push(line);
    }

    // A valódi elemek berakása.
    for (var i = 0, iMax = dataArray.length; i < iMax; i++) {
        var Xelement = dataArray[i];

        //var oldElement = (oldPreparedData !== undefined) ? global.getFromArrayByProperty(oldPreparedData.dataArray, 'id', Xelement.id) : undefined;

        // Az új megjelenési koordináták beállítása.
        Xelement.x = that.xScale(i + that.barPadding / 2);
        Xelement.width = elementWidth;

        // A régi x koordináták beállítása: innen fog kinyílni az animáció.
        if (drill.dim === that.dimXToShow && drill.direction === -1 && openFromXElement) { // Ha x mentén lefúrás van.
            Xelement.oldX = oldX;
            Xelement.oldWidth = (openFromXElement.width / iMax);
            oldX = oldX + Xelement.oldWidth;
        } else if (drill.dim === that.dimXToShow && drill.direction === 1) { // Ha x mentén kifúrás van.
            Xelement.oldX = (i - openToXElementIndex + that.barPadding / 2) * onlyOneBarX;
            Xelement.oldWidth = onlyOneBarWidth;
        } else { // Különben.
            Xelement.oldX = Xelement.x;
            Xelement.oldWidth = Xelement.width;
        }

        for (var j = 0, jMax = Xelement.values.length; j < jMax; j++) {
            var val = Xelement.values[j];
            var lineElement = {};
            lineElement.number = val.index;
            lineElement.id = Xelement.id;
            lineElement.idY = lineArray[val.index].idY;
            lineElement.uniqueId = val.dimYUniqueId + "S" + levelX + "L" + Xelement.id;
            lineElement.name = val.dimYName.trim(); // TODO: ??
            lineElement.value = val.value;
            lineElement.x = that.xScale(i + 0.5);
            lineElement.y = that.yScale(lineElement.value);
            lineElement.tooltip = val.tooltip;
            lineArray[val.index].push(lineElement);
        }
    }

    // Kamu utolsó elem berakása, hogy a vonal a széléig legyen kihúzva.
    for (var j = 0; j < lines; j++) {
        lineArray[j].push({id: -999, isFake: true, number: j, idY: line.idY});
    }

    // A két kamu végpont koordinátáinak kiszámolása.
    for (var j = 0; j < lines; j++) {
        var line = lineArray[j];
        var realPoints = line.length - 2;
        line[0].x = (realPoints > 1) ? that.extrapolate("x", line[1], line[2]) : 0;
        line[0].y = (realPoints > 1) ? that.extrapolate("y", line[1], line[2]) : line[1].y;
        line[realPoints + 1].x = (realPoints > 1) ? that.extrapolate("x", line[realPoints], line[realPoints - 1]) : that.width;
        line[realPoints + 1].y = (realPoints > 1) ? that.extrapolate("y", line[realPoints], line[realPoints - 1]) : line[realPoints - 1].y;
    }

    // Régi koordináták kiszámolása
    var openFromXIndex = (drill.dim === that.dimXToShow && drill.direction === -1 && openFromXElement) ? openFromXElement.index + 1 : undefined;
    for (var j = 0; j < lines; j++) {
        line = lineArray[j];

        if (drill.dim === that.dimXToShow && that.dimXToShow === that.dimYToShow) { // Ha az X és Y dimenzióban ugyanaz van, és amentén fúrunk
            for (var point = 0, pointMax = line.length; point < pointMax; point++) {

                line[point].oldX = line[point].x;
                line[point].oldY = line[point].y;
            }
        } else if (drill.dim === that.dimXToShow) { // Ha az X mentén történt fúrás

            var oldLineArray = (oldPreparedData) ? oldPreparedData.lineArray[j] : undefined;
            var oldAvg = (oldPreparedData) ? d3.mean(oldLineArray, function (d) {
                return (d.id < -10) ? undefined : d.y;
            }) : that.heiht;
            for (var point = 0, pointMax = line.length; point < pointMax; point++) {
                if (drill.dim === that.dimXToShow && drill.direction === -1 && openFromXIndex) { // Ha bezoomolás van
                    line[point].oldX = that.interpolate("x", oldLineArray[openFromXIndex - 1], oldLineArray[openFromXIndex], oldLineArray[openFromXIndex + 1], point, pointMax - 1) || 0;
                    line[point].oldY = that.interpolate("y", oldLineArray[openFromXIndex - 1], oldLineArray[openFromXIndex], oldLineArray[openFromXIndex + 1], point, pointMax - 1) || 0;
                } else if (drill.dim === that.dimXToShow && drill.direction === 1) { // Ha kizoomolás van
                    line[point].oldX = ((point - 0.5 - openToXElementIndex) * onlyOneBarX) || 0;
                    line[point].oldY = oldAvg || 0;
                } else { // Szinten maradás esetén.
                    if (oldLineArray) { // Ha van előző adat.
                        var idx = line[point].id;
                        var oldElement = global.getFromArrayByProperty(oldLineArray, 'id', idx) || 0;
                        line[point].oldX = ((oldElement) ? oldElement.x : that.xScale(point - 0.5)) || 0;
                        line[point].oldY = ((oldElement) ? oldElement.y : that.height) || 0;
                    } else { // Ha minden szűz.
                        line[point].oldX = ((point === 0) ? 0 : (point === pointMax - 1) ? that.width : that.xScale(point - 0.5)) || 0;
                        line[point].oldY = that.height || 0;
                    }
                }
            }
        } else if (drill.dim === that.dimYToShow && drill.direction === -1) { // Ha az Y mentén történt lefúrás                        
            var oldLine = (oldPreparedData) ? global.getFromArrayByProperty(oldPreparedData.lineArray, 'idY', drill.toId) : undefined;
            for (var point = 0, pointMax = line.length; point < pointMax; point++) {
                line[point].oldX = (oldLine) ? oldLine[point].x : line[point].x;
                line[point].oldY = (oldLine) ? oldLine[point].y : 100;
            }
        } else if (drill.dim === that.dimYToShow && drill.direction === 1) { // Ha az Y mentén történt felfúrás                        
            for (var point = 0, pointMax = line.length; point < pointMax; point++) {
                line[point].oldX = line[point].x;
                line[point].oldY = (oldPreparedData && oldPreparedData.lineArray[0][point]) ? oldPreparedData.lineArray[0][point].y : 0;
            }
        } else { // Különben (kezdés, vagy nem kijelzett dimenzió mentén fúrás)
            for (var point = 0, pointMax = line.length; point < pointMax; point++) {
                var oldLineArray = (oldPreparedData) ? oldPreparedData.lineArray[j] : undefined;
                line[point].oldX = (oldLineArray && oldLineArray[point]) ? oldLineArray[point].x : line[point].x;
                line[point].oldY = (oldLineArray && oldLineArray[point]) ? oldLineArray[point].y : line[point].y;
            }
        }
    }

    // Az y dimenzió mentén a jelkulcstömb pozíciókkal való kiegészítése.
    dimYArray.sort(that.simpleCmp);
    var openFromLegendElement = (drill.dim === that.dimYToShow && drill.direction === -1) ? global.getFromArrayByProperty(oldPreparedData.dimYArray, 'id', drill.toId) : null;
    var openToLegendIndex = (drill.dim === that.dimYToShow && drill.direction === 1) ? global.positionInArrayByProperty(dimYArray, 'id', drill.fromId) : null;
    var l_width = that.legendWidth / dimYArray.length;
    for (var i = 0, realPoints = dimYArray.length; i < realPoints; i++) {
        var yElement = dimYArray[i];
        yElement.x = i * l_width;
        yElement.width = l_width;
        if (drill.dim === that.dimYToShow && drill.direction === -1) { // Ha Y mentén való lefúrás történt.
            yElement.oldX = openFromLegendElement.x + i * openFromLegendElement.width / realPoints;
            yElement.oldWidth = openFromLegendElement.width / realPoints;
            yElement.startOpacity = 1;
        } else if (drill.dim === that.dimYToShow && drill.direction === 1) { // Ha Y mentén való felfúrás történt.
            yElement.oldX = (i - openToLegendIndex) * that.legendWidth;
            yElement.oldWidth = that.legendWidth;
            yElement.startOpacity = (i === openToLegendIndex) ? 1 : 0;
        } else if (drill.dim === that.dimXToShow && drill.direction === -1) { // Ha X mentén való lefúrás történt.
            yElement.oldX = yElement.x;
            yElement.oldWidth = yElement.width;
            yElement.startOpacity = 0;
        } else if (drill.dim === that.dimXToShow && drill.direction === 1) { // Ha X mentén való felfúrás történt.
            yElement.oldX = yElement.x;
            yElement.oldWidth = yElement.width;
            yElement.startOpacity = 0;
        } else { // Különben.
            yElement.oldX = yElement.x;
            yElement.oldWidth = yElement.width;
            yElement.startOpacity = 0;
        }
    }

    return {dataArray: dataArray, dimYArray: dimYArray, lineArray: lineArray};
};

/**
 * Új adat megérkeztekor levezényli a panel frissítését.
 * 
 * @param {Object} data Az új adat.
 * @param {Object} drill Az épp végrehajtásra kerülő fúrás.
 * @returns {undefined}
 */
panel_line2d.prototype.update = function (data, drill) {
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
            that.drawLines(that.preparedData, trans, (drill.dim !== -1));
            that.drawLegend(that.preparedData, trans);
        }
    }
    var titleMeta = that.localMeta.indicators[that.valToShow];
    that.titleBox.update(that.valToShow, titleMeta.caption, titleMeta.value.unitPlural, titleMeta.fraction.unitPlural, that.valFraction, tweenDuration);
};

/**
 * Kirajzolja és helyére animálja a vonaldiagramokat.
 * 
 * @param {Object} preparedData Az ábrázoláshoz előkészített adat.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @param {Boolean} isClearRequired Le kell-e törölni az előző vonalakat?
 * @returns {undefined}
 */
panel_line2d.prototype.drawLines = function (preparedData, trans, isClearRequired) {
    var that = this;

    // Ha kell, letöröljük a meglevő vonalakat.
    if (isClearRequired) {
        that.gLines.selectAll(".lineChart").remove();
    }

    // Vonalak, és az adat hozzájukcsapása.
    var line = this.gLines.selectAll(".lineChart")
            .data(preparedData.lineArray);

    // Eltűnő elemek levevése.
    line.exit()
            .classed("darkenable", false)
            .on("click", null)
            .transition(trans)
            .attr("opacity", 0)
            .remove();

    // Új vonalelemek kirajzolása, és a régiekkel való összeöntése.
    line = line.enter().insert("svg:path", ".lineSymbolGroup")
            .attr("d", that.oldLineBarGenerator)
            .attr("stroke", function (d, i) {
                return global.color(d.idY);
            })
            .merge(line);

    // A maradó vonalakt jó helyre animáljuk, megjelenítjük.
    line.transition(trans)
            .attr("class", function (d, i) {
                return "noEvents lineChart controlled controlled" + d.number;
            })
            .attr("d", that.lineBarGenerator)
            .attr("stroke", function (d, i) {
                return global.color(d.idY);
            });

    // Egy vonalhoz tartozó összes szimbólum tartója, és az adatok hozzátársítása.
    var lineSymbolGroups = this.gLines.selectAll(".lineSymbolGroup")
            .data(preparedData.lineArray);

    // Eltűnő szimbólumtartók levevése.
    // TODO: nem okoz memory leaket a click függvény miatt?
    lineSymbolGroups.exit()
            .classed("darkenable", false)
            .on("click", null)
            //.transition(trans)
            //.attr("opacity", 0)
            .remove();

    // Belépő szimbólumtartók létrehozása, a régiekkel való összeöntése.
    lineSymbolGroups = lineSymbolGroups.enter().append("svg:g").merge(lineSymbolGroups);

    // Összes szimbólumtartó osztályának beállítása.
    lineSymbolGroups.attr("class", function (d, i) {
        return "lineSymbolGroup controlled controlled" + d.number;
    });

    // Egy szimbólumelem tartója; ebbe kerül a szimbólum setét háttere, és maga a szimbólum.
    var lineSymbolHolder = lineSymbolGroups.selectAll(".lineSymbolHolder")
            .data(function (d) {
                return d;
            }, function (d) {
                return d.uniqueId;
            });

    // Eltűnő elemek levevése.
    lineSymbolHolder.exit()
            .classed("darkenable", false)
            .on("click", null)
            .transition(trans)
            .attr("opacity", 0)
            .remove();

    // Megmaradók alakját és színét jóvá alakítjuk. A hátteret és a szimbólumot is.
    lineSymbolHolder.select(".shadow")
            .attr("d", function (d) {
                return d3.symbol().type(d3.symbols[d.number % 6]).size(that.symbolSize_background)();
            });
    lineSymbolHolder.select(".lineSymbol:not(.shadow)")
            .attr("d", function (d) {
                return d3.symbol().type(d3.symbols[d.number % 6]).size(that.symbolSize)();
            })
            .transition(trans)
            .attr("fill", function (d) {
                return global.color(d.idY);
            });

    // Az új szimbólumok tartócsoportjának létrehozása.
    var lineSymbolHolder_new = lineSymbolHolder.enter().append("svg:g")
            .attr("class", "lineSymbolHolder listener")
            .attr("transform", function (d) {
                return "translate(" + d.oldX + "," + d.oldY + ")";
            })
            .on("click", function (d) {
                if (!d.isFake) {
                    that.drill(that.dimX, d);
                }
            });

    // Az új szimbólum sötét háttere.
    lineSymbolHolder_new.append("svg:path")
            .attr("class", "lineSymbol shadow")
            .attr("d", function (d) {
                return d3.symbol().type(d3.symbols[d.number % 6]).size(that.symbolSize_background)();
            });

    // Az új szimbólum maga.
    lineSymbolHolder_new.append("svg:path")
            .attr("class", "lineSymbol")
            .attr("d", function (d) {
                return d3.symbol().type(d3.symbols[d.number % 6]).size(that.symbolSize)();
            })
            .attr("fill", function (d) {
                return global.color(d.idY);
            });

    // Új és maradó elemek összeöntése.
    lineSymbolHolder = lineSymbolHolder_new.merge(lineSymbolHolder);

    // Maradó szimbólumok helyre mozgatása.
    lineSymbolHolder.transition(trans)
            .attr("opacity", function (d) {
                return (!d.isFake && that.isSymbolsRequired) ? 1 : 0;
            })
            .attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")";
            })
            .on("end", function (d) {
                d3.select(this).select(".lineSymbol:not(.shadow)").classed("darkenable", !d.isFake);
            });
};

/**
 * Jelkulcs (ami egyben az Y dimenziók vezérlője) felrajzolása.
 * 
 * @param {Object} preparedData Az ábrázoláshoz előkészített adat.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_line2d.prototype.drawLegend = function (preparedData, trans) {
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
    var legend_new = legend.enter().insert("svg:g", ".line_group")
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
            .attr("opacity", function (d) {
                return d.startOpacity;
            });

    // Szöveg beleírása a tartókba.
    legend_new.append("svg:text")
            .attr("class", "legend noEvents")
            .attr("x", 0)
            .attr("y", global.legendHeight / 2)
            .attr("dy", "0.35em")
            .attr("fill", function (d) {
                return global.readableColor(global.color(d.id));
            })
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
panel_line2d.prototype.drawAxes = function (preparedData, trans) {
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

    // Vízszintes tengely elmozgatása (negatív értékek kijelzésekor nem alul kell lennie)
    that.gAxisX.select("line").transition(trans).attrs({
        x1: 0,
        y1: that.yScale(0),
        x2: that.width,
        y2: that.yScale(0)});

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
            .attr("fill", that.xAxisTextColor)
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
panel_line2d.prototype.drill = function (dim, d) {
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
panel_line2d.prototype.doChangeValue = function (panelId, value, ratio) {
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
panel_line2d.prototype.doChangeDimension = function (panelId, newDimId, dimToChange) {
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
