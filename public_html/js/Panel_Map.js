/* global Panel, d3, topojson, mapOfHungary, pois */

'use strict';

var mappanel = panel_map;
/**
 * A térképi megjelenítő panel konstruktora.
 *  
 * @param {Object} init Inicializáló objektum.
 * @returns {mappanel} A mgekonstruált panel.
 */
function panel_map(init) {
	var that = this;

	this.constructorName = "panel_map";

	// Inicializáló objektum beolvasása, feltöltése default értékekkel.
	this.defaultInit = {group: 0, position: undefined, dim: 0, val: 0, ratio: false, domain: [], domainr: [], range: undefined, poi: false};
	this.actualInit = global.combineObjects(that.defaultInit, init);
	this.isColorsLocked = (that.actualInit.range !== undefined);

	Panel.call(that, that.actualInit, global.mediators[that.actualInit.group], true, 0, 0); // A Panel konstruktorának meghívása.

	// Ha a kért dimenzió nem ábrázolható, keresünk egy olyat, ami igen.
	if (that.meta.dimensions[that.actualInit.dim].is_territorial !== 1) {
		for (var d = 0, dMax = that.meta.dimensions.length; d < dMax; d++) {
			if (that.meta.dimensions[d].is_territorial === 1) {
				that.actualInit.dim = d;
				break;
			}
		}
	}

	this.valMultiplier = 1;						// A mutatott érték szorzója.
	this.dimToShow = that.actualInit.dim;		// A mutatott dimenzió.
	this.valToShow = that.actualInit.val;		// Az ennyiedik mutatót mutatja.
	this.valFraction = that.actualInit.ratio;	// Hányadost mutasson, vagy abszolútértéket?
	this.isPoiRequired = that.actualInit.poi;	// Kell-e POI?
	this.currentLevel;							// Az épp kirajzolt szint.
	this.maxDepth = that.meta.dimensions[that.dimToShow].levels.length - 1;	// Maximális lefúrási szint. 1: megye, 2: kistérség, 3: település

	this.imageCover = Math.min(that.width / that.w, that.height / that.h); // Ennyiszerese fedhető le a panelnek térképpel.

	// A színskála.
	this.colorScale = d3.scale.linear()
			.clamp(true);

	// A színskála alacsony, magas, és opcionálisan középső elemét tartalmazó tömb.
	this.colorRange;
	if (!that.isColorsLocked) {
		that.colorRange = [that.defaultColorMin, global.colorValue(that.valToShow), that.defaultColorMax];
	} else {
		that.colorRange = that.actualInit.range;
		if (that.colorRange.length === 2) {
			var mid = d3.scale.linear().domain([0, 1]).range(that.colorRange)(0.5);
			that.colorRange[2] = that.colorRange[1];
			that.colorRange[1] = mid;
		}
	}

	// A térképek felrajzolásához használt projekció.
	this.projection = d3.geo.mercator()
			.scale(30000)
			.center([19.5, 47.2])
			.translate([that.w / 2, that.height / 2 + that.margin.top]);

	// Görbegenerátor a térképrajzoláshoz.
	this.path = d3.geo.path()
			.projection(that.projection);

	// Alapréteg.
	that.svg.insert("svg:g", ".title_group")
			.attr("class", "background listener droptarget droptarget0")
			.on('click', function() {
				that.drill();
			})
			.on('mouseover', function() {
				that.hoverOn(this);
			})
			.on('mouseout', function() {
				that.hoverOff();
			})
			.append("svg:rect")
			.attr("width", that.w)
			.attr("height", that.h);

	// Színezett térkép rétege.
	this.gMapHolder = that.svg.insert("svg:g", ".title_group")
			.attr("class", "mapHolder");

	// Vízrajz rétege.
	this.gWater = that.svg.insert("svg:g", ".title_group")
			.attr("class", "mapHolder water noEvents");

	// Címkék rétege.
	this.gLabelHolder = that.svg.insert("svg:g", ".title_group")
			.attr("class", "mapHolder labels noEvents");

	// Poi-k rétege.
	this.gPoiHolder = that.svg.insert("svg:g", ".title_group")
			.attr("class", "mapHolder pois");

	// Poi jelkulcs rétege.
	this.gPoiLegend = that.svg.insert("svg:g", ".title_group")
			.attr("class", "gPoiLegend");

	// Jelkulcs rétege.
	this.gLegend = that.svg.insert("svg:g", ".title_group")
			.attr("class", "legend noEvents");

	// A zoomolásnál nem kellő elmeket kitakaró maszk.
	this.mask = that.svg.append("svg:mask")
			.attr("id", "maskurl" + that.panelId);

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

	// Kezdeti magyarország kirajzolása.
	var box = that.path.bounds((topojson.feature(that.topology, that.topoLevel(that.topology.objects.level0)).features)[0]);
	var scalemeasure = that.imageCover / Math.max((box[1][0] - box[0][0]) / that.w, (box[1][1] - box[0][1]) / that.h);
	that.svg.selectAll(".mapHolder")
			.attr("transform",
					"translate(" + that.projection.translate() + ")" +
					"scale(" + scalemeasure + ")" +
					"translate(" + -(box[1][0] + box[0][0]) / 2 + "," + -(box[1][1] + box[0][1]) / 2 + ")");

	// Vízréteg kirajzolása.
	that.gWater.selectAll("path").data(topojson.feature(that.topology, that.topology.objects.viz).features)
			.enter().append("svg:path")
			.attr("class", function(d) {
				return d.geometry.type;
			})
			.attr("d", that.path)
			.attr("mask", "url(#maskurl" + that.panelId + ")");
}

