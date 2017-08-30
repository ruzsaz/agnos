'use strict';

/**
 * Létrehoz egy html scrollbart, de egy svg-n belül, svg elemek scrollozására.
 * 
 * @param {Object} parentElement A scollbart tartalmazó szülőelem.
 * @param {Boolean} isHorizontal True: vízszintes, false: függőleges.
 * @param {Number} length A scrollbar hossza, pixelben.
 * @param {Function} scrollFunction A scrollozáskor meghívandó függvény.
 * @returns {SVGScrollbar} A scollbar.
 */
function SVGScrollbar(parentElement, isHorizontal, length, scrollFunction) {
	var that = this;

	this.isHorizontal = isHorizontal;
	this.width = (that.isHorizontal) ? length : global.scrollbarWidth + 1;
	this.height = (that.isHorizontal) ? global.scrollbarWidth + 1 : length;
	this.className = (that.isHorizontal) ? "horizontal" : "vertical";
	this.length = length;
	this.color = null;
	this.opacity = 0;
	this.style = undefined;

	// A scroolbart tartalmazó div.
	this.scrollPane = parentElement.append("html:div")
			.attr("class", "svgScrollbar " + that.className)
			.style("width", that.width + "px")
			.style("height", that.height + "px")
			.on("scroll", scrollFunction);

	// A kamutartalom.
	this.contentMirror = that.scrollPane.append("html:div")
			.attr("class", "contentMirror")
			.style("width", that.width + "px")
			.style("height", that.height + "px");
}

/**
 * Beállítja a scollbar helyét.
 * 
 * @param {Number} x A bal felső sarok x koordinátája.
 * @param {Number} y A bal felső sarok y koordinátája.
 * @returns {undefined}
 */
SVGScrollbar.prototype.setPosition = function(x, y) {
	this.scrollPane
			.style("left", x + "px")
			.style("top", y + "px");
};

/**
 * Beállítja a scrollbar által szkrollozott terület nagyságát, és a színét.
 * 
 * @param {Number} width A scrollozott terület nagysága.
 * @param {String} color A scrollbar színe. Ha null vagy undefined, nem változik.
 * @param {Number} duration Az animáció időtartama.
 * @returns {undefined}
 */
SVGScrollbar.prototype.set = function(width, color, duration) {
	this.contentMirror.transition().duration(duration)
			.style((this.isHorizontal) ? "width" : "height", Math.max(this.length, width) + "px");

	this.scrollPane.classed("noEvents", (width <= this.length) ? true : false);

	this.style = {};

	// Ha változott a kijelzendőség, berakjuk az új opacityt a stílusobjektumba.
	var newOpacity = (width <= this.length) ? 0 : 1;
	if (this.opacity !== newOpacity) {
		this.style["opacity"] = newOpacity;
		this.opacity = newOpacity;
	}

	// Ha változott a szín, berakjuk az új színt a stílusobjektumba.
	if (this.color !== color && color !== null && color !== undefined) {
		this.style["background"] = color;
		this.style["-ms-scrollbar-face-color"] = color;
		this.style["-ms-scrollbar-arrow-color"] = color;
		this.style["-ms-scrollbar-shadow-color"] = color;
		this.color = color;
	}

	this.scrollPane.transition().duration(duration)
			.style(this.style);
};