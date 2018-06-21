/* global Panel, d3 */

'use strict';

var piechartpanel = panel_pie;
/**
 * A tortadiagram konstruktora.
 * 
 * @param {Object} init Inicializáló objektum.
 * @returns {panel_pie} A megkonstruált panel.
 */
function panel_pie(init) {
    var that = this;

    this.constructorName = "panel_pie";

    // Inicializáló objektum beolvasása, feltöltése default értékekkel.
    this.defaultInit = {group: 0, position: undefined, dim: 0, val: 0, ratio: false, mag: 1, fromMag: 1};
    this.actualInit = global.combineObjects(that.defaultInit, init);

    Panel.call(that, that.actualInit, global.mediators[that.actualInit.group], false, 0, 0); // A Panel konstruktorának meghívása.

    this.valMultiplier = 1;						// A mutatott érték szorzója.
    this.dimToShow = that.actualInit.dim;		// A mutatott dimenzió.
    this.valToShow = that.actualInit.val;		// Az ennyiedik mutatót mutatja.
    this.valFraction = that.actualInit.ratio;	// Hányadost mutasson, vagy abszolútértéket?
    this.preparedData = [];						// Az ábrázolásra kerülő, feldolgozott adat.
    this.maxEntries = global.maxEntriesIn1D;    // A panel által maximálisan megjeleníthető adatok száma.
    
    this.radius = 0.465 * (global.panelHeight * that.magLevel - global.panelTitleHeight - 4 * global.legendOffsetY - global.legendHeight / 2); // A torta külső átmérője.
    this.innerRadius = that.radius / 3; // A torta belső átmérője.
    this.textRadius = that.radius + 14; // A szövegek körének átmérője.
    this.labelMinValue = 0.3 / that.magLevel; // Ekkora részesedés alatt semmiképp sincs kiírva a label. Százalék.

    // A tortaelmeket létrehozó függvény
    this.arc = d3.arc()
            .startAngle(function(d) {
                return d.startAngle;
            })
            .endAngle(function(d) {
                return d.endAngle;
            })
            .outerRadius(that.radius)
            .innerRadius(that.innerRadius);

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

    // A tortaszeleteket tartalmazó réteg.
    this.arc_group = that.svg.insert("svg:g", ".title_group")
            .attr("class", "arc")
            .attr("transform", "translate(" + (that.margin.left + that.width / 2) + "," + (that.margin.top + that.height / 2) + ")");

    // A szövegeket tartalmazó réteg.
    this.label_group = that.svg.insert("svg:g", ".title_group")
            .attr("class", "label_group noEvents")
            .attr("transform", "translate(" + (that.margin.left + that.width / 2) + "," + (that.margin.top + that.height / 2) + ")");

    // Feliratkozás a mediátorokra.
    var med;
    med = that.mediator.subscribe("changeValue", function(id, val, ratio) {
        that.doChangeValue(id, val, ratio);
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
    panel_pie.prototype = global.subclassOf(Panel); // A Panel metódusainak átvétele.
    panel_pie.prototype.requiredDifferenceForX = 20; // A szövegek közötti minimális függőleges távolság.
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
panel_pie.prototype.valueToShow = function(d) {
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
 * @param {Object} d Az elem.
 * @returns {String} A megjelenítendő tooltip.
 */
panel_pie.prototype.getTooltip = function(d) {
    var that = this;
    var unitProperty = (d.value === 1) ? "unit" : "unitPlural";
    return that.createTooltip(
            [{
                    name: that.localMeta.dimensions[that.dimToShow].description,
                    value: (d.name) ? d.name : _("Nincs adat")
                }],
            [{
                    name: that.localMeta.indicators[that.valToShow].description,
                    value: d.originalValue,
                    dimension: ((that.valFraction) ? that.localMeta.indicators[that.valToShow].fraction[unitProperty] : that.localMeta.indicators[that.valToShow].value[unitProperty])
                }]
            );
};

/**
 * A tortaszelet animációját leíró függvényt meghatározó függvény.
 * 
 * @param {Object} d A kérdéses tortadarab.
 * @returns {Function} A tortadarab animációját leíró függvény.
 */
panel_pie.prototype.pieTween = function(d) {
    var that = this;
    var int = d3.interpolate({startAngle: d.oldStartAngle - 0.0001, endAngle: d.oldEndAngle + 0.0001}, {startAngle: d.startAngle - 0.0001, endAngle: d.endAngle + 0.0001});
    return function(t) {
        var b = int(t);
        return that.arc(b);
    };
};

/**
 * A magyarázószöveg animációját leíró függvényt meghatározó függvény.
 * 
 * @param {Object} d A tortadarab, amihez a szöveg tartozik.
 * @returns {Function} A szöveg animációját leíró függvény.
 */
panel_pie.prototype.textTween = function(d) {
    var that = this;
    var a = (d.oldStartAngle + d.oldEndAngle - Math.PI) / 2;
    var b = (d.startAngle + d.endAngle - Math.PI) / 2;
    var int = d3.interpolateNumber(a, b);
    return function(t) {
        var val = int(t);
        return "translate(" + (Math.cos(val) * that.textRadius) + "," + (Math.sin(val) * that.textRadius) + ")";
    };
};

/**
 * A mutató pöcök animációját leíró függvényt meghatározó függvény.
 * 
 * @param {Object} d A tortadarab, amihez a pöcök tartozik.
 * @returns {Function} A pöcök animációját leíró függvény.
 */
panel_pie.prototype.tickTween = function(d) {
    var a = (d.oldStartAngle + d.oldEndAngle) / 2;
    var b = (d.startAngle + d.endAngle) / 2;
    var int = d3.interpolateNumber(a, b);
    return function(t) {
        var val = int(t);
        return "rotate(" + val * (180 / Math.PI) + ")";
    };
};

//////////////////////////////////////////////////
// Rajzolási folyamat függvényei
//////////////////////////////////////////////////

/**
 * A klikkeléskor azonnal végrehajtandó animáció.
 * 
 * @param {Object} drill A lefúrást leíró objektum: {dim: a fúrás dimenziója, direction: iránya [+1 fel, -1 le], fromId: az előzőleg kijelzett elem azonosítója, toId: az új elem azonosítója}
 * @returns {undefined}
 */
panel_pie.prototype.preUpdate = function(drill) {
    var that = this;

    if (drill.direction === -1) { // Lefúrás esetén.

        // Mindent, kivéve amibe fúrunk, letörlünk.
        that.arc_group.selectAll("path").filter(function(d) {
            return (d.id !== drill.toId);
        })
                .on("click", null)
                .remove();

        that.label_group.selectAll("line, .gPieTick").filter(function(d) {
            return (d.id !== drill.toId);
        }).remove();

    } else if (drill.direction === 1) { // Felfúrás esetén

        // Mindent letörlünk.
        that.arc_group.selectAll("path")
                .on("click", null)
                .remove();

        that.label_group.selectAll("line, .gPieTick").remove();

        // Kirajzolunk egy teljes kört a szülő színével.
        that.arc_group.selectAll("path").data([1], false)
                .enter().append("svg:path")
                .attr("class", "bar bordered darkenable")
                .attr("fill", global.color(drill.fromId))
                .attr("d", that.arc({startAngle: 0, endAngle: 2 * Math.PI}));
    }
};

/**
 * Az új adat előkészítése. Meghatározza hogy mit, honnan kinyílva kell kirajzolni.
 * 
 * @param {Array} oldPieData Az adat megkapása előtti adatok.
 * @param {Array} newDataRows Az új adatsorokat tartalmazó tömb.
 * @param {Object} drill Az épp végrehajtandó fúrás.
 * @returns {Array} Az új megjelenési tortaadatok.
 */
panel_pie.prototype.prepareData = function(oldPieData, newDataRows, drill) {
    var that = this;
    var level = (global.baseLevels[that.panelSide])[this.dimToShow].length;

    newDataRows.sort(that.cmp); // Adatok névsorba rendezése.

    var newPieData = d3.pie()
            .sort(that.cmp)	// Használjuk a sorbarendezést [null: nincs rendezés, egész kihagyása: érték szerinti]
            .value(function(d) {
                return that.valueToShow(d).value;
            })(newDataRows);

    var total = 0; // A mutatott összérték meghatározása.
    for (var i = 0, iMax = newDataRows.length; i < iMax; i++) {
        total += that.valueToShow(newDataRows[i]).value;
    }

    // Kidobjuk a nempozitív elemeket.
    newPieData.filter(function(d) {
        return d.value > 0;
    });

    var prevX = 0, prevY = -9999; // Az előző címke koordinátái; annak eldöntéséhez kell, hogy kifér-e az új címke.

    var openFromElement = (drill.direction === -1 && oldPieData !== undefined) ? global.getFromArrayByProperty(oldPieData, 'id', drill.toId) : null; // Ebből a régi elemből kell kinyitni mindent.
    var oldElementArc = (openFromElement) ? openFromElement.endAngle - openFromElement.startAngle : 0;

    // Bezoomolás esetén előkészülünk a rányíló animáció kezdőszögeinek meghatározására.
    var oldStartAngle = (openFromElement) ? openFromElement.startAngle : 0;
    var oldEndAngle = 0;

    var parentFound = false;

    for (var i = 0, iMax = newPieData.length; i < iMax; i++) {
        var element = newPieData[i];
        var dataRow = element.data;
        var val = that.valueToShow(dataRow);
        element.id = dataRow.dims[0].id;
        element.uniqueId = level + "L" + element.id;
        element.name = dataRow.dims[0].name.trim();
        element.value = val.value;
        element.originalValue = val.originalValue;
        element.percentage = ((element.value / total) * 100).toFixed(1);
        element.tooltip = that.getTooltip(element);

        // Eldöntjük, hogy ki kell-e írni a címkét.
        var b = (element.startAngle + element.endAngle - Math.PI) / 2;
        var x = Math.cos(b) * (that.textRadius);
        var y = Math.sin(b) * (that.textRadius);
        if ((((prevX < 0) !== (x < 0)) || Math.abs(prevY - y) > that.requiredDifferenceForX) && element.percentage > that.labelMinValue) {
            prevX = x;
            prevY = y;
            element.isTickRequired = true;
        } else {
            element.isTickRequired = false;
        }

        if (drill.direction === -1) { // Ha bezoomolás van
            element.oldStartAngle = oldStartAngle;
            element.oldEndAngle = oldStartAngle + oldElementArc * element.value / total;
            oldStartAngle = element.oldEndAngle;
        } else if (drill.direction === 1) { // Ha kizoomolás van
            if (!parentFound) {
                element.oldStartAngle = 0;
                element.oldEndAngle = 0;
            } else {
                element.oldStartAngle = 2 * Math.PI;
                element.oldEndAngle = 2 * Math.PI;
            }
            if (element.id === drill.fromId) {
                element.oldEndAngle = 2 * Math.PI;
                parentFound = true;
            }
        } else { // Ha azonos szintű változtatás van
            var oldElement = (oldPieData !== undefined) ? global.getFromArrayByProperty(oldPieData, 'id', element.id) : undefined;
            if (oldElement) {
                oldStartAngle = oldElement.startAngle;
                oldEndAngle = oldElement.endAngle;
            } else {
                oldStartAngle = oldEndAngle;
            }
            element.oldStartAngle = oldStartAngle;
            element.oldEndAngle = oldEndAngle;
        }
    }

    return newPieData;
};

/**
 * Új adat megérkeztekor levezényli a panel frissítését.
 * 
 * @param {Object} data Az új adat.
 * @param {Object} drill Az épp végrehajzásra kerülő fúrás.
 * @returns {undefined}
 */
panel_pie.prototype.update = function(data, drill) {
    var that = this;
    that.data = data || that.data;
    drill = drill || {dim: -1, direction: 0};

    if (that.valFraction && that.meta.indicators[that.valToShow].fraction.hide) {
        that.valFraction = false;
    }
    if (!that.valFraction && that.meta.indicators[that.valToShow].value.hide) {
        that.valFraction = true;
    }
    that.valMultiplier = (isNaN(parseFloat(that.meta.indicators[that.valToShow].fraction.multiplier))) ? 1 : parseFloat(that.meta.indicators[that.valToShow].fraction.multiplier);
    var tweenDuration = (drill.duration === undefined) ? global.getAnimDuration(-1, that.panelId) : drill.duration;

    // Ha túl sok értéket kéne megjeleníteni, pánik
    if (that.data.rows.length > that.maxEntries) {
        that.panic(true, _("<html>A panel nem képes ") + that.data.rows.length + _(" értéket megjeleníteni.<br />A maximálisan megjeleníthető értékek száma ") + that.maxEntries + _(".</html>"));
        that.preparedData = undefined;
    } else {
        that.preparedData = that.prepareData(that.preparedData, that.data.rows, drill);
        if (that.preparedData.length > 0 && !isNaN(that.preparedData[0].percentage)) {
            that.panic(false);
            var trans = d3.transition().duration(tweenDuration);
            that.drawPie(that.preparedData, trans);
            that.drawLabels(that.preparedData, trans);
        } else {
            that.panic(true, _("<html>A változó értéke<br />minden dimenzióban 0.</html>"));
            that.preparedData = [];
        }
    }
    var titleMeta = that.localMeta.indicators[that.valToShow];
    that.titleBox.update(that.valToShow, titleMeta.caption, titleMeta.value.unitPlural, titleMeta.fraction.unitPlural, that.valFraction, tweenDuration);
};

/**
 * A körcikkek kirajzolása, animálása.
 * 
 * @param {Array} preparedData A kirajzolandó körcikkekekt tartalmazó adattömb.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_pie.prototype.drawPie = function(preparedData, trans) {
    var that = this;

    // A körcikkek adathoz társítása. 
    var paths = that.arc_group.selectAll("path").data(preparedData, function(d) {
        return d.uniqueId;
    });

    // Kilépő körcikkek törlése.
    paths.exit()
            .on("click", null)
            .remove();

    // Új körcikkek kirajzolása.
    paths = paths.enter().append("svg:path")
            .attr("class", "bar bordered darkenable listener")
            .attr("fill", function(d) {
                return global.color(d.id);
            })
            .on("click", function(d) {
                that.drill(d);
            })
            .merge(paths)
            .transition(trans)
            .attrTween("d", that.pieTween.bind(that));
};

/**
 * A vonások és feliratok kirajzolása, animálása.
 * 
 * @param {Array} preparedData A körcikkek adatait tartalmazó adattömb.
 * @param {Object} trans Az animáció objektum, amelyhez csatlakozni fog.
 * @returns {undefined}
 */
panel_pie.prototype.drawLabels = function(preparedData, trans) {
    var that = this;

    // A vonások kirajzolása, animálása.
    var lines = that.label_group.selectAll("line").data(preparedData, function(d) {
        return d.uniqueId;
    });

    lines.exit().remove();

    lines.enter().append("svg:line")
            .attr("class", "pieTicks")
            .attr("x1", 0)
            .attr("x2", 0)
            .attr("y1", -that.radius - 3)
            .attr("y2", -that.radius - 8)
            .attr("transform", function(d) {
                return "rotate(" + (d.startAngle + d.endAngle) / 2 * (180 / Math.PI) + ")";
            })
            .merge(lines)
            .transition(trans)
            .attrTween("transform", that.tickTween)
            .style("opacity", function(d) {
                return (d.isTickRequired) ? 1 : 0;
            });

    // A szövegelemek tartója.
    var gLabelHolder = that.label_group.selectAll("g").data(that.preparedData, function(d) {
        return d.uniqueId;
    });

    // Kilépők levevése.
    gLabelHolder.exit().remove();

    var newGLabelHolder = gLabelHolder.enter().append("svg:g")
            .attr("class", "gPieTick")
            .attr("transform", function(d) {
                return "translate(" + Math.cos(((d.startAngle + d.endAngle - Math.PI) / 2)) * that.textRadius + "," + Math.sin((d.startAngle + d.endAngle - Math.PI) / 2) * that.textRadius + ")";
            });

    // Újonnan belépő százalék-értékek.
    newGLabelHolder.append("svg:text")
            .attr("class", "value pieTickValue");

    // Újonnan belépő dimenziócímkék.
    newGLabelHolder.append("svg:text")
            .attr("class", "units pieTickUnit");

    // Maradók és új elemek összeöntése.
    gLabelHolder = newGLabelHolder.merge(gLabelHolder);

    // Százalékok kitöltése.
    gLabelHolder.select("text.pieTickValue")
            .attr("dy", function(d) {
                return (global.valueInRange((d.startAngle + d.endAngle) / 2, Math.PI / 2, Math.PI * 1.5)) ? 5 : -7;
            })
            .attr("text-anchor", function(d) {
                return ((d.startAngle + d.endAngle) / 2.001 < Math.PI) ? "beginning" : "end";
            })
            .text(function(d) {
                return d.percentage + "%";
            });

    // Dimenziónevek kitöltése.
    gLabelHolder.select("text.pieTickUnit")
            .attr("dy", function(d) {
                return (global.valueInRange((d.startAngle + d.endAngle) / 2, Math.PI / 2, Math.PI * 1.5)) ? 17 : 5;
            })
            .attr("text-anchor", function(d) {
                return ((d.startAngle + d.endAngle) / 2.001 < Math.PI) ? "beginning" : "end";
            })
            .text(function(d) {
                return d.name;
            });


    // Maradók helyre animálása.
    gLabelHolder.transition(trans)
            .attrTween("transform", that.textTween.bind(that))
            .style("opacity", function(d) {
                return (d.isTickRequired) ? 1 : 0;
            });

    // Max. 145 pixel hosszú lehet egy szövegdoboz.
    global.cleverCompress(that.label_group.selectAll(".pieTickUnit"), 140, 1, 1.5, false);

};

//////////////////////////////////////////////////
// // Irányítást végző függvények
//////////////////////////////////////////////////

/**
 * Az aktuális dimenzióban történő le vagy felfúrást kezdeményező függvény.
 * 
 * @param {Object} d Lefúrás esetén a lefúrás céleleme. Ha undefined, akkor felfúrásról van szó.
 * @returns {undefined}
 */
panel_pie.prototype.drill = function(d) {
    var that = this;
    global.tooltip.kill();
    var drill = {
        dim: that.dimToShow,
        direction: (d === undefined) ? 1 : -1,
        toId: (d === undefined) ? undefined : d.id,
        toName: (d === undefined) ? undefined : d.name
    };
    that.mediator.publish("drill", drill);
};

/**
 * A mutató- és hányadosválasztást végrehajtó függvény.
 * 
 * @param {String} panelId A váltást végrehajtó panel azonosítója. Akkor vált, ha az övé, vagy ha undefined.
 * @param {Integer} value Az érték, amire váltani kell. Ha -1 akkor a következőre vált, ha undefined, nem vált.
 * @param {boolean} ratio Hányadost mutasson-e. Ha -1 akkor a másikra ugrik, ha undefined, nem vált.
 * @returns {undefined}
 */
panel_pie.prototype.doChangeValue = function(panelId, value, ratio) {
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
 * @returns {undefined}
 */
panel_pie.prototype.doChangeDimension = function(panelId, newDimId) {
    var that = this;
    if (panelId === that.panelId) {
        that.dimToShow = newDimId;
        that.actualInit.dim = that.dimToShow;
        that.mediator.publish("register", that, that.panelId, [that.dimToShow], that.preUpdate, that.update, that.getConfig);
        global.tooltip.kill();
        this.mediator.publish("drill", {dim: -1, direction: 0, toId: undefined});
    }
};