/* global d3 */

'use strict';

/**
 * Tooltip létrehozása. Csak 1x kell, újrahasznosítjuk.
 * 
 * @returns {Tooltip}
 */
function Tooltip() {
	var that = this;

	this.screenSizeX = parseInt($(window).width());
	this.screenSizeY = parseInt($(window).height());
	this.status = -2; // 2: látható, 1: előtűnő, -1: fakuló, -2: nem látható.
	this.element = undefined; // Az épp mutatott elem.
	this.currentWidth = 0;  // Az épp kijelzett tooltip szélessége pixelben.
	this.currentHeight = 0; // Az épp kijelzett tooltip magassága pixelben.

	this.tooltip = d3.select("body").append("html:div")
			.attr("class", "tooltip")
			.style("opacity", 0);

	// Egérmozgást követő eseménykezelő regisztrálása.
	d3.select("body").on("mousemove", function() {
		var event = d3.event;
		var htmlTooltip = $($(event.target).closest("[tooltip]")[0]).attr('tooltip');
		
		if (htmlTooltip !== undefined) { // Ha a html elemhez, vagy valamely szülőjéhez tartozik tooltip=... attributum, azt jelenítjük meg.
			that.element = undefined;
			that.show(htmlTooltip);
		} else {			// Ha nem, megnézzük, hogy az adathoz tartozik-e?
			var targetData = d3.select(event.target).data()[0];
			if ((targetData && targetData.tooltip)) {
				if (targetData !== that.element) {
					that.show(targetData.tooltip);
					that.element = targetData;
				} else {
					that.show();
				}
			} else {
				if (that.status > 0) {
					that.hide();
				}
			}
		}

		// Ha látható a tooltip, az egérpozícióba mozgatjuk.
		if (that.status !== -2) {
			var currentPosX = event.pageX;
			var currentPosY = event.pageY;
			var posLeft = (currentPosX * 2 > that.screenSizeX) ? currentPosX - that.tooltipOffsetX - that.currentWidth - 6 : currentPosX + that.tooltipOffsetX;
			var posTop = (currentPosY * 2 > that.screenSizeY) ? currentPosY - that.tooltipOffsetY - that.currentHeight : currentPosY + that.tooltipOffsetY;
			that.tooltip
					.style("left", posLeft + "px")
					.style("top", posTop + "px");
		}
	});
}

// Osztályáltozók.
{
	Tooltip.prototype.tooltipOffsetX = 16;
	Tooltip.prototype.tooltipOffsetY = 18;
	Tooltip.prototype.tooltipOpacity = 0.9;
	Tooltip.prototype.appearDelay = 1000;
}

/**
 * Azonnal eltünteti a tooltipet.
 * 
 * @returns {undefined}
 */
Tooltip.prototype.kill = function() {
	this.status = -2;
	this.tooltip.transition().duration(0)
			.style("opacity", 0);
};

/**
 * Fokozatosan elhalványítja a tooltipet.
 * 
 * @returns {undefined}
 */
Tooltip.prototype.hide = function() {
	var that = this;
	that.status = -1;
	that.tooltip.transition()
			.duration(global.selfDuration / 2)
			.style("opacity", 0)
			.each("end", function() {
				that.status = -2;
			});
};

/**
 * Megjeleníti a megadott html-t tooltipként.
 * 
 * @param {String} html A megjelenítendő html. Ha undefined, akkor az aktuális nem változik.
 * @returns {undefined}
 */
Tooltip.prototype.show = function(html) {
	var that = this;
	that.screenSizeX = parseInt($(window).width());  // Újra lemérjük, hátha megváltozott.
	that.screenSizeY = parseInt($(window).height()); // Újra lemérjük, hátha megváltozott.

	if (that.status < 0) {
		that.tooltip.transition().duration(0);
		that.tooltip.transition()
				.delay((that.status === -1) ? 0 : that.appearDelay)
				.duration(global.selfDuration / 2)
				.style("opacity", that.tooltipOpacity)
				.each("end", function() {
					that.status = 2;
				});
		that.status = 1;				
	}
	if (html !== undefined) {
		that.tooltip.html(html);
		that.currentWidth = parseInt(that.tooltip.style("width"));
		that.currentHeight = parseInt(that.tooltip.style("height"));
	}
};