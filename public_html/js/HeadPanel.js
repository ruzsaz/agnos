/* global d3 */

'use strict';

/**
 * A fejléc panelek közös szülője.
 * 
 * @param {Object} init Inicializáló objektum. Valójában csak az oldal érdekel belőle.
 * @param {Object} mediator A rendelkezésre álló mediátor.
 * @param {String} additionalClass A html objektumhoz adandó további class-nevek.
 * @returns {HeadPanel} A fejlécpanel.
 */
function HeadPanel(init, mediator, additionalClass) {
	var that = this;
	
	this.panelSide = init.group || 0;
	this.mediator = mediator;
	this.mediatorIds = [];		// A mediátorok id-jeit tartalmazó tömb.
	this.panelDiv = d3.select("#headPanelP" + this.panelSide);
	this.panelId = "#panel" + that.panelSide + "P-1";
	this.divTableBase = undefined;
	this.init(additionalClass);
	var med;
	med = this.mediator.subscribe("killPanel", function(panelId) {
		that.killPanel(panelId);
	});
	that.mediatorIds.push({"channel": "killPanel", "id": med.id});

	med = this.mediator.subscribe("killListeners", function() {
		that.killListeners();
	});
	that.mediatorIds.push({"channel": "killListeners", "id": med.id});

	med = this.mediator.subscribe("resize", function(duration, panelNumberPerRow, scaleRatio, callback) {
		that.resize(duration, panelNumberPerRow, callback);
	});
	that.mediatorIds.push({"channel": "resize", "id": med.id});
}

//////////////////////////////////////////////////
// Osztály-konstansok inicializálása.
//////////////////////////////////////////////////

{
	HeadPanel.prototype.panelMargin = global.panelMargin;
}

//////////////////////////////////////////////////
// Működést végrehajtó függvények
//////////////////////////////////////////////////

/**
 * Inicializálja a fejlécpanelt. A konstruktornak kell meghívnia.
 * 
 * @param {String} additionalClass A html objektumhoz adandó további class-nevek.
 * @returns {undefined}
 */
HeadPanel.prototype.init = function(additionalClass) {
	var that = this;

	if (that.panelDiv.selectAll(".baseDiv").empty()) {

		// Alap Div, rajta van a táblázat
		that.divBase = that.panelDiv.append("html:div")
				.attr("class", "baseDiv");

	} else {
		that.divBase = that.panelDiv.select(".baseDiv");
	}

	that.reset(additionalClass);
};

/**
 * Átméretezi a panelt.
 * 
 * @param {Number} duration Az átméretezés ideje, millisec.
 * @param {Integer} panelNumberPerRow Egy sorban elférő normál méretű panelek száma.
 * @param {Function} callback Az átméretezés után meghívandó függvény.
 * @returns {undefined}
 */
HeadPanel.prototype.resize = function(duration, panelNumberPerRow, callback) {
	var that = this;
	var currentHeight = this.panelDiv.style("height");
	var finalHeight = this.panelDiv.style("height", null).style("height");
	this.panelDiv.style("height", currentHeight);

	var width = panelNumberPerRow * (global.panelWidth + 2 * this.panelMargin) - 2 * this.panelMargin;

	this.panelDiv.transition().duration(duration)
			.style("width", width + "px")
			.style("height", finalHeight)
			.each("end", function() {
				that.panelDiv.selectAll(".halfHead")
						.classed("vertical", (panelNumberPerRow === 1) ? true : false);
				callback();
			});
};

/**
 * Letörli, és alaphelyzetbe hozza a fejlécpanelt.
 * 
 * @param {String} additionalClass A html objektumhoz adandó további class-nevek.
 * @returns {undefined}
 */
HeadPanel.prototype.reset = function(additionalClass) {
	var that = this;

	that.panelDiv.selectAll(".divTableBase")
			.attr("class", null)
			.style("width", function() {
				return d3.select(this).style("width");
			})
			.style("position", "absolute")
			.transition().duration(global.selfDuration)
			.style("opacity", "0")
			.remove();

	that.divTableBase = that.divBase.append("html:div")
			.attr("class", "divTableBase " + additionalClass)
			.style("opacity", 0);

	that.divTableBase.transition().duration(global.selfDuration)
			.style("opacity", 1);
};

/**
 * Megöli a panel 'listener' osztályú elmeihez rendelt eseményfigyelőket.
 * 
 * @returns {undefined}
 */
HeadPanel.prototype.killListeners = function() {
	this.panelDiv.selectAll(".listener")
			.on("click", null)
			.on("mouseover", null)
			.on("mouseout", null);
};

/**
 * Megöli a panelt.
 * 
 * @param {Integer} panelId A megölendő panel id-je. (Ha a panelen belülről hívjuk, elhagyható.)
 * @returns {undefined}
 */
HeadPanel.prototype.killPanel = function(panelId) {
	if (panelId === undefined || panelId === this.panelId) {
		this.killListeners();
		
		// A panel mediátor-leiratkozásai.
		for (var i = 0, iMax = this.mediatorIds.length; i < iMax; i++) {
			this.mediator.remove(this.mediatorIds[i].channel, this.mediatorIds[i].id);
		}
		this.mediatorIds = [];
		this.mediator = undefined;
	}
};