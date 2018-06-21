/* global d3 */

'use strict';

/**
 * Az összes panel (kivéve a fejléc) közös őse.
 * 
 * @param {Object} panelInitString A panelt inicializáló objektum.
 * @param {Object} mediator A panel számára rendelkezésre álló mediátor.
 * @param {Boolean} isLegendRequired Kell-e alul helyet kihagyni a jelkulcsnak?
 * @param {Number} leftOffset Bal oldali üresen hagyandó terület (margó) pixelben.
 * @param {Number} rightOffset Jobb oldali üresen hagyandó terület (margó) pixelben.
 * @param {Number} topOffset Felső üresen hagyandó terület (margó) pixelben.
 * @param {Number} bottomOffset Alsó üresen hagyandó terület (margó) pixelben.
 * @returns {Panel} Az elkészült panel.
 */
function Panel(panelInitString, mediator, isLegendRequired, leftOffset, rightOffset, topOffset, bottomOffset) {
    var that = this;

    leftOffset = leftOffset || 0;
    rightOffset = rightOffset || 0;
    topOffset = topOffset || 0;
    bottomOffset = bottomOffset || 0;

    this.panelInitString = panelInitString;

    this.panelSide = panelInitString.group || 0;
    this.isLegendRequired = isLegendRequired;
    this.meta = global.facts[that.panelSide].reportMeta;
    this.localMeta = global.facts[that.panelSide].getLocalMeta();
    this.containerId = "#container" + that.panelSide;
    this.divPosition = (panelInitString.position !== undefined) ? panelInitString.position : d3.selectAll(that.containerId + " .panel.single").nodes().length;
    this.panelId = "#panel" + that.panelSide + "P" + that.divPosition;

    this.mediator = mediator;
    this.data;
    this.dimsToShow = [];

    this.valMultiplier = 1;		// Ennyiszeresét
    this.valFraction = false;	// Hányadost mutasson?
    this.inPanic = false;		// Hibaüzemmódban van a panel?
    this.mediatorIds = [];		// A mediátorok id-jeit tartalmazó tömb.
    this.replaceFunction;
    this.magLevel = panelInitString.mag || 1;          // Nagyítottsági szint.
    this.fromMagLevel = panelInitString.fromMag || 1;          // Ahonnan érkezik a nagyítás.
    this.w = that.w * that.magLevel;
    this.legendWidth = that.w - 2 * global.legendOffsetX;
//    this.legendWidth = that.legendWidth * that.magLevel;
    this.h = that.h * that.magLevel;
    this.legendOffsetX = global.legendOffsetX;// * that.magLevel;
    if (this.magLevel !== 1) {
        this.h = this.h * this.doubleHeightModifier;
    }

    this.margin = {
        top: global.panelTitleHeight + 3 * global.legendOffsetY + topOffset,
        right: global.legendOffsetX + rightOffset,
        bottom: bottomOffset + ((isLegendRequired) ? global.legendHeight + 2 * global.legendOffsetY : global.legendOffsetY + global.legendHeight / 2),
        left: global.legendOffsetX + leftOffset
    };

    this.width = that.w - that.margin.left - that.margin.right;
    this.height = that.h - that.margin.top - that.margin.bottom;

    this.container = d3.select(this.containerId);

    this.panelDiv = that.container.append("html:div")
            .attr("id", that.panelId.substring(1))
            .attr("class", "panel single")
            .classed("magnified", that.magLevel !== 1)
            .styles(global.getStyleForScale(that.fromMagLevel / that.magLevel, 0, 0))
            .style("width", that.w * that.fromMagLevel / that.magLevel + "px")
            .style("height", that.h * that.fromMagLevel / that.magLevel + "px");

    // Kezdő méretező és helyrevivő animáció, ha nagyítani kell, vagy nagyításból visszakicsinyíteni.
    if (that.magLevel !== 1 || that.fromMagLevel !== 1) {
        that.panelDiv.transition().duration(global.selfDuration)
                .styles(global.getStyleForScale(1, 0, 0))
                .style("width", that.w + "px")
                .style("height", that.h + "px")
                .style("left", "0px")
                .style("top", "0px")
                .on("end", function() {
                    that.actualInit.fromMag = 1;
                    d3.select(this)
                            .style("z-index", null);
                });
    }

    this.svg = that.panelDiv.append("svg:svg")
            .attr("width", that.w)
            .attr("height", that.h);

    that.svg.append("svg:rect")
            .attr("class", "backgroundForSave")
            .attr("width", that.w)
            .attr("height", that.h)
            .attr("rx", global.rectRounding);

    this.gLegend = that.svg;

    // Feliratkozás a panelt megölő mediátorra.
    var med = that.mediator.subscribe("killPanel", function(panelId) {
        that.killPanel(panelId);
    });
    that.mediatorIds.push({"channel": "killPanel", "id": med.id});

    // Feliratkozás a nyelvváltó mediátorra.
    med = this.mediator.subscribe("langSwitch", function() {
        that.localMeta = global.facts[that.panelSide].getLocalMeta();
        Panel.prototype.defaultPanicText = _("<html>Nincs megjeleníthető adat.<html>");
        that.langSwitch(global.selfDuration);
    });
    that.mediatorIds.push({"channel": "langSwitch", "id": med.id});

    // Feliratkozás a nagyító mediátorra.
    var med = that.mediator.subscribe("magnifyPanel", function(panelId) {
        that.magnifyPanel(panelId);
    });
    that.mediatorIds.push({"channel": "magnifyPanel", "id": med.id});

    // A nagyító fül
    var rz = that.svg.append("svg:g")
            .attr("class", "listener title_group visibleInPanic magnifyPanelButton")
            .attr("transform", "translate(" + (that.w - 30)  + ", " + (that.h - 30) +")")
            .on('click', function() {
                if (global.panelNumberOnScreen !== 1) {
                    that.mediator.publish("magnifyPanel", that.panelId);
                }
            });

    
    rz.append("svg:g")
            .html('<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#magnify_panel_button"></use>')
    

    // Fejléc.
    this.titleBox = new TitleBox(that.svg, that.panelId, that.mediator, that.magLevel);
    that.titleBox.gContainer
            .classed('listener', true)
            .on('mouseover', function() {
                that.hoverOn(this);
            })
            .on('mouseout', function() {
                that.hoverOff();
            });

    // Panel áthúzásához a segédobjektumok.
    this.dragging = false;
    this.dragStartX;
    this.dragStartY;

    /**
     * Az egérgomb lenyomásakor elkezdi a drag-műveletet.
     * 
     * @returns {undefined}
     */
    var dragStarted = function() {
        var coords = d3.mouse(that.container.nodes()[0]);
        that.dragStartX = coords[0];
        that.dragStartY = coords[1];
        that.panelDiv.classed("dragging", true)
                .style("z-index", 10000);
    };

    /**
     * Megnézi, hogy húzáskor eleget mozgott-e az egér, ha igen, indítja a mozgatást, átpozícionálást.
     * 
     * @returns {undefined}
     */
    var dragging = function() {
        var coords = d3.mouse(that.container.nodes()[0]);
        if (!that.dragging && (coords[0] - that.dragStartX) * (coords[0] - that.dragStartX) + (coords[1] - that.dragStartY) * (coords[1] - that.dragStartY) > that.dragTreshold * that.dragTreshold) {
            that.dragging = true;
        }
        if (that.dragging) {
            that.panelDiv
                    .style("left", ((coords[0] - that.dragStartX) / global.scaleRatio) + "px")
                    .style("top", ((coords[1] - that.dragStartY) / global.scaleRatio) + "px");
            rearrangePanels();
        }
    };

    /**
     * Megnézi, hogy át kell-e helyezni a panelt, és ha igen, megcsinálja.
     * 
     * @returns {undefined}
     */
    var rearrangePanels = function() {
        var panels = d3.selectAll("#container" + that.panelSide + " .panel.single").nodes();
        var selfIndex = global.positionInArrayByProperty(panels, "id", that.panelId.substring(1)); // A húzott panel sorszáma a képernyőn megjelenés sorrendjében.
        var x = $(that.panelId)[0].getBoundingClientRect().left;
        var y = $(that.panelId)[0].getBoundingClientRect().top;
        var flipIndex = -1; // Aminek a helyére húzzuk.
        for (var i = 0, iMax = panels.length; i < iMax; i++) {
            if (i !== selfIndex) {
                var ix = $(panels[i])[0].getBoundingClientRect().left;
                var iy = $(panels[i])[0].getBoundingClientRect().top;
                var dx = Math.abs(x - ix) / global.scaleRatio;
                var dy = Math.abs(y - iy) / global.scaleRatio;
                if (dx < global.panelWidth / 2 && dy < global.panelHeight / 2) {
                    flipIndex = i;
                    break;
                }
            }
        }

        var selfIndexModified = selfIndex;
        var flipIndexModified = flipIndex;
        var isMagnified = !d3.selectAll("#container" + that.panelSide + " .panel.single.magnified").empty();

        // Ha nagyított a 0. panel, akkor módosítjuk az indexeket, mert a nagyított panel 4-et foglal.
        if (isMagnified) {
            selfIndexModified = (selfIndexModified + 1 < global.panelNumberOnScreen) ? selfIndexModified + 1 : selfIndexModified + 3;
            flipIndexModified = (flipIndexModified + 1 < global.panelNumberOnScreen) ? flipIndexModified + 1 : flipIndexModified + 3;
        }

        // Ha van mit cserélni, és egyik érintett se nagyított, akkor cserélünk.
        if (flipIndex > -1 && (!isMagnified || (selfIndex > 0 && flipIndex > 0))) {
            var rowDist = Math.floor(selfIndexModified / global.panelNumberOnScreen) - Math.floor(flipIndexModified / global.panelNumberOnScreen);
            var colDist = (selfIndexModified % global.panelNumberOnScreen) - (flipIndexModified % global.panelNumberOnScreen);
            if (selfIndex > flipIndex) {
                $(that.panelId).insertBefore($(panels[flipIndex]));
            } else {
                $(that.panelId).insertAfter($(panels[flipIndex]));
            }
            that.dragStartX = that.dragStartX - global.panelWidth * global.scaleRatio * colDist;
            that.dragStartY = that.dragStartY - global.panelHeight * global.scaleRatio * rowDist;
            var coords = d3.mouse(that.container.nodes()[0]);
            that.panelDiv
                    .style("left", ((coords[0] - that.dragStartX) / global.scaleRatio) + "px")
                    .style("top", ((coords[1] - that.dragStartY) / global.scaleRatio) + "px");
        }
    };

    /**
     * Az egérgomb felengedésekor mindent visszaállít.
     * 
     * @returns {undefined}
     */
    var dragEnd = function() {
        that.panelDiv.classed("dragging", false)
                .style("z-index", null)
                .style("left", null)
                .style("top", null);
        that.dragging = false;
        global.getConfig2();
    };

    // Az áthelyezhetőség engedélyezése.
    this.drag = d3.drag()
            .on("start", dragStarted)
            .on("drag", dragging)
            .on("end", dragEnd)
            .clickDistance(that.dragTreshold);

    this.svg.call(this.drag);
}

