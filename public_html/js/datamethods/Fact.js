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
    this.localMeta = undefined;
    this.reportSuperMeta = reportSuperMeta;

    // Reporthoz tartozó meták betöltése.
    global.get(global.url.meta, "cube_name=" + window.btoa(that.reportSuperMeta.name + ":" + String.locale), function(result) {
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

    // A report metáját kiegészítjük a supermeta rá vonatkozó részével.
    this.reportMeta = reportMetaJson;
    this.reportMeta.captions = reportSuperMeta.captions;
    this.reportMeta.descriptions = reportSuperMeta.descriptions;
    this.reportMeta.datasources = reportSuperMeta.datasources;
    this.reportMeta.updated = reportSuperMeta.updated;

    // A bázisszintet tartalmazó tömb kezdeti beállítása.
    for (var i = 0, iMax = this.reportMeta.dimensions.length; i < iMax; i++) {
        (global.baseLevels[this.side]).push([]); // Kezdetben a legfelsőbb szint a bázisszint.
    }
    if (startObject) {
        global.baseLevels[this.side] = startObject.b;
        this.reportMeta.visualization = startObject.v;
    }

    // A dimenziók id-jének beállítása, tooltip beállítása;
    for (var i = 0, iMax = this.reportMeta.dimensions.length; i < iMax; i++) {
        this.reportMeta.dimensions[i].id = i;
    }

    // A mutatók id-jének beállítása, tooltip beállítása.
    for (var i = 0, iMax = this.reportMeta.indicators.length; i < iMax; i++) {
        this.reportMeta.indicators[i].id = i;
    }

    this.callback.call(this.callContext, this.side, this.reportMeta);
};

/**
 * Kiválasztja a metából a pillanatnyi nyelvnek megelelő nyelvfüggő változatot.
 * 
 * @returns {Globalglobal.getFromArrayByLang.array|undefined}
 */
Fact.prototype.getLocalMeta = function() {
    var language = global.getIndexOfLang(this.reportMeta.languages, String.locale);
    if (language === -1) {
        language = 0;
    }

    // Ha nem a jó nyelvről szól a localMeta, akkor elkészítjük.
    if (!(this.localMeta && this.localMeta.actualLanguage === language)) {
        this.localMeta = {};
        this.localMeta.actualLanguage = language;
        this.localMeta.caption = this.reportMeta.captions[language];
        this.localMeta.cube_unique_name = this.reportMeta.cube_unique_name;
        this.localMeta.datasource = this.reportMeta.datasources[language];
        this.localMeta.description = this.reportMeta.descriptions[language];
        this.localMeta.dimensions = [];
        for (var i = 0, iMax = this.reportMeta.dimensions.length; i < iMax; i++) {
            var d = this.reportMeta.dimensions[i];
            var dimension = {
                'caption': d.captions[language],
                'description': d.descriptions[language],
                'hierarchy_unique_name': d.hierarchy_unique_name,
                'id': d.id,
                'is_territorial': (d.type === "" || d.type === "null") ? 0 : 1,
                'levels': d.levels,
                'top_level_caption': d.top_level_captions[language]
            };
            this.localMeta.dimensions.push(dimension);
        }

        this.localMeta.indicators = [];
        for (var i = 0, iMax = this.reportMeta.indicators.length; i < iMax; i++) {
            var d = this.reportMeta.indicators[i];
            var indicator = {
                'caption': d.captions[language],
                'description': d.descriptions[language],
                'fraction': {
                    'hide': d.fraction.hide,
                    'measure_unique_name': d.fraction.measure_unique_name,
                    'multiplier': d.fraction.multiplier,
                    'sign': d.fraction.sign,
                    'unit': d.fraction.units[language],
                    'unitPlural': d.fraction.unitPlurals[language]
                },
                'id': d.id,
                'value': {
                    'hide': d.value.hide,
                    'measure_unique_name': d.value.measure_unique_name,
                    'sign': d.value.sign,
                    'unit': d.value.units[language],
                    'unitPlural': d.value.unitPlurals[language]
                }
            };
            this.localMeta.indicators.push(indicator);
        }
        this.localMeta.visualization = this.reportMeta.visualization;
    }
    
    return this.localMeta;
};