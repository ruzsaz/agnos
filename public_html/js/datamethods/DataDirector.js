'use strict';

/**
 * Egy oldal adatfolyamát intéző osztály.
 *  
 * @param {Integer} side Az oldal (0 vagy 1).
 * @param {Object} mediator Az oldal mediátora.
 * @returns {DataDirector}
 */
function DataDirector(side, mediator) {
    var that = this;

    this.side = side;
    this.mediator = mediator;
    this.panelRoster = [];

    // Feliratkozás a regisztráló, és a fúró mediátorra.
    that.mediator.subscribe("register", function(context, panelId, dimsToShow, preUpdateFunction, updateFunction, getConfigFunction) {
        that.register(context, panelId, dimsToShow, preUpdateFunction, updateFunction, getConfigFunction);
    });
    that.mediator.subscribe("drill", function(drill) {
        that.drill(drill);
    });
    // Feliratkozás a panel konfigurációját elkérő mediátorra.
    that.mediator.subscribe("getConfig", function(callback) {
        that.getConfigs(callback);
    });
}

/**
 * Regisztrál, vagy töröl egy panelt. Ha már regisztrálva van, felülírja az előző regisztrációt.
 * 
 * @param {Object} context A panel objektum. Ha undefined, akkor töröl.
 * @param {Integer} panelId A panel azonosítója.
 * @param {Array} dimsToShow A panel által mutatott dimenziók. (0: nem mutatja, 1: mutatja.)
 * @param {Function} preUpdateFunction A panel klikkeléskor végrehajtandó függvénye.
 * @param {Function} updateFunction Az új adat megérkezésekor meghívandó függvény.
 * @param {Function} getConfigFunction A panel konfigurációját lekérdező függvény.
 * @returns {undefined}
 */
DataDirector.prototype.register = function(context, panelId, dimsToShow, preUpdateFunction, updateFunction, getConfigFunction) {

    // Ha már regisztrálva van ilyen panelId-jű, töröljük.
    var oldPosition = global.positionInArrayByProperty(this.panelRoster, "panelId", panelId);
    if (oldPosition >= 0) {
        this.panelRoster.splice(oldPosition, 1);
    }

    // Ha nem csak törölni kell, akkor hozzá is adja.
    if (context !== undefined) {

        var ds = [];
        for (var d = 0, dMax = global.facts[this.side].reportMeta.dimensions.length; d < dMax; d++) {
            ds.push((dimsToShow.indexOf(d) > -1) ? 1 : 0);
        }

        this.panelRoster.push({
            context: context,
            panelId: panelId,
            dimsToShow: ds,
            preUpdateFunction: preUpdateFunction,
            updateFunction: updateFunction,
            getConfigFunction: getConfigFunction,
            data: undefined
        });

    }
};

/**
 * Visszaadja az első szabad panelpozíció indexét.
 * 
 * @returns {Number} Az első szabad index.
 */
DataDirector.prototype.getFirstFreeIndex = function() {
    for (var index = 0; index < global.maxPanelCount; index++) {
        var panelId = "#panel" + this.side + "P" + index;
        if (global.positionInArrayByProperty(this.panelRoster, "panelId", panelId) === -1) {
            return index;
        }
    }
    return -1;
};

/**
 * Megtippeli, hogy egy új panel számára melyik lehet a legalkalmasabb dimenzió.
 * Arra tippel, ami a már meglevő panelekben a legkevesebbszer szerepel.
 * 
 * @param {Number} exceptDim Ha megadjuk, ez a dimenzió az utolsó lesz a lehetségesek között.
 * Ezt 2 dimenziót ábrázoló panelek második dimenziójának megtippelésekor kell használni.
 * @returns {Number} A tippelt dimenzió sorszáma.
 */
DataDirector.prototype.guessDimension = function(exceptDim) {
    var meta = global.facts[this.side].reportMeta;
    var bestDim = -1;
    var bestDimScore = 10000;
    for (var d = 0, dMax = meta.dimensions.length; d < dMax; d++) {
        var score = (d === exceptDim) ? 1000 + d / 100 : d / 100;
        for (var p = 0, pMax = this.panelRoster.length; p < pMax; p++) {
            score += this.panelRoster[p].dimsToShow[d];
        }
        if (score < bestDimScore) {
            bestDim = d;
            bestDimScore = score;
        }
    }
    return bestDim;
};

/**
 * Visszaadja az épp használatban levő normál panelek számát.
 * 
 * @returns {Number} A haszálatban levő normál panelek száma.
 */
DataDirector.prototype.getNumberOfPanels = function() {
    return this.panelRoster.length;
};

/**
 * Fúrást végző függvény. Beállítja a szűrési-fúrási szűrőket, és ha a fúrás végrehajtjató,
 * meghívja a panelek preupdate függvényeit, majd elindítja az új adat begyűjtését.
 * 
 * @param {Object} drill A fúrás objektum.
 * @returns {undefined}
 */