//////////////////////////////////////////////////
// Osztály-konstansok inicializálása.
//////////////////////////////////////////////////

{
    Panel.prototype.w = global.panelWidth;
    Panel.prototype.h = global.panelHeight;
    Panel.prototype.legendOffsetX = global.legendOffsetX;
    Panel.prototype.dragTreshold = 25;      // A paneláthúzáshoz szükséges minimális pixelnyi elhúzás.    
    Panel.prototype.defaultPanicText = _("<html>Nincs megjeleníthető adat.<html>");
    Panel.prototype.doubleMultiplier = 2 + 2 * (global.panelMargin / global.panelWidth); // Nagyítás esetén ennyiszeresére kell nagyítania.
    Panel.prototype.doubleHeightModifier = (2 + 2 * (global.panelMargin / global.panelHeight)) / Panel.prototype.doubleMultiplier; // A függőleges irányú multiplikatív korrekció nagyításkor.
}

/**
 * Beállítja, hogy egy adott elem kurzor hatására elsötétedhessen.
 * 
 * @returns {undefined}
 */
Panel.prototype.classedDarkenable = function() {
    d3.select(this).classed("darkenable", true);
};

/**
 * Az adatsorok névsor szerinti sorbarendezéséhez szükséges névsor-összehasonlító.
 * 
 * @param {Object} a Egy adatelem.
 * @param {Object} b Egy másik adatelem.
 * @returns {Boolean} Az összehasonlítás eredménye.
 */
