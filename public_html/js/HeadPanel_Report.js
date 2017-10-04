/* global HeadPanel, d3 */

'use strict';

/**
 * A report fejlécpanel konstruktora.
 *  
 * @param {Object} init Inicializáló objektum.
 * @param {Object} reportMeta A megjelenített report metaadatai.
 * @returns {HeadPanel_Report} A fejlécpanel.
 */
function HeadPanel_Report(init, reportMeta) {
	var that = this;

	HeadPanel.call(this, init, global.mediators[init.group], "reportHeadPanel");

	this.meta = reportMeta;

	// Panel regisztrálása a nyilvántartóba.
	that.mediator.publish("register", that, that.panelId, [], that.preUpdate, that.update);

	that.divTableBase.append("html:div")
			.attr("class", "mainTitle")
			.append("html:text")
			.text(reportMeta.description);

	// Dimenziók táblázata
	var dimTableHolder = that.divTableBase.append("html:div")
			.attr("id", "dimHolderP" + that.panelSide)
			.attr("class", "halfHeadDim halfHead");

	this.dimTable = dimTableHolder.append("html:div")
			.attr("class", "tableScrollPane")
			.append("html:div")
			.attr("class", "table dimTable")
			.attr("id", "dimsTableP" + that.panelSide);

	var dimHeading = that.dimTable.append("html:div")
			.attr("class", "heading");

	dimHeading.append("html:div")
			.attr("class", "cell")
			.text("Dimenzió neve");

	dimHeading.append("html:div")
			.attr("class", "cell")
			.text("Lefúrási szint");

	dimHeading.append("html:div")
			.attr("class", "cell");

	dimTableHolder.transition().duration(global.selfDuration)
			.style("opacity", "1");

	// Értékek táblázata
	var valTableHolder = that.divTableBase.append("html:div")
			.attr("id", "tableHolderP" + that.panelSide)
			.attr("class", "halfHeadValue halfHead");

	this.valTable = valTableHolder.append("html:div")
			.attr("class", "tableScrollPane")
			.append("html:div")
			.attr("class", "table valTable")
			.attr("id", "reportsTableP" + that.panelSide);

	var valHeading = that.valTable.append("html:div")
			.attr("class", "heading");

	var nameRow = valHeading.append("html:div")
			.attr("class", "cell");


	nameRow.append("html:text")
			.text("Mutató neve")
			.attr("class", "realText");

	nameRow.append("html:text")
			.text("ArányosítottMérték k k k k k k k k k k k k k k k k k k k k k")
			.attr("class", "dummyText");

	var valueRow = valHeading.append("html:div")
			.attr("class", "cell");

	valueRow.append("html:text")
			.text("Érték")
			.attr("class", "realText");

	valueRow.append("html:text")
			.text("ArányosítottMérték")
			.attr("class", "dummyText");

	var ratioRow = valHeading.append("html:div")
			.attr("class", "cell");

	ratioRow.append("html:text")
			.text("Arányosított érték")
			.attr("class", "realText");

	ratioRow.append("html:text")
			.text("ArányosítottMérték")
			.attr("class", "dummyText");


	valHeading.append("html:div")
			.attr("class", "cell");

	valTableHolder.transition().duration(global.selfDuration)
			.style("opacity", "1");

	// Dimenzió tábla feltöltése a meta alapján
	var dimRow = that.dimTable.selectAll(".row").data(that.meta.dimensions);

	var newDimRow = dimRow.enter().append("html:div")
			.attr("class", "row alterColored")
			.attr("parity", function(d, i) {
				return i % 2;
			});

	var tempRowCell;

	// Első cella: a dimenzió neve.
	{
		tempRowCell = newDimRow.append("html:div")
				.attr("class", "cell");

		tempRowCell.append("html:text")
				.attr("class", "tableText0")
				.text(function(d) {
					return d.caption;
				});

		tempRowCell.append("html:text")
				.attr("class", "tableText0 spacer")
				.text(function(d) {
					return d.caption;
				});

		tempRowCell.append("html:span")
				.html("&nbsp;");
	}

	// Második cella: a pillanatnyi lefúrási szint.
	{
		tempRowCell = newDimRow.append("html:div")
				.attr("class", "cell");

		tempRowCell.append("html:text")
				.attr("class", "tableText1")
				.text(function(d) {
					return d.topLevelName;
				});

		tempRowCell.append("html:text")
				.attr("class", "tableText1 spacer")
				.text(function(d) {
					return d.topLevelName;
				});

		tempRowCell.append("html:span")
				.html("&nbsp;");
	}

	// A táblázatsor háttere.
	{
		newDimRow.append("html:div")
				.attr("class", "cell backgroundCell listener dragable");
	}

	// Érték tábla feltöltése a meta alapján
	var newValRow = that.valTable.selectAll(".row").data(that.meta.indicators)
			.enter().append("html:div").attr("class", "row");

	// Első cella: a mutató neve.
	{
		tempRowCell = newValRow.append("html:div")
				.attr("class", "cell hoverable listener dragable")
				.on("click", function(d) {
					that.mediator.publish("changeValue", undefined, d.id, false);
				});

		tempRowCell.append("html:text")
				.attr("class", "tableText0")
				.text(function(d) {
					return d.caption;
				});

		tempRowCell.append("html:text")
				.attr("class", "tableText0 spacer")
				.text(function(d) {
					return d.caption;
				});

		tempRowCell.append("html:span")
				.html("&nbsp;");
	}

	// Második cella: a mutató abszolút értéke.	
	{
		tempRowCell = newValRow.append("html:div")
				.attr("class", "cell hoverable listener dragable")
				.on("click", function(d) {
					that.mediator.publish("changeValue", undefined, d.id, false);
				});

		tempRowCell.append("html:text")
				.attr("class", "tableText1");

		tempRowCell.append("html:text")
				.attr("class", "tableText1 spacer")
				.text(function(d) {
					return (d.value.hide) ? "nem értelmezett" : "99.9Mrd " + d.value.unit;
				});
				
		tempRowCell.append("html:span")
				.html("&nbsp;");				
	}

	// Harmadik cella: a mutató arányosított.
	{
		tempRowCell = newValRow.append("html:div")
				.attr("class", "cell hoverable listener dragable")
				.on("click", function(d) {
					that.mediator.publish("changeValue", undefined, d.id, true);
				});

		tempRowCell.append("html:text")
				.attr("class", "tableText2");

		tempRowCell.append("html:text")
				.attr("class", "tableText2 spacer")
				.text(function(d) {
					return (d.fraction.hide) ? "nem értelmezett" : "99.9Mrd " + d.fraction.unit;
				});
				
		tempRowCell.append("html:span")
				.html("&nbsp;");				
	}

	// A sor háttere.
	{
		newValRow.append("html:div")
				.attr("class", "cell backgroundCell")
				.style("background", function(d, i) {
					return global.colorValue(i);
				});
	}

	that.mediator.publish("magnify", 0);
	that.mediator.publish("addDrag", that.divTableBase.selectAll(".dragable"));    
}

