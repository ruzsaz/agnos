'use strict'; // TODO: nyelv

/**
 * Létrehoz egy html scrollbart, de egy svg-n belül, svg elemek scrollozására.
 * 
 * @param {Object} parentElement A scollbart tartalmazó szülőelem.
 * @param {Boolean} isHorizontal True: vízszintes, false: függőleges.
 * @param {Number} length A scrollbar hossza, pixelben.
 * @param {Function} scrollFunction A scrollozáskor meghívandó függvény.
 * @returns {SVGScrollbar} A scollbar.
 */
function SVGScrollbar(parentElement, isHorizontal, length, scrollFunction, wheelScrollSize, additionalWheelTarget) {
    var that = this;

    this.isHorizontal = isHorizontal;
    this.positionStringToSet = (that.isHorizontal) ? "x" : "y";
    this.lengthStringToSet = (that.isHorizontal) ? "width" : "height";
    this.width = (that.isHorizontal) ? length : global.scrollbarWidth + 1;
    this.height = (that.isHorizontal) ? global.scrollbarWidth + 1 : length;
    this.className = (that.isHorizontal) ? "horizontal" : "vertical";
    this.length = length;
    this.color = null;
    this.opacity = 0;
    this.thumbStyle = undefined;
    this.isDragging = false;
    this.scrollRatio;
    this.scrollThumbLength;
    this.scrollFunction = scrollFunction;
    this.wheelScrollSize = wheelScrollSize || 10;

    // A scroolbart tartalmazó div.
    this.scrollG = parentElement.append("svg:g")
            .attr("class", "svgScrollbarG " + that.className);

    this.scrollTrack = that.scrollG.append("svg:rect")
            .attr("class", "svgScrollbarTrack " + that.className)
            .attr("rx", (global.rectRounding / 2) + "px")
            .attr("width", that.width + "px")
            .attr("height", that.height + "px");

    this.scrollThumb = that.scrollG.append("svg:rect")
            .attr("class", "svgScrollbarThumb " + that.className)
            .attr("rx", (global.rectRounding / 2) + "px")
            .attr("x", "0px")
            .attr("y", "0px")
            .attr("width", that.width + "px")
            .attr("height", that.height + "px");

    var dragStartPosition;
    var dragPosition;

    var dragStarted = function() {
        if (d3.event.sourceEvent.which === 1) {
            var coords = d3.mouse(that.scrollG[0][0]);
            dragStartPosition = (that.isHorizontal) ? coords[0] : coords[1];
            dragStartPosition = dragStartPosition - parseFloat(that.scrollThumb.attr(that.positionStringToSet));
            d3.event.sourceEvent.stopPropagation();
            that.scrollThumb.classed("dragging", true);
        }
    };

    /**
     * A megfogott réteg húzásakor történő dolgok.
     * 
     * @returns {undefined}
     */
    var dragging = function() {
        var coords = d3.mouse(that.scrollG[0][0]);
        dragPosition = Math.min(Math.max(0, ((that.isHorizontal) ? coords[0] : coords[1]) - dragStartPosition), that.length - that.scrollThumbLength);
        that.scrollThumb.attr(that.positionStringToSet, dragPosition + "px")
        scrollFunction(dragPosition / that.scrollRatio);
    };

    var zooming = function() {
        let t = d3.event;        
        var delta = t.sourceEvent.deltaY;
        var oldPos = parseFloat(that.scrollThumb.attr(that.positionStringToSet));
        dragPosition = Math.min(Math.max(0, oldPos + Math.sign(delta) * that.wheelScrollSize*that.scrollRatio), that.length - that.scrollThumbLength);
        that.scrollThumb.attr(that.positionStringToSet, dragPosition + "px")
        scrollFunction(dragPosition / that.scrollRatio);
    };

    /**
     * A megfogott réteg elengedésénél történő dolgok.
     * 
     * @returns {undefined}
     */
    var dragEnd = function() {
        that.scrollThumb.classed("dragging", false);
    };

    // A drag-viselkedés definiálása.
    var drag = d3.behavior.drag()
            .on("dragstart", dragStarted)
            .on("drag", dragging)
            .on("dragend", dragEnd); 

        var zoom = d3.behavior
            .zoom()
        .on('zoom', zooming);

    this.scrollThumb.call(drag);
    this.scrollG.call(zoom);
    if (additionalWheelTarget) {
        additionalWheelTarget.call(zoom);
    }
}

/**
 * Beállítja a scollbar helyét.
 * 
 * @param {Number} x A bal felső sarok x koordinátája.
 * @param {Number} y A bal felső sarok y koordinátája.
 * @returns {undefined}
 */
SVGScrollbar.prototype.setPosition = function(x, y) {
    this.scrollG
            .attr("transform", "translate(" + x + " " + y + ")");
};

/**
 * Beállítja a scrollbar által szkrollozott terület nagyságát, és a színét.
 * 
 * @param {Number} scrollPaneLength A scrollozott terület nagysága.
 * @param {String} color A scrollbar színe. Ha null vagy undefined, nem változik.
 * @param {Number} duration Az animáció időtartama.
 * @returns {undefined}
 */
SVGScrollbar.prototype.set = function(scrollPaneLength, color, duration) {

//    color = color || "red";
    this.scrollThumbLength = Math.min(this.length * this.length / scrollPaneLength, this.length);
    this.scrollRatio = this.length / scrollPaneLength;

    this.scrollG.classed("noEvents", (scrollPaneLength <= this.length) ? true : false);

    this.thumbStyle = {};
    this.gStyle = {};

    var oldX = parseFloat(this.scrollThumb.attr(this.positionStringToSet));
    var oldLength = parseFloat(this.scrollThumb.attr(this.lengthStringToSet));

    var newX = oldX * (this.length - this.scrollThumbLength) / (this.length - oldLength) || 0;

    // Ha változott a kijelzendőség, berakjuk az új opacityt a stílusobjektumba.
    var newOpacity = (scrollPaneLength <= this.length) ? 0 : 1;
    if (this.opacity !== newOpacity) {
        this.gStyle["opacity"] = newOpacity;
        this.opacity = newOpacity;
    }

    // Ha változott a szín, berakjuk az új színt a stílusobjektumba.
    if (this.color !== color && color !== null && color !== undefined) {
        this.thumbStyle["fill"] = color;
        this.color = color;
    }

    this.scrollThumb.transition().duration(duration)
            .attr(this.lengthStringToSet, this.scrollThumbLength + "px")
            .attr(this.positionStringToSet, newX + "px")
            .style(this.thumbStyle);

    this.scrollG.transition().duration(duration)
            .style(this.gStyle);

    this.scrollFunction(newX / this.scrollRatio);
};