Panel.prototype.cmp = function(a, b) {
    return a.dims[0].name.localeCompare(b.dims[0].name);
};

/**
 * Megformázza a megadott dimenziókat és értékeket tooltipként.
 * 
 * @param {Array} dims A dimenziók nevét és aktuális értékét tartalmazó tömb.
 * @param {Array} vals A mutatók nevét, értékét, mértékegységét, átlagát tartalmazó tömb.
 * @returns {String} A formázott html.
 */
Panel.prototype.createTooltip = function(dims, vals) {
    var separator = "";
    var html = "<html><h4>";
    for (var d = 0, dMax = dims.length; d < dMax; d++) {
        html = html + separator + dims[d].name;
        if (dims[d].value !== undefined) {
            html += ": <em>" + dims[d].value + "</em>";
        }
        separator = "<br />";
    }
    html = html + "</h4>";
    for (var v = 0, vMax = vals.length; v < vMax; v++) {
        html = html + vals[v].name + ": <em>" + global.cleverRound5(vals[v].value) + "</em> (" + vals[v].dimension + ")";
        if (vals[v].avgValue !== undefined) {
            html = html + _("<em> átlag: ") + global.cleverRound5(vals[v].avgValue) + "</em>";
        }
        html = html + "<br />";
    }
    html = html + "</html>";
    return html;
};