//////////////////////////////////////////////////
// Osztály-konstansok inicializálása.
//////////////////////////////////////////////////

{
	panel_map.prototype = global.subclassOf(Panel);	// A Panel metódusainak átvétele.

	panel_map.prototype.mapLabelSize = 10;			// a térképre helyezendő feliratok betűmérete.
	panel_map.prototype.poiLegendRadius = 10;		// A jelölő jelkulcsbeli sugara;
	panel_map.prototype.mapLabelOpacity = 0.8;		// A térképre helyezendő feliratok átlátszósága.
	panel_map.prototype.legendTicks = 7;			// A jelkulcs kívánatos elemszáma. Kb. ennyi is lesz.
	panel_map.prototype.defaultColorMin = 'white';	// Az alapértelmezett skála minimumszíne.
	panel_map.prototype.defaultColorMax = 'black';	// Az alapértelmezett skála maximumszíne.
	panel_map.prototype.poiLegendWidth = 140;		// A poi-jelkulcs téglalapjának szélessége.
	panel_map.prototype.poiLegendHeight = 30;		// Egy elem magassága a poi-jelkulcson.

	panel_map.prototype.topology = mapOfHungary;	// Magyarország térképi réteg.
	panel_map.prototype.pois = pois;				// POI térképi réteg.
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
panel_map.prototype.valueToShow = function(d) {
	var that = this;
	if (d !== undefined && d.vals !== undefined) {
		var val = (that.valFraction) ? that.valMultiplier * d.vals[that.valToShow].sz / d.vals[that.valToShow].n : d.vals[that.valToShow].sz;
		if (isNaN(parseInt(val))) {
			val = 0;
		}
		return val;
	} else {
		return null;
	}
};

/**
 * Legyártja az elemhez tartozó tooltipet.
 * 
 * @param {Object} d Az elem.
 * @returns {String} A megjelenítendő tooltip.
 */
panel_map.prototype.getTooltip = function(d) {
	var that = this;
	return that.createTooltip(
			[{
					name: that.meta.dimensions[that.dimToShow].description,
					value: (d.name) ? d.name : "Nincs adat"
				}],
			[{
					name: that.meta.indicators[that.valToShow].description,
					value: d.value,
					dimension: ((that.valFraction) ? that.meta.indicators[that.valToShow].fraction.unit : that.meta.indicators[that.valToShow].value.unit)
				}]
			);
};

/**
 * Egy értékhez hozzárendeli az őt kódoló színt, illetve undefiendhez a semlegest.
 * 
 * @param {Number} val A reprezentálandó érték.
 * @returns {String} Az őt repreentáló szín.
 */
panel_map.prototype.colorLinear = function(val) {
	return (!isNaN(val)) ? this.colorScale(val) : global.colorNA;
};

/**
 * Beállítja az értékek ábrázolását lehetővé tevő színskálát.
 * 
 * @param {Number} dMin A minimális megjelenítendő érték.
 * @param {Number} dMed A megjelenítendő középérték.
 * @param {Number} dMax A maximális megjelenítendő érték.
 * @returns {undefined}
 */
panel_map.prototype.setColorRange = function(dMin, dMed, dMax) {
	var that = this;
	var actualScaleDomain = (that.valFraction) ? that.actualInit.domainr : that.actualInit.domain;
	if (!(actualScaleDomain instanceof Array) || actualScaleDomain.length < 2) {
		that.colorScale.domain([dMin, dMed, dMax])
				.range(that.colorRange);
	} else if (actualScaleDomain.length === 2) {
		that.colorScale.domain(actualScaleDomain)
				.range([that.colorRange[0], that.colorRange[2]]);
	} else {
		that.colorScale.domain(actualScaleDomain)
				.range(that.colorRange);
	}
	that.colorScale.nice(that.legendTicks);
};

/**
 * Megkeresi egy zoomszinthez tartozó térképi elemeket.
 * 
 * @param {Integer} level A zoomszint.
 * @returns {Json} Hozzá tartozó térképi elemkupac.
 */
panel_map.prototype.topoLevel = function(level) {
	switch (level) {
		case 1:
			return (this.maxDepth >= 1) ? this.topology.objects.level1 : this.topology.objects.level0;
			break;
		case 2:
			return (this.maxDepth >= 2) ? this.topology.objects.level2 : this.topology.objects.level1;
			break;
		case 3:
			return (this.maxDepth >= 3) ? this.topology.objects.level3 : this.topology.objects.level2;
			break;
		case 4:
			return this.topology.objects.level3;
			break;
		default:
			return this.topology.objects.level0;
			break;
	}
};

/**
 * Megkeresi egy térképi elem-kupac közös szülőelemét a knownId-ja alapján. TODO: nem megy egyszerűbben?
 * 
 * @param {Array} dataRows A térképi elemeket leíró adattömb.
 * @returns {panel_map.prototype.getParent.parentObj} A szülő térképi elem.
 */
panel_map.prototype.getParent = function(dataRows) {
	if (dataRows.length > 0) {
		// Vesszük az adatkupac első elemét. Ha az épp N/A, akkor a másodikat. TODO: Itt most gányolás van!!! Ki kéne javítani.
		var shapeId = (dataRows[0].dims[0].knownId !== "N/A") ? dataRows[0].dims[0].knownId : (dataRows.length > 1) ? dataRows[1].dims[0].knownId : undefined;
		var parentObj;
		for (var level = 0; level <= 3; level++) {
			var thisObj = topojson.feature(this.topology, this.topoLevel(level)).features.filter(function(d) {
				return shapeId === d.properties.shapeid;
			});
			if (thisObj.length > 0) {
				parentObj = topojson.feature(this.topology, this.topoLevel(level - 1)).features.filter(function(d) {
					return thisObj[0].properties.parent === d.properties.shapeid;
				});
				break;
			}
		}
	}
	return (parentObj === undefined) ? undefined : parentObj[0];
};

/**
 * Megkeres egy térképi element a knownId-ja alapján.
 * 
 * @param {String} shapeId A keresett elem knownId-ja.
 * @returns {Feature} A térképi elem.
 */
panel_map.prototype.getSelf = function(shapeId) {
	for (var level = 0; level <= 3; level++) {
		var thisObj = topojson.feature(this.topology, this.topoLevel(level)).features.filter(function(d) {
			return shapeId === d.properties.shapeid;
		});
		if (thisObj.length > 0) {
			break;
		}
	}
	return thisObj[0];
};


/**
 * Eldönti, hogy egy szélesség, hosszúság koordinátákkal adott pont egy
 * térképi (multi)poligonban van-e.
 * 
 * @param {Number} lon A pont hosszúsága.
 * @param {Number} lat A pont szélessége.
 * @param {type} feature A poligont tartalmazó objektum.
 * @returns {Boolean} True ha benne van, false ha nem.
 */
panel_map.prototype.isInMultiPolygon = function(lon, lat, feature) {
	var inside = false;
	if (feature !== undefined && feature.geometry !== undefined) {
		var coordinates = feature.geometry.coordinates;

		var x = Math.round(lon * 1000000000) + 0.5;
		var y = Math.round(lat * 1000000000) + 0.5;
		for (var p = 0, pMax = coordinates.length; p < pMax; p++) {
			var polygon = coordinates[p];
			for (var q = 0, qMax = polygon.length - 1; q < qMax; q++) {
				var x0 = Math.round(polygon[q][0] * 1000000000);
				var y0 = Math.round(polygon[q][1] * 1000000000);
				var x1 = Math.round(polygon[q + 1][0] * 1000000000);
				var y1 = Math.round(polygon[q + 1][1] * 1000000000);
				if (((y1 > y) !== (y0 > y)) && (x < (x0 - x1) * (y - y1) / (y0 - y1) + x1)) {
					inside = !inside;
				}
			}
		}
	}
	return inside;
};

/**
 * Kiszámolja, hogy mennyit kéne a nagyítást módosítani, hogy a poi jelkulcsa ne fedje
 * a megadott pontot.
 * 
 * @param {Number} centerDX A pont X koordinátájának a panel középpontjától való eltérése.
 * @param {Number} centerDY A pont Y koordinátájának a panel középpontjától való eltérése.
 * @param {Number} poiLegendX A poi jelkulcs bal felső csücskének X koordinátája.
 * @param {Number} poiLegendY A poi jelkulcs bal felső csücskének Y koordinátája.
 * @returns {Number} A nagyítás szorzója.
 */
panel_map.prototype.scaleModifier = function(centerDX, centerDY, poiLegendX, poiLegendY) {
	var modifier = 1;
	if ((this.w / 2) + centerDX > poiLegendX && (this.h / 2) + centerDY > poiLegendY) {
		modifier = Math.max((poiLegendX - this.w / 2) / centerDX, (poiLegendY - this.h / 2) / centerDY);
	}
	return modifier;
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
panel_map.prototype.preUpdate = function(drill) {
	var that = this;

	// Lefúrás esetén az adott objektum kivételével mindent törlünk.
	if (drill.direction === -1) {

		// Ha vannak megjelenített poi-k, letöröljük, ami kívül esik a lefúrás célján.
		if (that.isPoiRequired) {

			// Kiszedjük a lefúrás céljának a shape-ét.
			var toFeature;
			if (that.data !== undefined) {
				for (var i = 0, iMax = that.data.rows.length; i < iMax; i++) {
					var dim = that.data.rows[i].dims[0];
					if (dim.id === drill.toId) {
						var toFeature = that.getSelf(dim.knownId);
						break;
					}
				}
			}

			// Letöröljük a kívül eső poi-kat.
			that.gPoiHolder.selectAll(".gPoi g").filter(function(d) {
				return !that.isInMultiPolygon(d.lon, d.lat, toFeature);
			})
					.remove();
		}

		// Letöröljük a kívül eső területeket.
		that.gMapHolder.selectAll("path").filter(function(d) {
			return (d.id !== drill.toId);
		})
				.on("click", null)
				.remove();

		// A vízrajz maszkját leszűkítjük a mutatott területre.
		that.mask.selectAll("path").filter(function(d) {
			return (d.id !== drill.toId);
		}).remove();

	}

	// Ha a dimenzióban történt a változás, akkor az aktuális név kivételével minden nevet törlünk.
	if (that.dimToShow === drill.dim && that.currentLevel !== that.maxDepth + 1) {
		that.gLabelHolder.selectAll(".mapLabel").filter(function(d) {
			return (d.id !== drill.toId);
		}).remove();
	}
};

/**
 * Az új adat előkészítése. A megjelenítésre kerülő térképi elemekhez
 * hozzárakja a megjelenítendő adatokat.
 * 
 * @param {Array} newDataRows Az új adatsorokat tartalmazó tömb.
 * @returns {Object} .data: a térképi elemek az adatokkal, .scale: szükséges nagyítás, .origin: a középpont.
 */
panel_map.prototype.prepareData = function(newDataRows) {
	var that = this;

	// Ha nincs térképen ábrázolható adat, akkor üres választ adunk.
	if (newDataRows.length === 0 || (newDataRows[0].dims[0].knownId === "N/A" && newDataRows.length === 1)) {
		return undefined;

		// Különben valódit.
	} else {

		// Ha poi-kijelzés van, akkor a jelkulcsdoboz (annál egy picit nagyobb) bal felső pontját meghatározzuk.
		if (that.isPoiRequired) {
			var poiLegendX = that.w - that.poiLegendWidth - global.legendOffsetX - 20;
			var poiLegendY = that.h - 2 * global.legendOffsetY - global.legendHeight - that.pois.length * that.poiLegendHeight - 20;
		}

		// Az épp kirajzolandó területek parent-je.
		var parentShape = (that.currentLevel !== that.maxDepth + 1) ? that.getParent(newDataRows) : that.getSelf(newDataRows[0].dims[0].knownId);
		if (parentShape === undefined) {
			return undefined;
		} else {
			var extent = that.path.bounds(parentShape);
			var scalemeasure = that.imageCover / Math.max((extent[1][0] - extent[0][0]) / that.w, (extent[1][1] - extent[0][1]) / that.h);

			// A kirajzolandó térképi elemek adatainak megszerzése.
			var featuresToDraw = topojson.feature(that.topology, that.topoLevel(that.currentLevel)).features.filter(function(d) {
				return parentShape.properties.shapeid === ((that.currentLevel === that.maxDepth + 1) ? d.properties.shapeid : d.properties.parent);
			});

			var pairedData = [];
			var bounds = that.path.bounds;
			featuresToDraw.map(function(d) {
				for (var w = 0, wMax = newDataRows.length; w < wMax; w++) {
					if (newDataRows[w].dims[0].knownId === d.properties.shapeid) {
						var datarow = newDataRows[w];
						var b = bounds(d);
						var element = {};
						element.geometry = d.geometry;
						element.properties = d.properties;
						element.type = d.type;
						element.id = datarow.dims[0].id;
						element.uniqueId = that.currentLevel + "L" + element.id;
						element.name = datarow.dims[0].name.trim();
						element.value = that.valueToShow(datarow);
						element.centerX = (b[1][0] + b[0][0]) / 2;
						element.centerY = (b[1][1] + b[0][1]) / 2;
						element.tooltip = that.getTooltip(element);
						pairedData.push(element);

						// Ha poi kijelzés is van, akkor módosítjuk a nagyítást, hogy ne nagyon lógjon a jelkulcsba.
						if (that.isPoiRequired) {
							var tempDX = scalemeasure * (element.centerX - (extent[1][0] + extent[0][0]) / 2);
							var tempDY = scalemeasure * (element.centerY - (extent[1][1] + extent[0][1]) / 2);
							scalemeasure = scalemeasure * that.scaleModifier(tempDX, tempDY, poiLegendX, poiLegendY);
						}

						break;
					}
				}
			});
			return {data: pairedData, scale: scalemeasure, origin: -(extent[1][0] + extent[0][0]) / 2 + "," + -(extent[1][1] + extent[0][1]) / 2};
		}
	}
};

panel_map.prototype.preparePoiData = function(rawPois, newDataRows) {
	var that = this;

	var parentShape = (that.currentLevel !== that.maxDepth + 1) ? that.getParent(newDataRows) : that.getSelf(newDataRows[0].dims[0].knownId);

	var preparedPois = [];
	for (var p = 0, pMax = rawPois.length; p < pMax; p++) {
		var rawPoi = rawPois[p];

		var preparedPoi = [];
		preparedPoi.caption = rawPoi.caption;
		preparedPoi.description = rawPoi.description;
		preparedPoi.color = (rawPoi.color === parseInt(rawPoi.color, 10)) ? global.colorValue(rawPoi.color) : rawPoi.color;
		preparedPoi.symbol = rawPoi.symbol;
		preparedPoi.points = [];
		for (var i = 0, iMax = rawPoi.points.length; i < iMax; i++) {
			var rawPoint = rawPoi.points[i];
			if (rawPoint.levels.indexOf(this.currentLevel) > -1) {
				if (that.isInMultiPolygon(rawPoint.lon, rawPoint.lat, parentShape)) {
					preparedPoi.points.push({
						uniqueId: rawPoint.caption + "L" + this.currentLevel,
						caption: rawPoint.caption,
						description: rawPoint.description, // TODO: Tooltip, vagy törölni.
						symbol: preparedPoi.symbol,
						size: rawPoint.size, // TODO: itt elvégzezni a számolást.
						lat: rawPoint.lat,
						lon: rawPoint.lon,
						coordinates: this.projection([rawPoint.lon, rawPoint.lat]),
						color: preparedPoi.color,
						tooltip: "<em>" + ((rawPoint.description === undefined) ? rawPoint.caption : rawPoint.description) + "</em>"
					});
				}
			}
		}
		preparedPois.push(preparedPoi);

	}
	return preparedPois;
};

/**
 * Új adat megérkeztekor elvégzi a panel frissítését.
 * 
 * @param {Array} data Az új adat.
 * @param {Object} drill Az épp végrehajzásra kerülő fúrás.
 * @returns {undefined}
 */
panel_map.prototype.update = function(data, drill) {
	var that = this;
	that.data = data || that.data;
	drill = drill || {dim: -1, direction: 0};

	// A hányados kijelzés, és a szorzó felfrissítése.
	if (that.valFraction && that.meta.indicators[that.valToShow].fraction.hide) {
		that.valFraction = false;
	}
	if (!that.valFraction && that.meta.indicators[that.valToShow].value.hide) {
		that.valFraction = true;
	}
	that.valMultiplier = (isNaN(parseFloat(that.meta.indicators[that.valToShow].fraction.multiplier))) ? 1 : parseFloat(that.meta.indicators[that.valToShow].fraction.multiplier);

	var tweenDuration = global.getAnimDuration(-1, that.panelId);

	that.currentLevel = (global.baseLevels[that.panelSide])[this.dimToShow].length + 1;

	var preparedData = that.prepareData(that.data.rows);

	// Ha van megjeleníthető adat, megjelenítjük.
	if (preparedData) {
		that.panic(false);

		// A színskála beállítása.
		var dataExtent = d3.extent(preparedData.data, function(d) {
			return d.value;
		});
		var dataMed = (dataExtent[0] * dataExtent[1] < 0) ? 0 : (dataExtent[0] + dataExtent[1]) / 2;
		that.setColorRange(dataExtent[0], dataMed, dataExtent[1]);

		// A rajzoló függvények meghívása.
		that.drawMap(preparedData, drill, tweenDuration);

		that.drawLabels(preparedData, tweenDuration);
		that.drawLegend(tweenDuration);

		// Ha poi-kra is szükség van, kirajzoljuk.
		if (that.isPoiRequired) {
			that.drawPois(preparedData, that.preparePoiData(that.pois, that.data.rows), tweenDuration);
			that.drawPoiLegend(tweenDuration);
		}

		// A szükséges ki-bezoomolás az összes rétegen.
		if (drill.direction !== 0 || drill.dim < 0) {
			that.svg.selectAll(".mapHolder").transition().duration(tweenDuration)
					.attr("transform",
							"translate(" + that.projection.translate() + ")" +
							"scale(" + preparedData.scale + ")" +
							"translate(" + preparedData.origin + ")");
		}

		// Különben pánik!	
	} else {
		that.panic(true, "<html>Az adat térképen nem megjeleníthető.</html>");
	}

	// Fejléc felfrissítése.
	var titleMeta = that.meta.indicators[that.valToShow];
	that.titleBox.update(that.valToShow, titleMeta.caption, titleMeta.value.unit, titleMeta.fraction.unit, that.valFraction, tweenDuration);
};

/**
 * Kirajzolja a színezett területeket.
 * 
 * @param {Object} currentFeatures A kirajzolandó térképi adatok.
 * @param {Object} drill Az épp végrehajtott fúrás.
 * @param {Number} tweenDuration Az animáció ideje.
 * @returns {undefined}
 */
panel_map.prototype.drawMap = function(currentFeatures, drill, tweenDuration) {
	var that = this;

	var terrains = that.gMapHolder.selectAll(".subunit").data(currentFeatures.data, function(d) {
		return d.uniqueId;
	});

	// Kilépő területek eltüntetése.
	terrains.exit()
			.on("click", null)
			.classed("darkenable", false)
			.transition().duration(tweenDuration)
			.attr("opacity", 0)
			.remove();

	// Új területek kirajzolása.
	terrains.enter().append("svg:path")
			.attr("class", "subunit listener")
			.attr("d", that.path)
			.attr("fill", function(d) {
				return that.colorLinear(d.value);
			})
			.attr("stroke-width", global.mapBorder / currentFeatures.scale)
			.attr("opacity", 0);

	// Maradó területek animálása.
	terrains.on("click", function(d) {
		that.drill(d);
	})
			.transition().duration(tweenDuration)
			.attr("fill", function(d) {
				return that.colorLinear(d.value);
			})
			.attr("opacity", 1)
			.each('end', function() {
				d3.select(this).classed("darkenable", true);
			});

	// Fel vagy lefúrás esetén, vagy üresből rajzoláskor felfrissítjük a vízréteg maszkját.
	if (drill.direction !== 0 || drill.dim < 0) {

		var mask = that.mask.selectAll("path").data(currentFeatures.data, function(d) {
			return d.uniqueId;
		});

		mask.enter().append("svg:path")
				.attr("d", that.path)
				.attr("opacity", (drill.direction === -1) ? 1 : 0)
				.transition().duration((drill.direction === 1) ? tweenDuration : 0)
				.attr("opacity", 1);

		mask.exit().transition()
				.delay((drill.direction === 1) ? tweenDuration : 0)
				.duration((drill.direction === 1) ? 0 : tweenDuration)
				.attr("opacity", 0)
				.remove();
	}
};

/**
 * Kirajzolja a térkép feliratait.
 * 
 * @param {Object} currentFeatures A kirajzolandó térképi adatok.
 * @param {Number} tweenDuration Az animáció ideje.
 * @returns {undefined}
 */
panel_map.prototype.drawLabels = function(currentFeatures, tweenDuration) {
	var that = this;

	var labels = that.gLabelHolder.selectAll(".mapLabel").data(currentFeatures.data, function(d) {
		return d.id + "N" + d.name;
	})
			.moveToFront();

	labels.transition().duration(tweenDuration)
			.attr("fill", function(d) {
				return global.readableColor(that.colorLinear(d.value));
			});

	labels.exit()
			.transition().duration(tweenDuration)
			.attr("opacity", 0)
			.remove();

	labels.enter().append("svg:text")
			.attr("class", "mapLabel")
			.attr("text-anchor", "middle")
			.attr("x", function(d) {
				return d.centerX;
			})
			.attr("y", function(d) {
				return d.centerY;
			})
			.attr("fill", function(d) {
				return global.readableColor(that.colorLinear(d.value));
			})
			.attr("opacity", 0)
			.text(function(d) {
				return d.name;
			})
			.style("font-size", (that.mapLabelSize / currentFeatures.scale) + "px")
			.transition().duration(tweenDuration)
			.attr("opacity", that.mapLabelOpacity);
};

/**
 * Felrakja a poi-kat a poi-rétegre.
 * 
 * @param {Object} currentFeatures A kirajzolandó térképi adatok.
 * @param {Object} pois A felrajzolandó poi-k.
 * @param {Number} tweenDuration Az animáció ideje.
 * @returns {undefined}
 */
panel_map.prototype.drawPois = function(currentFeatures, pois, tweenDuration) {
	var that = this;

	var gPoi = that.gPoiHolder.selectAll(".gPoi").data(pois);

	gPoi.enter().append("svg:g")
			.attr("class", function(d, i) {
				return "gPoi inactive gPoi" + i;
			});

	var gPoint = gPoi.selectAll("g").data(function(d) {
		return d.points;
	}, function(d2) {
		return d2.uniqueId;
	});

	var newGPoi = gPoint.enter().append("svg:g");

	gPoint.exit().transition().duration(tweenDuration)
			.attr("opacity", 0)
			.remove();

	newGPoi.attr("transform", function(d) {
		return "translate(" + d.coordinates[0] + ", " + d.coordinates[1] + ")";
	})
			.attr("opacity", 0);

	newGPoi.append("svg:path")
			.attr("d", function(d) {
				return d3.svg.symbol().type(d3.svg.symbolTypes[d.symbol]).size((d.size / currentFeatures.scale) * (d.size / currentFeatures.scale))();
			})
			.attr("fill", function(d) {
				return d.color;
			});

	newGPoi.append("svg:text")
			.attr("y", function(d) {
				return -d.size / currentFeatures.scale / 1.8;
			})
			.attr("dy", "-0.35em")
			.attr("text-anchor", "middle")
			.text(function(d) {
				return d.caption;
			})
			.style("font-size", (that.mapLabelSize / currentFeatures.scale) + "px");

	newGPoi.transition().duration(tweenDuration)
			.attr("opacity", 1);

};

/**
 * Kirajzolja a POI-k jelkulcsát.
 * 
 * @param {Number} tweenDuration A megjelenési animáció ideje.
 * @returns {undefined}
 */
panel_map.prototype.drawPoiLegend = function(tweenDuration) {
	var that = this;

	// Csak ha üres még a jelkulcs, ez ugyanis nem változhat.
	if (that.gPoiLegend.selectAll(".poiLegend").empty()) {

		for (var i = 0, iMax = that.pois.length; i < iMax; i++) {
			that.pois[i].tooltip = "<h4>" + that.pois[i].description + "</h4>";
		}

		var gPoiLegend = that.gPoiLegend
				.attr("transform", "translate(" +
						(that.w - that.poiLegendWidth - global.legendOffsetX) +
						", " +
						(that.h - 2 * global.legendOffsetY - global.legendHeight - that.pois.length * that.poiLegendHeight) +
						")")
				.style("opacity", 0);

		// A jelkulcs megjelenési animációja.
		gPoiLegend
				.transition().duration(tweenDuration)
				.style("opacity", 1);

		// Az alaptéglalap.
		gPoiLegend
				.append("svg:rect")
				.attr("class", "bordered")
				.attr("rx", global.rectRounding)
				.attr("ry", global.rectRounding)
				.attr("width", that.poiLegendWidth)
				.attr("height", that.pois.length * that.poiLegendHeight);

		// Belépő jelkulcselemek, az adatok hozzátársítása.
		var legendEntry = that.gPoiLegend.selectAll("g")
				.data(that.pois).enter();

		var gLegend = legendEntry.append("svg:g")
				.attr("class", function(d, i) {
					return "listener inactive poiLegend legendControl" + i;
				})
				.attr("transform", function(d, i) {
					return "translate(0, " + i * that.poiLegendHeight + ")";
				})
				.on("mouseover", function(d, i) {
					if (!d3.select(this).classed("inactive")) {
						that.gLabelHolder.classed("opaque", true);
						that.gPoiHolder.selectAll(".gPoi" + i).classed("opaque", false).classed("noText", false);
						that.gPoiHolder.selectAll(".gPoi:not(.gPoi" + i + ")").classed("opaque", true);
					}
				})
				.on("mouseout", function() {
					that.gLabelHolder.classed("opaque", false);
					that.gPoiHolder.selectAll(".gPoi").classed("opaque", false);
					that.gPoiHolder.selectAll(".gPoi").classed("noText", true);
				})
				.on("click", function(d, i) {
					that.tooglePoi(i);
				});

		// A jelkulcs-téglalap kirajzolása.
		gLegend.append("svg:rect")
				.attr("rx", global.rectRounding)
				.attr("ry", global.rectRounding)
				.attr("width", that.poiLegendWidth)
				.attr("height", that.poiLegendHeight);

		// Jelölő maga.
		gLegend.append("svg:path")
				.attr("class", "lineSymbol legend noEvents")
				.attr("d", function(d) {
					return d3.svg.symbol().type(d3.svg.symbolTypes[d.symbol]).size(that.poiLegendRadius * that.poiLegendRadius)();
				})
				.attr("fill", function(d) {
					return (d.color === parseInt(d.color, 10)) ? global.colorValue(d.color) : d.color;
				})
				.attr("transform", "translate(" + (that.poiLegendRadius + 5) + ", " + (that.poiLegendHeight / 2) + ")");

		// A jelkulcs-szöveg kiírása.
		var legendText = gLegend.append("svg:text")
				.attr("class", "legend noEvents")
				.attr("text-anchor", "beginning")
				.attr("x", 2 * (that.poiLegendRadius + 5))
				.attr("y", (that.poiLegendHeight / 2))
				.attr("dy", ".35em")
				.text(function(d) {
					return d.caption;
				});

		// Jelkulcs-szövegek formázása, hogy beférjenek.
		global.cleverCompress(legendText, panel_map.prototype.poiLegendWidth - (2 * that.poiLegendRadius + 20), 1, undefined);

	}

};

/**
 * Jelkulcs felrajzolása a térkép alá.
 * 
 * @param {Number} tweenDuration Az animáció ideje.
 * @returns {undefined}
 */
panel_map.prototype.drawLegend = function(tweenDuration) {
	var that = this;

	// A jelkulcsban megjelenő értékek.
	var domain = that.colorScale.ticks(that.legendTicks);
	if (domain.length === 0) {
		domain = [that.colorScale.domain()[0]];
	}

	var elementWidth = that.legendWidth / domain.length;
	var elementHeight = global.legendHeight;

	// A régi jelkulcs téglalapjainak és szövegének leszedése, de csak ha az új már föléje került.
	that.gLegend.selectAll("path, text")
			.transition().delay(tweenDuration).duration(0)
			.remove();

	// Új jelkulcs felrajzolása.
	that.gLegend.selectAll().data(domain)
			.enter().append("svg:path")
			.attr("class", "bordered")
			.attr("d", function(d, i) {
				return global.rectanglePath(
						i * elementWidth + global.legendOffsetX, // x
						that.h - elementHeight - global.legendOffsetY, // y
						(i === domain.length - 1) ? elementWidth : elementWidth + 1, // width
						elementHeight, // height
						(i === 0) ? global.rectRounding : 0, // balfelső roundsága
						(i === domain.length - 1) ? global.rectRounding : 0, // jobbfelső
						(i === domain.length - 1) ? global.rectRounding : 0, // jobbalsó
						(i === 0) ? global.rectRounding : 0); // balalsó
			})
			.attr("fill", that.colorScale)
			.attr("opacity", 0)
			.transition().duration(tweenDuration)
			.attr("opacity", 1);

	// A jelkulcs szövegének kiírása.
	that.gLegend.selectAll().data(domain)
			.enter().append("svg:text")
			.attr("text-anchor", "middle")
			.attr("x", function(d, i) {
				return (i * elementWidth + elementWidth / 2 + global.legendOffsetX);
			})
			.attr("y", that.h - elementHeight / 2 - global.legendOffsetY)
			.attr("dy", ".35em")
			.attr("fill", function(d) {
				return global.readableColor(that.colorScale(d));
			})
			.attr("opacity", 0)
			.text(function(d, i) {
				return global.cleverRound3(domain[i]);
			})
			.transition().duration(tweenDuration)
			.attr("opacity", 1);
};

//////////////////////////////////////////////////
// Irányítást végző függvények
//////////////////////////////////////////////////

/**
 * Poi-k ki és bekapcsolása.
 * 
 * @param {Integer} i A ki/bekapcsolandó poi sorszáma.
 * @returns {undefined}
 */
panel_map.prototype.tooglePoi = function(i) {
	var poiControl = this.gPoiLegend.select(".legendControl" + i);
	var state = !poiControl.classed("inactive");	// True: most kapcsolják le, false: most fel.
	poiControl.classed("inactive", state);
	this.gPoiHolder.select(".gPoi" + i).classed("inactive", state);
	this.gPoiHolder.select(".gPoi" + i).classed("noText", state);
	this.gLabelHolder.classed("opaque", !state);
	this.gPoiHolder.selectAll(".gPoi").classed("opaque", false);
};

/**
 * Az aktuális dimenzióban történő le vagy felfúrást kezdeményező függvény.
 * 
 * @param {Object} d Lefúrás esetén a lefúrás céleleme. Ha undefined, akkor felfúrásról van szó.
 * @returns {undefined}
 */
panel_map.prototype.drill = function(d) {
	global.tooltip.kill();
	var drill = {
		dim: this.dimToShow,
		direction: (d === undefined) ? 1 : -1,
		toId: (d === undefined) ? undefined : d.id,
		toName: (d === undefined) ? undefined : d.name
	};
	this.mediator.publish("drill", drill);
};

/**
 * A mutató- és hányadosválasztást végrehajtó függvény.
 * 
 * @param {String} panelId A váltást végrehajtó panel azonosítója. Akkor vált, ha az övé, vagy ha undefined.
 * @param {Integer} value Az érték, amire váltani kell. Ha -1 akkor a következőre vált, ha undefined, nem vált.
 * @param {boolean} ratio Hányadost mutasson-e. Ha -1 akkor a másikra ugrik, ha undefined, nem vált.
 * @returns {undefined}
 */
panel_map.prototype.doChangeValue = function(panelId, value, ratio) {
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
		if (!that.isColorsLocked) {
			that.colorRange = [that.defaultColorMin, global.colorValue(that.valToShow), that.defaultColorMax];
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
panel_map.prototype.doChangeDimension = function(panelId, newDimId) {
	var that = this;
	if (panelId === that.panelId) {
		if (that.meta.dimensions[newDimId].is_territorial === 1) {
			that.dimToShow = newDimId;
			that.actualInit.dim = that.dimToShow;
			that.mediator.publish("register", that, that.panelId, [that.dimToShow], that.preUpdate, that.update, that.getConfig);
			global.tooltip.kill();
			that.currentLevel = undefined;
			this.maxDepth = that.meta.dimensions[that.dimToShow].levels.length - 1;
			this.mediator.publish("drill", {dim: -2, direction: 0, toId: undefined});
		}
	}
};