/* global d3 */

'use strict';

/**
 * Húzd-és-ejtsd réteg konstruktora.
 * 
 * @param {Integer} side A képernyő-oldal (0 vagy 1).
 * @param {Object} mediator Az oldalhoz tartozó mediátor.
 * @returns {Draglayer} A húzd-és-ejtsd réteg.
 */
function Draglayer(side, mediator) {
	var that = this;

	var container = d3.select("#container" + side);
	var isDragging = false;
	var dragCircle = container.append("html:div")
			.attr("class", "dragCircle");

	/**
	 * A réteg megfogásakor történő dolgok.
	 * 
	 * @param {Object} d Az elem, amit megragadtak.
	 * @returns {undefined}
	 */
	var dragStarted = function(d) {
		if (d3.event.sourceEvent.which === 1 && !isDragging) {
			var type = (d.value === undefined) ? 0 : 1; // 0: dimenzió, 1: érték.
			var background = d3.selectAll(this.parentNode.childNodes).filter(".backgroundCell");
			dragCircle.text(d.description);
			isDragging = true;
			d3.event.sourceEvent.stopPropagation();
			d3.selectAll("svg > *:not(.droptarget" + type + ")").style("pointer-events", "none");
			d3.select(this).classed("dragging", true);
			dragCircle
					.style(global.getStyleForScale(1, 1, 1))
					.style("opacity", 1)
					.style("display", "block")
					.style("margin-left", ((-parseFloat(dragCircle.style("width")) / 2) - 15) + "px")
					.style("background-color", background.style("background-color"))
					.style("color", background.style("color"));
			global.dragDropManager.draggedId = d.id;
			global.dragDropManager.draggedType = type;
			global.dragDropManager.draggedSide = side;
		}
	};

	/**
	 * A megfogott réteg húzásakor történő dolgok.
	 * 
	 * @returns {undefined}
	 */
	var dragging = function() {
		if (isDragging) {
			var coords = d3.mouse(container[0][0]);
			dragCircle
					.style("left", (coords[0] / global.scaleRatio) + "px")
					.style("top", (coords[1] / global.scaleRatio) + "px")
					.style("visibility", "visible");
			d3.select(dragCircle.node().parentNode).classed("dragging", true);
		}
	};

	/**
	 * A megfogott réteg elengedésénél történő dolgok.
	 * 
	 * @returns {undefined}
	 */
	var dragEnd = function() {
		if (d3.event.sourceEvent.which === 1 && isDragging) {
			var target = d3.select(global.dragDropManager.targetObject);
			if (!target.empty()) {
				if (global.dragDropManager.draggedType === 0) {
					mediator.publish("changeDimension", global.dragDropManager.targetPanelId, global.dragDropManager.draggedId, global.dragDropManager.targetId);
				} else if (global.dragDropManager.draggedType === 1) {
					mediator.publish("changeValue", global.dragDropManager.targetPanelId, global.dragDropManager.draggedId, undefined, global.dragDropManager.targetId);
				}
			}
			d3.select(this).classed("dragging", false);
			d3.selectAll("svg > *").style("pointer-events", null);
			var dragOrigX = parseInt(dragCircle.style("width")) / 2;
			var dragOrigY = parseInt(dragCircle.style("height")) / 2;
			dragCircle
					.style(global.getStyleForScale(1, dragOrigX, dragOrigY))
					.transition().duration(global.selfDuration / 2)
					.style(global.getStyleForScale(0, dragOrigX, dragOrigY))
					.style("opacity", 0)
					.each("end", function() {
						d3.select(this)
								.style("display", null)
								.style("visibility", null);
						isDragging = false;
					});
			global.dragDropManager.draggedId = null;
			global.dragDropManager.draggedType = null;
			global.dragDropManager.draggedSide = null;
			d3.select(dragCircle.node().parentNode).classed("dragging", false);
		}
	};

	// A drag-viselkedés definiálása.
	this.drag = d3.behavior.drag()
			.on("dragstart", dragStarted)
			.on("drag", dragging)
			.on("dragend", dragEnd);

	mediator.subscribe("addDrag", function(elements) {
		that.addDragBehavior(elements);
	});
}

/**
 * A draggolásra megjelölt elemekhez hozzáadjuk a drag-viselkedést.
 * 
 * @param {Array} elements
 * @returns {undefined}
 */
Draglayer.prototype.addDragBehavior = function(elements) {
	elements.call(this.drag);
};