/**
 * Megöli a panel 'listener' osztályú elmeihez rendelt eseményfigyelőket.
 * 
 * @returns {undefined}
 */
Panel.prototype.killListeners = function() {
    this.panelDiv.selectAll(".listener")
            .on("click", null)
            .on("mouseover", null)
            .on("mouseout", null);
};

/**
 * 
 * @param {String} panelId A megölendő panel id-je. (Ha a panelen belülről hívjuk, elhagyható.)
 * @param {Number} duration Az animáció ideje, ms. Ha undefined: a globális animáció idő lesz.
 * @param {Object} fromStyle Az animáció kezdőstílusa. Ha undefined: a pillanatnyi állapot.
 * @param {Object} toStyle Az animáció végzőstílusa. Ha undefined: 0x0-ra kicsinyítés a középpontból.
 * @param {Boolean} dontResize Ha true, akkor nem hívja meg a megöléskor a resize-t.
 * @returns {undefined}
 */
Panel.prototype.killPanel = function(panelId, duration, fromStyle, toStyle, dontResize) {
    if (panelId === undefined || panelId === this.panelId) {
        var centerX = parseInt(this.panelDiv.style("width")) / 2;
        var centerY = parseInt(this.panelDiv.style("height")) / 2;
        fromStyle = fromStyle || global.getStyleForScale(1, centerX, centerY);
        toStyle = toStyle || global.getStyleForScale(0, centerX, centerY);

        var killDuration = (duration === undefined) ? global.selfDuration : duration;

        // A panel kivétele a regiszterből.
        this.mediator.publish("register", undefined, this.panelId);

        // A panel listenerjeinek leállítása.
        this.killListeners();

        // A panel mediátor-leiratkozásai.
        for (var i = 0, iMax = this.mediatorIds.length; i < iMax; i++) {
            this.mediator.remove(this.mediatorIds[i].channel, this.mediatorIds[i].id);
        }
        this.mediatorIds = [];

        // Panel levétele a DOM-ból.

        this.panelDiv.classed("dying", true);     // Beállítjuk megsemmisülőnek, hogy ne számolódjon be a panelszámba.
        this.panelDiv.styles(fromStyle)
                .style("opacity", "1")
                .transition().duration(killDuration)
                .styles(toStyle)
                .style("opacity", "0")
                .remove()
                .on("end", global.mainToolbar_refreshState);
        if (!dontResize) {
            $(window).trigger('resize');
        }
    }
};

/**
 * Nagyítja/kicsinyíti a panelt. (Ha nagyítva volt visszakicsinyíti, ha kicsi volt, nagyítja.)
 * 
 * @param {String} panelId A nagyítandó panel azonosítója. Ha nincs megadva, akkor csak kicsinyít, ha nagy volt.
 * @returns {undefined}
 */