DataDirector.prototype.drill = function(drill) {
    var isSuccessful = false;
    var dim = drill.dim;
    var baseDim = (global.baseLevels[this.side])[dim];
    if (drill.direction === -1) {
        if (drill.toId !== undefined && baseDim.length < global.facts[this.side].reportMeta.dimensions[dim].levels.length - 1) {
            isSuccessful = true;
            drill.fromId = (baseDim.length === 0) ? null : (baseDim[baseDim.length - 1]).id;
            baseDim.push({id: drill.toId, name: drill.toName});
        }
    } else if (drill.direction === 1) {
        if (baseDim.length > 0) {
            isSuccessful = true;
            drill.fromId = (baseDim[baseDim.length - 1]).id;
            baseDim.pop();
            drill.toId = (baseDim.length === 0) ? null : (baseDim[baseDim.length - 1]).id;
        }
    } else if (drill.direction === 0) {
        isSuccessful = true;
    }
    if (isSuccessful) {
        this.requestNewData(drill);
        this.initiatePreUpdates(drill);
    }
};

/**
 * Meghívja az összes panel preupdate-függvényét.
 * 
 * @param {Object} drill A fúrás objektum.
 * @returns {undefined}
 */
DataDirector.prototype.initiatePreUpdates = function(drill) {
    for (var i = 0, iMax = this.panelRoster.length; i < iMax; i++) {
        this.panelRoster[i].preUpdateFunction.call(this.panelRoster[i].context, this.getPanelDrill(i, drill));
    }
};

/**
 * Lefúrás után új adatot szerez be az olap kockából.
 * Az adat megérkeztekor kisztja a panelek update-függvényének.
 * 
 * @param {Object} drill A lefúrás objektum.
 * @returns {undefined}
 */
DataDirector.prototype.requestNewData = function(drill) {
    var that = this;

    var cubeNameString = global.facts[that.side].reportMeta.cube_unique_name;
    var baseLevelQueryString = "";
    var separator0 = "";
    for (var d = 0, dMax = (global.baseLevels[that.side]).length; d < dMax; d++) {
        var separator1 = "";
        baseLevelQueryString += separator0;
        for (var l = 0, lMax = (global.baseLevels[that.side])[d].length; l < lMax; l++) {
            baseLevelQueryString += separator1 + ((global.baseLevels[that.side])[d])[l].id;
            separator1 = ",";
        }
        separator0 = ":";
    }

    var queries = [];
    for (var p = 0, pMax = this.panelRoster.length; p < pMax; p++) {
        queries.push(this.panelRoster[p].dimsToShow.toString().replace(/,/g, ":"));
    }

    var uniqueQueries = queries.filter(function(element, position) {
        return queries.indexOf(element) === position;
    });

    var queriesString = uniqueQueries.toString().replace(/,/g, ";");
    var query = cubeNameString + ";" + baseLevelQueryString + ";" + queriesString;
    var encodedQuery = "queries=" + window.btoa(query);

    // A letöltés élesben.
    global.get(global.url.fact, encodedQuery, function(result, status) {
        that.processNewData(drill, result);
    });
};

/**
 * Szétosztja az új adatot a panelek számára, és meghívja a panelek update függvényét.
 * 
 * @param {Object} drill A fúrás objektum.
 * @param {Object} newDataJson Az új, ömelsztett adat.
 * @returns {undefined}
 */
DataDirector.prototype.processNewData = function(drill, newDataJson) {
    var newData = newDataJson;
    for (var i = 0, iMax = this.panelRoster.length; i < iMax; i++) {
        var pos = global.positionInArrayByProperty(newData, "name", this.panelRoster[i].dimsToShow.toString().replace(/,/g, ":"));
        var data = newData[pos].response;
        this.panelRoster[i].updateFunction.call(this.panelRoster[i].context, data, this.getPanelDrill(i, drill));
    }
    global.getConfig2();
};

/**
 * Az aktuális drill-objektumból elkészíti a panel számára szólót, amely
 * már csak a panel számára is érdekes fúrást tartalmazza.
 * 
 * @param {Integer} i A panel azonosítója.
 * @param {Object} drill A fúrás objektum.
 * @returns {Object} A panel számára érdekes fúrás objektum.
 */
DataDirector.prototype.getPanelDrill = function(i, drill) {
    var panelDrill = {
        dim: drill.dim,
        direction: (this.panelRoster[i].dimsToShow[drill.dim] === 1) ? drill.direction : 0,
        fromId: drill.fromId,
        toId: drill.toId
    };
    return panelDrill;
};

/**
 * Lekérdezi az oldalon lévő panelek pillanatnyi konfigurációját létrehozó
 * konfigurációs parancsot.
 * 
 * @param {Function} callback A visszahívandó függvény. Ha undefined, a konzolra írja.
 * @returns {undefined}
 */
DataDirector.prototype.getConfigs = function(callback) {
    var configs = "";
    var separator = "";

    // Egyesével elkéri a panelek konfigurőciós szkriptjét, és ;-vel elválasztottan összegyűjti.
    for (var i = 0, iMax = this.panelRoster.length; i < iMax; i++) {
        if (typeof this.panelRoster[i].getConfigFunction === 'function') {
            configs = configs + separator + this.panelRoster[i].getConfigFunction.call(this.panelRoster[i].context);
            separator = ";";
        }
    }
    
    // Ha callbackolni kell, íme.
    if (typeof callback === 'function') {
        var configObject = {};
        if (global.facts[this.side]) {
            configObject.s = this.side; // Az oldal, amire vonatkozik (0 vagy 1).
            configObject.c = global.facts[this.side].reportMeta.cube_unique_name; // A cube neve.
            configObject.b = global.baseLevels[this.side]; // A bázisszintek, amire épp lefúrva van.
            configObject.v = global.minifyInits(configs); // A panelek init sztringje, minifyolva.
        }
        callback(configObject);
    } else {
        console.log(configs);
    }
};