//////////////////////////////////////////////////
// Osztály-konstansok inicializálása.
//////////////////////////////////////////////////

{
	HeadPanel_Report.prototype = global.subclassOf(HeadPanel);
}


//////////////////////////////////////////////////
// Kirajzolást segítő függvények
//////////////////////////////////////////////////


/**
 * A megjelenítendő abszolút értéket előállító függvény.
 * 
 * @param {Object} data Az aktuális adatokat tartalmazó objektum.
 * @param {Object} valueMeta A mutató leírását tartalmazó meta.
 * @param {Integer} i Az adat sorszáma.
 * @returns {String} A megjelenítendő felirat.
 */
HeadPanel_Report.prototype.valToShow = function(data, valueMeta, i) {
	var val = "";
	if (data !== undefined && data.rows[0] !== undefined && data.rows[0].vals[i] !== undefined) {
		val = (valueMeta.hide) ? "nem értelmezett" : global.cleverRound3(data.rows[0].vals[i].sz) + " " + valueMeta.unit;
	} else {
		val = "??? " + valueMeta.unit;
	}
	return val;
};

/**
 * A megjelenítendő hányados értéket előállító függvény.
 * 
 * @param {Object} data Az aktuális adatokat tartalmazó objektum.
 * @param {Object} ratioMeta A mutató leírását tartalmazó meta.
 * @param {Integer} i Az adat sorszáma.
 * @returns {String} A megjelenítendő felirat.
 */
