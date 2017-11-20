'use strict'; // TODO: nyelv

/**
 * Létrehoz egy új reportot, és betölti a hozzá tartizó metát.
 * 
 * @param {Object} reportSuperMeta A reporthoz tartalmazó superMeta.
 * @param {Number} side Melyik oldalon van? (0 vagy 1)
 * @param {Function} callbackFunction A meghívandó függvény, ha kész a meta letöltése.
 * @param {Object} startObject Az indulást leíró objektum, ha a reportba nem a legfelső szinten lépünk be.
 * @returns {Fact}
 */
function Fact(reportSuperMeta, side, callbackFunction, callContext, startObject) {

    var that = this;
    this.callback = callbackFunction;
    this.callContext = callContext;
    this.side = side;

    this.reportMeta = undefined;
    this.reportSuperMeta = reportSuperMeta;

    // Reporthoz tartozó meták betöltése.
    global.get(global.url.meta, "cube_name=" + that.reportSuperMeta.name, function(result) {
        that.reportMetaReady.call(that, that.reportSuperMeta, result, startObject);
    });
}

/**
 * A meták betöltése után meghívandó függvény. Beállít néhány változót,
 * majd meghívja a fact callbackját.
 * 
 * @param {Object} reportSuperMeta A reporthoz tartozó superMeta.
 * @param {Json} reportMetaJson A reporthoz tartozó meta.
 * @param {Object} startObject Az indulást leíró objektum, ha a reportba nem a legfelső szinten lépünk be.
 * @returns {Fact.reportMetaReady}
 */
Fact.prototype.reportMetaReady = function(reportSuperMeta, reportMetaJson, startObject) {
    this.reportMeta = reportMetaJson;
    this.reportMeta.updated = reportSuperMeta.updated;
    this.reportMeta.caption = reportSuperMeta.caption;
    this.reportMeta.description = reportSuperMeta.description;
    this.reportMeta.datasource = reportSuperMeta.datasource;

    // A bázisszintet tartalmazó tömb kezdeti beállítása.
    for (var i = 0, iMax = this.reportMeta.dimensions.length; i < iMax; i++) {
        (global.baseLevels[this.side]).push([]); // Kezdetben a legfelsőbb szint a bázisszint.
    }
    if (startObject) {
        global.baseLevels[this.side] = startObject.b;
        this.reportMeta.visualization = startObject.v;
    }
    this.callback.call(this.callContext, this.side, this.reportMeta);

    // A dimenziók id-jének beállítása, tooltip beállítása;
    for (var i = 0, iMax = this.reportMeta.dimensions.length; i < iMax; i++) {
        this.reportMeta.dimensions[i].id = i;
    }

    // A mutatók id-jének beállítása, tooltip beállítása.
    for (var i = 0, iMax = this.reportMeta.indicators.length; i < iMax; i++) {
        this.reportMeta.indicators[i].id = i;
    }
};