Panel.prototype.magnifyPanel = function(panelId) {
    var that = this;

    if (panelId === that.panelId || that.magLevel !== 1) {
        // Belerakjuk a kezdő és végnagyítottságot a panel init-stringjébe.
        var origMag = that.actualInit.mag;
        if (origMag === 1) {
            that.actualInit.mag = that.doubleMultiplier;
            that.actualInit.fromMag = 1;
        } else {
            that.actualInit.mag = 1;
            that.actualInit.fromMag = that.doubleMultiplier;
        }

        // Elkészítjük a nagyított panel config-sztringjét, és beleírjuk a pozíciót is.
        var position = that.panelId.slice(-1);
        var config = this.getConfig();
        config = config.substr(0, config.length - 2);
        if (config.slice(-1) !== "{") {
            config = config + ", ";
        }
        config = config + "position: " + position + "})";

        var newPanelId = that.panelId;
        that.panelId = that.panelId + "dying";
        this.panelDiv.attr("id", that.panelId.substring(1));

        // Pici késésel megöljük a régit, létrehozzuk az új nagyítottat. Azért kell a késés,
        // hogy a magnification mediátor-értesítést még az eredeti panelek kapják el.
        setTimeout(function() {
            that.killPanel(that.panelId, global.selfDuration, global.getStyleForScale(that.actualInit.mag / origMag, 0, 0), global.getStyleForScale(that.actualInit.mag / origMag, 0, 0), true);
            eval("new " + config);
            var newPanel = $(newPanelId);
            global.mediators[that.panelSide].publish("drill", {dim: -1, direction: 0, duration: -1, onlyFor: newPanelId});
            that.panelDiv.style("position", "absolute");
            that.panelDiv.style("left", -global.panelMargin + "px");
            that.panelDiv.style("top", -global.panelMargin + "px");
            newPanel.insertBefore($(that.panelId));
            newPanel.prepend($(that.panelId));

            if (that.actualInit.mag !== 1) {
                var panels = d3.selectAll("#container" + that.panelSide + " .panel.single").nodes();

                var startPosition = newPanel.position();
                newPanel.insertBefore($(panels[0]));
                var finishPosition = newPanel.position();
                d3.select(newPanelId)
                        .style("left", ((startPosition.left - finishPosition.left) / global.scaleRatio) + "px")
                        .style("top", ((startPosition.top - finishPosition.top) / global.scaleRatio) + "px")
                        .style("z-index", 5);
            }
            $(window).trigger('resize');
        }, 50/ that.magLevel);

    }
};

/**
 * Pánik-takaró megjelenítése/eltüntetése. Ha az adat nem megjeleníthető,
 * akkor érdemes alkalmazni.
 * 
 * @param {Boolean} panic True: bepánikolás, false: kipánikolás.
 * @param {String} reason Megjelenítendő tooltip.
 * @returns {undefined}
 */
Panel.prototype.panic = function(panic, reason) {
    var that = this;

    // Csak ha megváltozott a panel pánikállapota, vagy új tooltip érkezett.
    if (that.inPanic !== panic) {
        that.inPanic = panic;

        // Ha bepánikolás esete történik.
        if (panic) {

            // Letöröljük az esetlegesen már fennlévő pánikréteget.
            that.svg.selectAll(".panic")
                    .on("click", null)
                    .style("opacity", 0)
                    .remove();

            // Új réteg a többi fölé, de azért a címsor mögé.
            var gPanic = that.svg.insert("svg:g", ".title_group")
                    .attr("class", "panic listener")
                    .style("opacity", 0)
                    .on("click", function() {
                        that.drill();
                    });

            // Mindent kitakaró téglalap a rétegre.
            gPanic.append("svg:g")
                    .append("svg:rect")
                    .attr("width", that.w)
                    .attr("height", that.h)
                    .attr("rx", global.rectRounding)
                    .attr("ry", global.rectRounding);

            // Szöveg a pánikrétegre.
            gPanic.selectAll("text").data([{tooltip: reason || that.defaultPanicText}])
                    .enter().append("svg:text")
                    .attr("x", that.w / 2)
                    .attr("y", that.h / 2)
                    .attr("text-anchor", "middle")
                    .attr("dy", "0.38em")
                    .attr("font-size", that.h * .8)
                    .text("?");

            // A réteg megjelenítése.
            gPanic.transition().duration(global.selfDuration)
                    .style("opacity", 1);

            // Kipánikolás esetén.
        } else {

            // Pánikréteg letörlése.
            that.svg.selectAll(".panic")
                    .on("click", null)
                    .transition().duration(global.selfDuration)
                    .style("opacity", 0)
                    .remove();
        }
    }

    if (reason) {
        that.svg.selectAll(".panic").selectAll("text").data([{tooltip: reason || that.defaultPanicText}]);
    }

};

