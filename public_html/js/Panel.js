/* global d3 */

'use strict'; // TODO: nyelv

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
	this.containerId = "#container" + that.panelSide;
	this.divPosition = (panelInitString.position !== undefined) ? panelInitString.position : d3.selectAll(that.containerId + " .panel.single")[0].length;
	this.panelId = "#panel" + that.panelSide + "P" + that.divPosition;

	this.mediator = mediator;
	this.data;
	this.dimsToShow = [];

	this.valMultiplier = 1;		// Ennyiszeresét
	this.valFraction = false;	// Hányadost mutasson?
	this.inPanic = false;		// Hibaüzemmódban van a panel?
	this.mediatorIds = [];		// A mediátorok id-jeit tartalmazó tömb.
	this.replaceFunction;

	this.margin = {
		top: global.panelTitleHeight + 3 * global.legendOffsetY + topOffset,
		right: global.legendOffsetX + rightOffset,
		bottom: bottomOffset + ((isLegendRequired) ? global.legendHeight + 2 * global.legendOffsetY : global.legendOffsetY + global.legendHeight / 2),
		left: global.legendOffsetX + leftOffset
	};

	this.width = that.w - that.margin.left - that.margin.right;
	this.height = that.h - that.margin.top - that.margin.bottom;

	this.panelDiv = d3.select(that.containerId).append("html:div")
			.attr("id", that.panelId.substring(1))
			.attr("class", "panel single");

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

	// Fejléc.
	this.titleBox = new TitleBox(that.svg, that.panelId, that.mediator);
	that.titleBox.gContainer
			.classed('listener', true)
			.on('mouseover', function() {
				that.hoverOn(this);
			})
			.on('mouseout', function() {
				that.hoverOff();
			});
}

//////////////////////////////////////////////////
// Osztály-konstansok inicializálása.
//////////////////////////////////////////////////

{
	Panel.prototype.w = global.panelWidth;
	Panel.prototype.h = global.panelHeight;
	Panel.prototype.legendWidth = global.panelWidth - 2 * global.legendOffsetX;
	Panel.prototype.defaultPanicText = "<html>Nincs megjeleníthető adat.<html>";
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
			html = html + "<em> átlag: " + global.cleverRound5(vals[v].avgValue) + "</em>";
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
 * Animálva megöli a panelt.
 * 
 * @param {Integer} panelId A megölendő panel id-je. (Ha a panelen belülről hívjuk, elhagyható.)
 * @returns {undefined}
 */
Panel.prototype.killPanel = function(panelId) {
	if (panelId === undefined || panelId === this.panelId) {

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
		var centerX = parseInt(this.panelDiv.style("width")) / 2;
		var centerY = parseInt(this.panelDiv.style("height")) / 2;
        this.panelDiv.classed("dying", true);     // Beállítjuk megsemmisülőnek, hogy ne számolódjon be a panelszámba.
		this.panelDiv.style(global.getStyleForScale(1, centerX, centerY))
				.style("opacity", "1")
				.transition().duration(global.selfDuration)
				.style(global.getStyleForScale(0, centerX, centerY))
				.style("opacity", "0")
				.remove()
				.each("end", global.mainToolbar_refreshState);
		$(window).trigger('resize');
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