HeadPanel_Report.prototype.ratioToShow = function(data, ratioMeta, i) {
	var val = "";
	if (data !== undefined && data.rows[0] !== undefined && data.rows[0].vals[i] !== undefined) {
		val = (ratioMeta.hide) ? "nem értelmezett" : (data.rows[0].vals[i].n === 0) ? "a nevező 0" : global.cleverRound3(ratioMeta.multiplier * data.rows[0].vals[i].sz / data.rows[0].vals[i].n) + " " + ratioMeta.unit;
	} else {
		val = "??? " + ratioMeta.unit;
	}
	return val;
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
HeadPanel_Report.prototype.preUpdate = function(drill) {

	// A lefúrás dimenziójának eltörlése.
	this.dimTable.selectAll(".row:nth-child(" + (drill.dim + 2) + ")").select(".tableText1")
			.style("opacity", 0);

	// Ha valódi fúrás történt, az értékek törlése.
	if (drill.direction !== 0) {
		this.valTable.selectAll(".row").selectAll(".tableText2, .tableText1")
				.style("opacity", 0);
	}
};

/**
 * Az új adat előkészítése, és a tooltip elkészítése.
 * 
 * @param {Object} data Az új adatsort tartalmazó objektum.
 * @returns {Object} A megjelenítendő adatok.
 */
HeadPanel_Report.prototype.prepareData = function(data) {
	var that = this;
	var dimData = [];
	var valData = [];

	// Dimenziók aktuális értékeinek elkészítése.
	for (var i = 0, iMax = (global.baseLevels[that.panelSide]).length; i < iMax; i++) {
		var baseDim = (global.baseLevels[that.panelSide])[i];
		dimData.push({
			text: (baseDim.length === 0) ? that.meta.dimensions[i].top_level_caption : baseDim[baseDim.length - 1].name.trim()
		});
	}

	// Tooltip hozzáadása a dimenzió tábla soraihoz.
	that.dimTable.selectAll(".row").data(dimData)
			.attr("tooltip", function(d, i) {
				return "<html><h4>" + that.meta.dimensions[i].description + ": <em>" + d.text + "</em></h4></html>";
			});

	// Értékek aktuális értékeinek elkészítése.
	for (var i = 0, iMax = that.meta.indicators.length; i < iMax; i++) {
		var meta = that.meta.indicators[i];
		valData.push({
			value: that.valToShow(data, meta.value, i),
			ratio: that.ratioToShow(data, meta.fraction, i)
		});
	}

	// Tooltip hozzáadása az érték tábla soraihoz.
	that.valTable.selectAll(".row").data(valData)
			.attr("tooltip", function(d, i) {
				return "<html><h4>" + that.meta.indicators[i].description + "</h4></html>";
			});

	return {"dimData": dimData, "valData": valData};
};

/**
 * Új adat megérkeztekor elvégzi a panel frissítését.
 * 
 * @param {Object} data Az új adat.
 * @returns {undefined}
 */
HeadPanel_Report.prototype.update = function(data) {
	var that = this;
	var preparedData = that.prepareData(data);

	// Dimenzió értékek upgradelése
	var dimRow = that.dimTable.selectAll(".row").data(preparedData.dimData);

	dimRow.select(".tableText1:not(.spacer)")
			.style("opacity", function(d) {
				return (d.text === d3.select(this).text()) ? 1 : 0;
			})
			.text(function(d) {
				return d.text;
			}).transition().duration(global.selfDuration)
			.style("opacity", 1);

	dimRow.select(".tableText1.spacer")
			.style("opacity", function(d) {
				return (d.text === d3.select(this).text()) ? 1 : 0;
			})
			.text(function(d) {
				return d.text;
			});

	// Értékek értékeinek upgradelése.
	var valRow = that.valTable.selectAll(".row")
			.data(preparedData.valData);

	valRow.select(".tableText1:not(.spacer)")
			.style("opacity", function(d) {
				return (d.value === d3.select(this).text()) ? 1 : 0;
			})
			.text(function(d) {
				return d.value;
			}).transition().duration(global.selfDuration)
			.style("opacity", 1);

	valRow.select(".tableText2:not(.spacer)")
			.style("opacity", function(d) {
				return (d.ratio === d3.select(this).text()) ? 1 : 0;
			})
			.text(function(d) {
				return d.ratio;
			}).transition().duration(global.selfDuration)
			.style("opacity", 1);

	//that.mediator.publish("magnify", 0);
};