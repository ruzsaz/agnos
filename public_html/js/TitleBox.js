/* global d3 */

'use strict';

/**
 * Egy panel fejléce. A fejléc az épp aktuális mutatót, és a mértékegységet tartalmazza,
 * ráklikkelésre megváltozik. Ez a konstruktor.
 * 
 * @param {Object} parentSVG A panel svg-je.
 * @param {String} panelId A panel html-beli id-je.
 * @param {Mediator} mediator A panel mediátora.
 * @returns {TitleBox}
 */
function TitleBox(parentSVG, panelId, mediator) {
	var that = this;

	this.panelId = panelId;		// Panel id-je.
	this.mediator = mediator;	// A panel mediátora, ezen át kommunikál a fejléc a panellel.
	this.currentId;				// Épp kijelzett mutató id-je, tömb ha többet mutat.
	this.currentRatio;			// Éppen hányadost jelez-e?
    this.currentText;           // A teljes kijelzett szöveg.

	// Fejlécet tartalmazó konténer.
	this.gContainer = parentSVG.append("svg:g")
			.attr("class", "title_group visibleInPanic listener droptarget droptarget1");

	// A fejléc háttér-téglalapja.
	that.gContainer.append("svg:rect")
			.attr("class", "titleRect bordered")
			.attr("filter", "url(#dropshadow)")
			.attr("width", that.titleBoxWidth)
			.attr("height", global.panelTitleHeight)
			.attr("rx", global.rectRounding)
			.attr("x", global.legendOffsetX)
			.attr("y", global.legendOffsetY);

	// A bal oldali láthatatlan értékváltó fejléc-gomb.
	that.gContainer.append("svg:rect")
			.attr("class", "titleButton0 listener")
			.attr("width", that.titleBoxWidth * that.titleSplitRatio)
			.attr("height", global.panelTitleHeight)
			.attr("rx", global.rectRounding)
			.attr("x", global.legendOffsetX)
			.attr("y", global.legendOffsetY)
			.attr("opacity", 0)
			.on("click", function() {
				that.mediator.publish("changeValue", that.panelId, -1, undefined);
			});

	// A jobb oldali láthatatlan hányadosváltó fejléc-gomb.
	that.gContainer.append("svg:rect")
			.attr("class", "titleButton1 listener")
			.attr("width", that.titleBoxWidth * (1 - that.titleSplitRatio))
			.attr("height", global.panelTitleHeight)
			.attr("rx", global.rectRounding)
			.attr("x", global.legendOffsetX + that.titleBoxWidth * that.titleSplitRatio)
			.attr("y", global.legendOffsetY)
			.attr("opacity", 0)
			.on("click", function() {
				that.mediator.publish("changeValue", that.panelId, undefined, -1);
			});

}

// Osztályáltozók.
TitleBox.prototype.titleBoxWidth = global.panelWidth - 2 * global.legendOffsetX;
TitleBox.prototype.titleSplitRatio = 0.6;

/**
 * A fejléc update függvénye.
 * 
 * @param {int | Array} idA A mutatott érték id-je, vagy az ezekből álló tömb.
 * @param {String | Array} nameA Mutatott érték neve, vagy az ezekből álló tömb.
 * @param {String | Array} szUnitA Mutatott érték számlálójának mértékegysége, vagy az ezekből álló tömb.
 * @param {String | Array} ratioUnitA Mutatott érték hányados-mértékegysége, vagy az ezekből álló tömb.
 * @param {Boolean} isRatio Hányadost mutasson-e?
 * @param {Number} tweenDuration Animáció időtartama.
 * @returns {undefined}
 */
TitleBox.prototype.update = function(idA, nameA, szUnitA, ratioUnitA, isRatio, tweenDuration) {
	var that = this;

	var id, name, szUnit, ratioUnit;	// A kijelzésre kerülő értékek.
    var trans =  d3.transition().duration(tweenDuration);

	// Ha tömböket kaptunk, összefűzzük őket.
	if (idA instanceof Array) {
		id = idA;
		name = nameA.join(" - ");
		szUnit = (d3.min(szUnitA) === d3.max(szUnitA)) ? szUnitA[0] : szUnitA.join(" - ");
		ratioUnit = (d3.min(ratioUnitA) === d3.max(ratioUnitA)) ? ratioUnitA[0] : ratioUnitA.join(" - ");
	} else { // Ha nem, akkor csak átmásoljuk.
		id = idA;
		name = nameA;
		szUnit = szUnitA;
		ratioUnit = ratioUnitA;
	}

	// Csak akkor update-olunk, ha változott valami.
	if (that.currentId !== id || that.currentRatio !== isRatio || that.currentText !== name + ratioUnit + szUnit) {
		that.currentId = id;
		that.currentRatio = isRatio;
        that.currentText = name + ratioUnit + szUnit;

		// Háttérszín vagy gradiens beállítása.
		that.gContainer.selectAll(".titleRect")
				.transition(trans)
				.style("fill", (id instanceof Array) ? null : global.colorValue(id))
				.style("opacity", 1);

		// Régi szövegek letörlése.
		that.gContainer.selectAll(".titleText")
				.transition(trans)
				.style("opacity", 0)
				.remove();

		// Új szöveg az értéknévnek.
		var valNameLabel = that.gContainer.append("svg:text")
				.attr("class", (id instanceof Array) ? "titleText" : "titleText titleText0")
				.attr("x", global.legendOffsetX + that.titleBoxWidth * that.titleSplitRatio / 2)
				.attr("y", global.legendOffsetY + 15)
				.attr("dy", ".35em")
				.attr("dx", "-.15em")
				.text(name)
				.transition(trans)
				.style("opacity", 1);

		// Új szöveg a mértékegységnek.
		var valUnitLabel = that.gContainer.append("svg:text")
				.attr("class", "titleText titleText1")
				.attr("x", global.legendOffsetX + that.titleBoxWidth * (that.titleSplitRatio + 1) / 2)
				.attr("y", global.legendOffsetY + 15)
				.attr("dy", ".35em")
				.attr("dx", ".15em")
				.text((isRatio) ? ratioUnit : szUnit)
				.transition(trans)
				.style("opacity", 1);

		// Szövegek összenyomása, hogy kiférjen.
		global.cleverCompress(valNameLabel, that.gContainer.select(".titleRect"), that.titleSplitRatio - 0.07, undefined);
		global.cleverCompress(valUnitLabel, that.gContainer.select(".titleRect"), 0.93 - that.titleSplitRatio, undefined);
	}
};
