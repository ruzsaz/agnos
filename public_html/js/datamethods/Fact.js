'use strict';

/**
 * Létrehoz egy új reportot, és betölti a hozzá tartizó metát.
 * 
 * @param {Object} reportSuperMeta A reporthoz tartalmazó superMeta.
 * @param {Number} side Melyik oldalon van? (0 vagy 1)
 * @param {Function} callbackFunction A meghívandó függvény, ha kész a meta letöltése.
 * @param {Object} callContext A meghívandó függvénynél a this-context.
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
    global.get(global.url.meta, "cube_name=" + window.btoa(that.reportSuperMeta.name + ":" + String.locale), function(result) {
        that.reportMetaReady.call(that, that.reportSuperMeta, result, startObject);
    });
}
;

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

    // A report metáját kiegészítjük a supermeta rá vonatkozó részével.
    this.reportMeta = reportMetaJson;
    for (var i = 0, iMax = this.reportMeta.localizedReports.length; i < iMax; i++) {
        var localizedMeta = this.reportMeta.localizedReports[i];
        var lang = localizedMeta.language;
        var localizedSuperMeta = global.getFromArrayByLang(reportSuperMeta.localizedReports, lang);
        localizedMeta.updated = localizedSuperMeta.updated;
        localizedMeta.caption = localizedSuperMeta.caption;
        localizedMeta.description = localizedSuperMeta.description;
        localizedMeta.datasource = localizedSuperMeta.datasource;
    }

    // A default nyelv beállításait hozzáadjuk nyersen a metához.
    var defaultMeta = global.getFromArrayByLang(this.reportMeta.localizedReports, "");
    for (var property in defaultMeta) {
        if (defaultMeta.hasOwnProperty(property)) {
            this.reportMeta[property] = defaultMeta[property];
        }
    }

    // A bázisszintet tartalmazó tömb kezdeti beállítása.
    for (var i = 0, iMax = this.getLocalMeta().dimensions.length; i < iMax; i++) {
        (global.baseLevels[this.side]).push([]); // Kezdetben a legfelsőbb szint a bázisszint.
    }
    if (startObject) {
        global.baseLevels[this.side] = startObject.b;
        for (var i = 0, iMax = this.reportMeta.localizedReports.length; i < iMax; i++) {
            this.reportMeta.localizedReports[i].visualization = startObject.v;
        }
        this.reportMeta.visualization = startObject.v;
    }
    this.callback.call(this.callContext, this.side, this.reportMeta);

    // A dimenziók id-jének beállítása, tooltip beállítása;
    for (var i = 0, iMax = this.reportMeta.dimensions.length; i < iMax; i++) {
        this.reportMeta.dimensions[i].id = i;
        for (var l = 0, lMax = this.reportMeta.localizedReports.length; l < lMax; l++) {
            var localizedMeta = this.reportMeta.localizedReports[l];
            localizedMeta.dimensions[i].id = i;
        }
    }

    // A mutatók id-jének beállítása, tooltip beállítása.
    for (var i = 0, iMax = this.reportMeta.indicators.length; i < iMax; i++) {
        this.reportMeta.indicators[i].id = i;
        for (var l = 0, lMax = this.reportMeta.localizedReports.length; l < lMax; l++) {
            var localizedMeta = this.reportMeta.localizedReports[l];
            localizedMeta.indicators[i].id = i;
        }        
    }
};

/**
 * Kiválasztja a metából a pillanatnyi nyelvnek megelelő nyelvfüggő változatot.
 * 
 * @returns {Globalglobal.getFromArrayByLang.array|undefined}
 */
Fact.prototype.getLocalMeta = function() {
    return global.getFromArrayByLang(this.reportMeta.localizedReports);
};