/**
 * Lefúrást kezdeményező függvény; az alosztályok majd felülírják maguknak.
 * 
 * @returns {undefined}
 */
Panel.prototype.drill = function() {
    return;
};

/**
 * Nyelvváltást végrehajtó függvény; az alosztályok majd felülírják maguknak.
 * 
 * @returns {undefined}
 */
Panel.prototype.langSwitch = function() {
    return;
};

/**
 * A valamilyen elemre való ejtés lehetőségét jelző/kezelő függvény.
 * Valójában az elem fölött levő egérmutatót figyeli megállás nélkül,
 * de csak akkor csinál bármit is, ha épp valami meg van ragadva.
 * 
 * @param {Object} gHovered Az elemet tartó g. Ennek az első téglalapjára lehet ejteni.
 * @param {String} targetId A célpont-elem osztály-azonosítója (classname).
 * @returns {undefined}
 */
Panel.prototype.hoverOn = function(gHovered, targetId) {
    if (global.dragDropManager.draggedId !== null) {
        var rectObj = d3.select(gHovered).select("rect"); // A g-ben levő ELSŐ téglalap kiválasztása.
        var transform = (rectObj.attr("transform") !== null) ? rectObj.attr("transform") : d3.select(gHovered).attr("transform");
        var that = this;
        global.dragDropManager.targetObject = gHovered;//.parentNode;
        global.dragDropManager.targetPanelId = that.panelId;
        global.dragDropManager.targetId = targetId;// || 0;
        global.dragDropManager.targetSide = parseInt(that.panelId.replace(/(^.+\D)(\d+)(\D.+$)/i, '$2'));

        // Ha ejthető a dolog, akkor bevonalkázza a célpontot.
        if (global.dragDropManager.draggedMatchesTarget()) {
            that.svg.append("svg:rect")
                    .attr("class", "hoveredDropTarget")
                    .attr("width", rectObj.attr("width"))
                    .attr("height", rectObj.attr("height"))
                    .attr("transform", transform)
                    .attr("rx", rectObj.attr("rx"))
                    .attr("ry", rectObj.attr("ry"))
                    .attr("x", rectObj.attr("x"))
                    .attr("y", rectObj.attr("y"))
                    .attr("fill", 'url(#diagonal)');
        }
    }
};

/**
 * Egy dobás-célpontként használt elem elhagyását kezelő függvény.
 * Megszünteti a célpont vonalkázását, és alapállapotba hozza a dragodropmanagert.
 * 
 * @returns {undefined}
 */
Panel.prototype.hoverOff = function() {
    if (global.dragDropManager.targetObject !== null) {
        global.dragDropManager.targetObject = null;
        global.dragDropManager.targetPanelId = null;
        global.dragDropManager.targetId = null;
        this.svg.select(".hoveredDropTarget").remove();
    }
};

/**
 * Visszaadja a panel létrehozó sztringjét, végrehajtjató konstruktor formában.
 * 
 * @returns {String} A panel init sztringje.
 */
Panel.prototype.getConfig = function() {
    var panelConfigString = this.constructorName + "({";
    var prefix = "";
    for (var propName in this.actualInit) {
        var propValue = this.actualInit[propName];
        var defaultValue = this.defaultInit[propName];
        if (this.actualInit.hasOwnProperty(propName) && propValue !== undefined && propName !== "position" && JSON.stringify(propValue) !== JSON.stringify(defaultValue)) {
            if (propValue instanceof Array) {
                panelConfigString = panelConfigString + prefix + propName + ": [" + propValue + "]";
                prefix = ", ";
            } else {
                panelConfigString = panelConfigString + prefix + propName + ": " + propValue;
                prefix = ", ";
            }
        }
    }
    panelConfigString = panelConfigString + "})";
    return panelConfigString;
};