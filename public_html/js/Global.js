/* global d3, LZString */

'use strict';

console.log("Az épp aktuális panelkonfiguráció kiíratása: global.getConfig();");
// A bookmark-lehetőség a 203.sorban van!

/**
 * Kiterjeszti a d3.selectiont egy .moveToFront() függvénnyel, ami az adott
 * elemeket a vele egy szinten levő elemek elé mozgatja.
 * 
 * @returns {d3.selection.prototype@call;each}
 */
d3.selection.prototype.moveToFront = function() {
    return this.each(function() {
        this.parentNode.appendChild(this);
    });
};

// Magyar ezres helyiértékjelzések definiálása.
d3.formatPrefix(1e12).symbol = "eMrd";
d3.formatPrefix(1e9).symbol = "Mrd";
d3.formatPrefix(1e6).symbol = "M";
d3.formatPrefix(1e3).symbol = "e";

/**
 * A globális változók elérését biztosító namespace. (Valójában property-tömb.)
 * 
 * @type _L101.Anonym$8
 */
var global = function() {

//////////////////////////////////////////////////
// Lokálisan használt függvények.
//////////////////////////////////////////////////

    /**
     * Kiolvassa a css-be írt változók értékeit.
     * 
     * @type Function|@exp;Global_L32@pro;configVars
     */
    var varsFromCSS = function() {
        var configVars = {};
        for (var css = 0, cssMax = document.styleSheets.length; css < cssMax; css++) {
            var sheet = document.styleSheets[css];
            for (var r = 0, rMax = sheet.cssRules.length; r < rMax; r++) {
                var sRule = sheet.cssRules[r].cssText;
                if (sRule.substr(0, 5) === "#less") {
                    var aKey = sRule.match(/\.(\w+)/);
                    var aVal = sRule.match(/: .*;/)[0].replace(": ", "").replace(";", "");
                    if (aKey && aVal) {
                        if (configVars[aKey[1]] === undefined) {
                            configVars[aKey[1]] = aVal;
                        } else if (Array.isArray(configVars[aKey[1]])) {
                            configVars[aKey[1]].push(aVal);
                        } else {
                            configVars[aKey[1]] = [];
                        }
                    }
                }
            }
        }
        return configVars;
    }();

    /**
     * Eldönti, hogy egy panel közepe a képrenyőn van-e?
     * 
     * @param {Object} panel A panel.
     * @returns {Boolean} True ha igen, false ha nem.
     */
    var isPanelVisible = function(panel) {
        var rect = $(panel)[0].getBoundingClientRect();
        var x = (rect.left + rect.right) / 2;
        var y = (rect.top + rect.bottom) / 2;
        return (
                x >= 0 &&
                y >= 0 &&
                y <= (window.innerHeight || document.documentElement.clientHeight) &&
                x <= (window.innerWidth || document.documentElement.clientWidth)
                );
    };

    /**
     * Egyetlen, már kiírt  szövegelemet összenyom a megadott pixelméretre.
     * Ha kell levág belőle, ha kell összenyomja a szöveget.
     * 
     * @param {Object} renderedText A kiírt szöveg, mint html objektum.
     * @param {Number} maxSize Maximális méret pixelben.
     * @param {Number} maxRatio Maximum ennyiszeresére nyomható össze a szöveg.
     * @param {Boolean} isVerical True: függőleges a szöveg, false: vízszintes.
     * @param {Boolean} isCenter True: centrálni is kell a szöveget, false: nem.
     * @param {Number} sizeToCenterIn Ha centrálni kell, ekkora területen belül.
     * @returns {undefined}
     */
    var _cleverCompress = function(renderedText, maxSize, maxRatio, isVerical, isCenter, sizeToCenterIn) {
        maxRatio = maxRatio || 1.7;
        if (maxSize < 10) { // 10px alatt üres szöveget csinálunk.
            renderedText.text("");
        } else {
            var textWidth = renderedText[0][0].getBBox().width; // A szöveg pillanatnyi mérete.

            // Ha 1.7-szor nagyobb mértékben kéne összenyomni, akkor levágunk belőle.
            if (textWidth > maxSize * maxRatio) {
                var text = renderedText.text().trim();
                // Preferáljuk a szóköznél vagy -nél történő vágást.
                var cutPositionMin = Math.round((text.length) * (maxSize / textWidth) * (1 + (maxRatio - 1) * 0.28) - 1);
                var cutPositionMax = Math.round((text.length) * (maxSize / textWidth) * maxRatio - 1);
                var tosplit = text.substring(cutPositionMin, cutPositionMax);
                var offset = Math.max(tosplit.lastIndexOf("-"), tosplit.lastIndexOf(" "), tosplit.lastIndexOf("/"));
                var cutPosition = Math.round((offset > -1) ? cutPositionMin + offset : (cutPositionMin + cutPositionMax) / 2);
                var newText = text.substring(0, cutPosition) + "..";
                renderedText.text(newText);
                textWidth = renderedText[0][0].getBBox().width; // A szöveg pillanatnyi mérete.
            }

            var ratio = 1;
            // összenyomjuk, ha nagyobb volt, mint a rendelkezésre álló hely.
            if (textWidth > maxSize) {
                ratio = maxSize / textWidth;
                textWidth = maxSize;
            }

            // Ha össze kellett nyomni, vagy centrálni kell, akkor beállítjuk a transform-mátrixot.
            if (ratio !== 1 || isCenter) {
                var transOrigo = renderedText.attr("x") * (1 - ratio);
                if (isCenter) {
                    transOrigo = transOrigo + (sizeToCenterIn - textWidth) / 2;
                }
                var oldTRansform = ((renderedText.attr("transform") || "") + " ").replace(/matrix.*/g, '');
                renderedText.attr("transform", oldTRansform + "matrix(" + ratio + ",0,0,1," + transOrigo + ",0)");
            }
        }
    };

    /**
     * Segítő függvény path-generáláshoz.
     * 
     * @param {Number} x Pl. 3.
     * @param {Number} y Pl. 5.
     * @returns {String} Ekkor: "3 5 "
     */
    var pathHelper = function(x, y) {
        return x + " " + y + " ";
    };

    /**
     * Hash függvény, amely egy sztringből egész számot generál.
     * 
     * @param {String} str A bemeneti sztring.
     * @returns {Number} Kapott hash-szám.
     */
    var djb2Code = function(str) {
        var hash = 5381;
        for (var i = 0, iMax = str.length; i < iMax; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash << 5) + hash) + char;
        }
        return Math.abs(hash);
    };

//////////////////////////////////////////////////
// Globálisan használt függvények.
//////////////////////////////////////////////////

    /**
     * Kiírja a pillanatnyilag meglevő panelek konfigurációját a konzolra.
     * 
     * @returns {undefined}
     */
    var getConfig = function() {
        global.mediators[0].publish("getConfig");
        global.mediators[1].publish("getConfig");
    };

    /**
     * Kiegészíti a böngésző URL-jét egy hash-al, ami bookmarkolhatóan
     * tartalmazza a panelek állapotát, a reportokat, és a lefúrási szinteket.
     * 
     * @returns {undefined}
     */
    var getConfigToHash = function() {
        var startObject = {}; // A bookmarkban tárolandó objektum.
        startObject.p = []; // A betöltendő oldalak inicializációs objektumai.
        var panelsToWaitFor = 2;

        // A bal és a jobb oldal konfigurációs sztringjeit feldolgozó callback-függvény.
        var receiveConfig = function(oneSideStartObject) {
            startObject.p.push(oneSideStartObject);
            panelsToWaitFor = panelsToWaitFor - 1;

            // Ha mindkét oldalé megérkezett...
            if (panelsToWaitFor === 0) {

                // A megjelenítési mód (bal, jobb, osztott) kinyerése.
                var displayMode;
                var numberOfSides = d3.selectAll(".container.activeSide")[0].length; // Hány aktív oldal van? (2 ha osztottkijelzős üzemmód, 1 ha nem.)
                if (numberOfSides === 1) {
                    displayMode = d3.selectAll("#container1.activeSide")[0].length * 2; // Aktív oldal id-je, 0 vagy 2. Csak akkor ételmes, ha 1 aktív oldal van.
                } else {
                    displayMode = 1;
                }
                startObject.d = displayMode; // A megjelenítési mód: 0: bal, 2: jobb, 1: mindkettő.

                // A képernyőn egy sorba kiférő panelek száma.
                startObject.n = global.panelNumberOnScreen;

                // Tényleges URL-be írás. Ha nem kell, kikommentelendő.
                location.hash = LZString.compressToEncodedURIComponent(JSON.stringify(startObject));
            }
        };

        // Kérés kiküldése a két oldal dataDirector-ja számára.
        global.mediators[0].publish("getConfig", receiveConfig);
        global.mediators[1].publish("getConfig", receiveConfig);
    };

    /**
     * Belépés.
     * 
     * @param {String} username Felhasználónév.
     * @param {String} password Jelszó.
     * @param {String} callback Sikeres autentikáció után meghívandó függvény.	 
     * @returns {undefined}
     */
    var login = function(username, password, callback) {
        var progressDiv = d3.select("#progressDiv");
        var progressCounter = setTimeout(function() {
            progressDiv.style("z-index", 1000);
        }, 50);

        $.ajax({
            url: global.url.auth,
            beforeSend: function(xhr) {
                xhr.setRequestHeader('Authorization', 'Basic ' + btoa(username + ':' + password));
            },
            success: function(result) { // Sikeres autentikáció esetén.
                global.secretUsername = username;
                global.secretToken = result;
                setDialog(); // Esetleges hibaüzenet levétele.
                callback();
            },
            error: function(jqXHR, textStatus, errorThrown) { // Hálózati, vagy autentikációs hiba esetén.
                $(':focus').blur();
                if (jqXHR.status === 401) { // Ha a szerver 'nem vagy autentikálva' választ ad, újra megpróbáljuk.
                    setDialog(
                            "Hibás felhasználónév, vagy jelszó.",
                            "<div class='errorStaticText'>Felhasználónév:</div><div><input id='loginName' type='text' name='username'></div>" +
                            "<div class='errorStaticText'>Jelszó:</div><div><input id='loginPassword' type='password' name='password'></div>",
                            "Belépés",
                            function() {
                                login($('#loginName').val(),
                                        $('#loginPassword').val(),
                                        callback);
                            },
                            "Kilépés",
                            function() {
                                location.reload();
                            },
                            1
                            );
                } else if (jqXHR.status === 403) { // Ha az autentikáció jó, de nincs olvasási jog az adathoz
                    setDialog(
                            "Hozzáférés megtagadva",
                            "<div class='errorStaticText'>Nincs hozzáférési jogod a rendszerhez. A hibaüzenet:</div>" +
                            "<div class='errorVariableText'><em>" + "Error " + jqXHR.status + ": " + errorThrown + "</em></div>" +
                            "<div class='errorStaticText'>Hozzáférési jogot az üzemeltetéstől kérhetsz.</div>",
                            undefined,
                            undefined,
                            "Kilépés",
                            function() {
                                location.reload();
                            },
                            2
                            );
                } else { // Más hiba esetén...                    
                    setDialog(
                            "Hálózati hiba",
                            "<div class='errorStaticText'>A kapcsolat az adatbázis felé megszakadt. A hibaüzenet:</div>" +
                            "<div class='errorVariableText'><em>" + "Error " + jqXHR.status + ": " + errorThrown + "</em></div>" +
                            "<div class='errorStaticText'>Próbálj meg újra belépni!</div>",
                            "Újra",
                            function() {
                                login(username, password, callback);
                            },
                            "Kilépés",
                            function() {
                                location.reload();
                            },
                            1

                            );
                }
            },
            complete: function() {
                // Esetleges homokóra letörlése.
                clearTimeout(progressCounter);
                progressDiv.style("z-index", -1);
            }

        });
    };

    /**
     * Aszinkron ajax adatletöltés GET-en át, hibakezeléssel.
     * 
     * @param {String} url Az URL, ahonnan le kell tölteni.
     * @param {String} data A felküldendő adat.
     * @param {String} callback Sikeres letöltés után meghívandó függvény.
     * @param {Boolean} isDeleteDialogRequired Sikeres letöltés után törölje-e a dialógusablakot?
     * @returns {undefined}
     */
    var get = function(url, data, callback, isDeleteDialogRequired) {
        var progressDiv = d3.select("#progressDiv");
        var progressCounter = setTimeout(function() {
            progressDiv.style("z-index", 1000);
        }, 200);

        $.ajax({
            url: url,
            data: data,
            beforeSend: function(xhr) {
                xhr.setRequestHeader('Authorization', 'Basic ' + btoa(global.secretUsername + ':' + global.secretToken));
            },
            success: function(result, status) { // Sikeres letöltés esetén.
                // Esetleges hibaüzenet levétele.
                if (isDeleteDialogRequired === undefined || isDeleteDialogRequired) {
                    setDialog();
                }
                callback(result, status);
            },
            error: function(jqXHR, textStatus, errorThrown) { // Hálózati, vagy autentikációs hiba esetén.
                $(':focus').blur();
                // Esetleges homokóra letörlése.
                clearTimeout(progressCounter);
                progressDiv.style("z-index", -1);
                if (jqXHR.status === 401) { // Ha a szerver 'nem vagy autentikálva' választ ad, autentikáljuk.
                    setDialog(
                            "TITKOS! Jelentkezz be!",
                            "<div class='errorStaticText'>Felhasználónév:</div><div><input id='loginName' type='text' name='username'></div>" +
                            "<div class='errorStaticText'>Jelszó:</div><div><input id='loginPassword' type='password' name='password'></div>",
                            "Belépés",
                            function() {
                                login($('#loginName').val(),
                                        $('#loginPassword').val(),
                                        function() {
                                            get(url, data, callback, isDeleteDialogRequired);
                                        });
                            },
                            "Kilépés",
                            function() {
                                location.reload();
                            },
                            1
                            );
                } else if (jqXHR.status === 403) { // Ha az autentikáció jó, de nincs olvasási jog az adathoz
                    setDialog(
                            "Hozzáférés megtagadva",
                            "<div class='errorStaticText'>A kért adatokhoz nincs hozzáférési jogod. A hibaüzenet:</div>" +
                            "<div class='errorVariableText'><em>" + "Error " + jqXHR.status + ": " + errorThrown + "</em></div>" +
                            "<div class='errorStaticText'>Hozzáférési jogot az üzemeltetéstől kérhetsz.</div>",
                            undefined,
                            undefined,
                            "Kilépés",
                            function() {
                                location.reload();
                            },
                            2
                            );
                } else { // Más hiba esetén...                    
                    if (errorThrown === "") {
                        errorThrown = "Server unreachable";
                    }
                    setDialog(
                            "Hálózati hiba",
                            "<div class='errorStaticText'>A kapcsolat az adatbázis felé megszakadt. A hibaüzenet:</div>" +
                            "<div class='errorVariableText'><em>" + "Error " + jqXHR.status + ": " + errorThrown + "</em></div>" +
                            "<div class='errorStaticText'>Próbáld meg az adatokat újra letölteni!</div>",
                            "Újra",
                            function() {
                                get(url, data, callback);
                            },
                            "Kilépés",
                            function() {
                                location.reload();
                            },
                            1
                            );
                }

            },
            complete: function() {
                // Esetleges homokóra letörlése.
                clearTimeout(progressCounter);
                progressDiv.style("z-index", -1);
            }

        });
    };

    /**
     * Egy panel animálásának ideje. Csak azonakat animálja, amelyek
     * középpontja látszik a képernyőn.
     * 
     * @param {String} callerId A fúrást kérő panel azonosítója.
     * @param {String} panelId Az animálandó panel azonosítója.
     * @returns {Number} Az animálás ideje (ms).
     */
    var getAnimDuration = function(callerId, panelId) {
        var animMode = 1; // 0: mindent animál, 1: csak láthatót animál, 2: csak saját magát
        var duration = 0;
        if (animMode === 0 || callerId === panelId || (animMode === 1 && isPanelVisible(panelId))) {
            duration = global.selfDuration;
        }
        return duration;
    };

    /**
     * Betömörít kiírt feliratokat a megadott helyre.
     * Ha kell levág belőle, ha kell, összenyomja a szöveget.
     * 
     * @param {d3.Selection} renderedTexts Már kirajzolt szövegek összessége, mint d3 selection.
     * @param {Object|Number} renderedParent A kirajzolt szövegdoboz, vagy a mérete pixelben.
     * @param {Number} multiplier A szövegdoboz ennyiszeresét töltse ki maximum a szöveg.
     * @param {Number} maxRatio Maximum ennyiszeresére nyomható össze a szöveg.
     * @param {Boolean} isVertical True: függőleges a szöveg; false: vízszintes.
     * @param {Boolean} isCenter True: centrálni is kell a szöveget, false: nem.
     * @param {Number} sizeToCenterIn Ha centrálni kell, ekkora területen belül. 
     * @returns {undefined}
     */
    var cleverCompress = function(renderedTexts, renderedParent, multiplier, maxRatio, isVertical, isCenter, sizeToCenterIn) {
        var maxTextWidth;
        // Meghatározzuk a szöveg maximális méretét pixelben.
        if (typeof renderedParent === "number") {
            maxTextWidth = multiplier * renderedParent;
        } else {
            maxTextWidth = multiplier * ((isVertical) ? renderedParent[0][0].getBBox().height : renderedParent[0][0].getBBox().width);
        }

        // Egyesével elvégezzük a tömörítést.
        renderedTexts.each(function() {
            _cleverCompress(d3.select(this), maxTextWidth, maxRatio, isVertical, isCenter, sizeToCenterIn);
        });
    };

    /**
     * Egy SVG téglalapot kirajzoló path-t generál, opcionálisan lekerekített sarkokkal.
     * 
     * @param {Number} x Balfelső csúcs x koordinátája.
     * @param {Number} y Balfelső csúcs y koordinátája.
     * @param {Number} w Szélesség.
     * @param {Number} h Magasság.
     * @param {Number} r1 Balfelső lekerekítettség pixelben.
     * @param {Number} r2 Jobbfelső lekerekítettség pixelben.
     * @param {Number} r3 Jobbalsó lekerekítettség pixelben.
     * @param {Number} r4 Balalsó lekerekítettség pixelben.
     * @returns {String} A path-ot definiáló karakterlánc.
     */
    var rectanglePath = function(x, y, w, h, r1, r2, r3, r4) {
        var strPath = "M" + pathHelper(x + r1, y); //A
        strPath += "L" + pathHelper(x + w - r2, y) + "Q" + pathHelper(x + w, y) + pathHelper(x + w, y + r2); //B
        strPath += "L" + pathHelper(x + w, y + h - r3) + "Q" + pathHelper(x + w, y + h) + pathHelper(x + w - r3, y + h); //C
        strPath += "L" + pathHelper(x + r4, y + h) + "Q" + pathHelper(x, y + h) + pathHelper(x, y + h - r4); //D
        strPath += "L" + pathHelper(x, y + r1) + "Q" + pathHelper(x, y) + pathHelper(x + r1, y); //A
        strPath += "Z";
        return strPath;
    };

    /**
     * Szám rövid kijelzése kiíráshoz, max 3 számkarakterrel. (pl. 3.51 Mrd.)
     * 
     * @param {Number} n Kijelzendő szám.
     * @returns {String} A kiírandó sztring.
     */
    var cleverRound3 = function(n) {
        return (n !== undefined) ? ((isFinite(n)) ? (parseFloat(d3.format(".3s")(n)) + d3.formatPrefix(n).symbol).replace(".", ",") : "inf") : "???";
    };

    /**
     * Szám hosszabb kijelzése kiíráshoz, max 5 számkarakterrel. (pl. 35123 M.)
     *  
     * @param {Number} n Kijelzendő szám.
     * @returns {String} A kiírandó sztring.
     */
    var cleverRound5 = function(n) {
        return (n !== undefined) ? ((isFinite(n)) ? (parseFloat(d3.format(".4s")(n)) + d3.formatPrefix(n).symbol).replace(".", ",") : "inf") : "???";
    };

    /**
     * Összehasonlít két sztringet lexikografikusan.
     * Azért kell, mert a localeCompare rosszul működik: A előbb van mint a, de A2 később van mint a1.
     * 
     * @param {type} a
     * @param {type} b
     * @returns {-1 ha a van előrébb, 1 ha b, 0 ha azonosak}
     */
    var realCompare = function(a, b) {
        var minLen = Math.min(a.length, b.length);
        var i = 0;
        while (a.charAt(i) === b.charAt(i) && i < minLen) {
            i++;
        }
        return (a.substr(0, i + 1)).localeCompare(b.substr(0, i + 1), "hu", {sensitivity: 'variant', caseFirst: 'upper'});
    };

    /**
     * Megadja egy érték kijelzésének színét.
     * 
     * @param {Integer} valueId Az érték sorszáma.
     * @returns {String} A hozzá tartozó szín, html kódolva.
     */
    var colorValue = function(valueId) {
        return (isNaN(valueId)) ? colorNA : colors[(valueId) % 20];
    };

    /**
     * Megadja egy dimenzióelem kijelzésének színét.
     * 
     * @param {Integer} id A dimenzió azonosítója.
     * @returns {String} A hozzá tartozó szín, html kódolva.
     */
    var color = function(id) {
        return colors[(djb2Code(id) + 4) % 20];
    };

    /**
     * Inicializálja a globális változókat a belépés után.
     * Betölti a superMetát, majd meghívja az induló függvényt.
     * 
     * @param {Function} callback A meghívandó induló függvény.
     * @returns {Global_L27.initGlobals}
     */
    var initGlobals = function(callback) {
        var that = this;
        this.tooltip = new Tooltip();
        get(global.url.superMeta, "", function(result, status) {
            //that.superMeta = JSON.parse(result).reports;
            that.superMeta = result.reports;
            callback();
        });
    };

    /**
     * Osztály származtatását megvalósító függvény.
     * 
     * @param {Object} base Szülőpéldány.
     * @returns {Prototype} A gyerek osztály új prototípusa.
     */
    var subclassOf = function(base) {
        var _subclassOf = function() {
        };
        _subclassOf.prototype = base.prototype;
        return new _subclassOf();
    };

    /**
     * Megkeresi egy tömb elemét az elem egyik property-je alapján.
     * 
     * @param {Array} array A tömb.
     * @param {String} property Az elemek property-je, aminek az értékét vizsgáljuk.
     * @param {Object} value A keresett érték.
     * @returns {Object} A tömb első eleme, amelynek .property -je = value.
     */
    var getFromArrayByProperty = function(array, property, value) {
        var returnIndex = global.positionInArrayByProperty(array, property, value);
        return (returnIndex === -1) ? undefined : array[returnIndex];
    };

    /**
     * Megkeresi egy tömb elemének indexét az elem egyik property-je alapján.
     * 
     * @param {Array} array A tömb.
     * @param {String} property Az elemek property-je, aminek az értékét vizsgáljuk.
     * @param {Object} value A keresett érték.
     * @returns {Integer} A tömb első eleme, amelynek .property -je = value.
     */
    var positionInArrayByProperty = function(array, property, value) {
        var returnIndex = -1;
        for (var i = 0, iMax = array.length; i < iMax; i++) {
            if (array[i][property] === value) {
                returnIndex = i;
                break;
            }
        }
        return returnIndex;
    };

    /**
     * Megnézi, hogy a tömb hányadik eleme egy érték.
     * 
     * @param {Array} array A tömb.
     * @param {Object} value A keresett érték.
     * @returns {Integer} -1: nincs benne, különben: ennyiedik.
     */
    var positionInArray = function(array, value) {
        var position = -1;
        for (var i = 0, iMax = array.length; i < iMax; i++) {
            if (array[i] === value) {
                position = i;
                break;
            }
        }
        return position;
    };

    /**
     * Nagyítást/kicsinyítést végrehajtó style generálása.
     * 
     * @param {Number} scaleRatio A nagyítás aránya.
     * @param {Number} origX A nagyítás közepének x koordinátája.
     * @param {Number} origY A nagyítás közepének y koordinátája.
     * @returns {String} A beállítandó style.
     */
    var getStyleForScale = function(scaleRatio, origX, origY) {
        return {"-webkit-transform": "scale(" + scaleRatio + ")",
            "-moz-transform": "scale(" + scaleRatio + ")",
            "-ms-transform": "scale(" + scaleRatio + ")",
            "-o-transform": "scale(" + scaleRatio + ")",
            "transform": "scale(" + scaleRatio + ")",
            "-webkit-transform-origin": origX + " " + origY,
            "-moz-transform-origin": origX + " " + origY,
            "-ms-transform-origin": origX + " " + origY,
            "-o-transform-origin": origX + " " + origY,
            "transform-origin": origX + " " + origY};
    };

    /**
     * Eldönti, hogy egy érték a [min, max) intervallumba esik-e?
     * 
     * @param {Number} value Érték.
     * @param {Number} min Minimum.
     * @param {Number} max Maximum.
     * @returns {Boolean} True ha igen, false ha nem.
     */
    var valueInRange = function(value, min, max) {
        return (value < max) && (value >= min);
    };

    /**
     * Olvasható színt választ egy adott háttérszínhez.
     * Ha nincs megadva színkínálat, akkor a a writeOnDimColor/writeOnValColor -ból választ.
     * 
     * @param {String} background Háttér színe.
     * @param {String} primaryColor Elsődleges szín.
     * @param {String} secondaryColor Másodlagos szín.
     * @returns {String} A legjobban olvasható írásszín.
     */
    var readableColor = function(background, primaryColor, secondaryColor) {
        var back = d3.lab(background);
        var primary = (primaryColor) ? d3.lab(primaryColor) : d3.lab(writeOnDimColor);
        var secondary = (secondaryColor) ? d3.lab(secondaryColor) : d3.lab(writeOnValColor);
        var dP = Math.pow((back.l - primary.l), 2) + Math.pow((back.a - primary.a), 2) + Math.pow((back.b - primary.b), 2);
        var dS = Math.pow((back.l - secondary.l), 2) + Math.pow((back.a - secondary.a), 2) + Math.pow((back.b - secondary.b), 2);
        return (dP > dS) ? primary.rgb() : secondary.rgb();
    };

    /**
     * Összekombinál két objektumot, ha egy property mindkettőben szerepel, akkor
     * a másodikbeli értéke lesz, ha csak az elsőben, akkor az.
     * 
     * @param {Object} defaultObj A 'default' értékeket tartalmazó objektum.
     * @param {Object} obj A felhasználó által adott értékeket tartalmazó objektum.
     * @returns {Object} A kombinált objektum.
     */
    var combineObjects = function(defaultObj, obj) {
        var keys = Object.keys(defaultObj);
        var combined = [];
        for (var i = 0; i < keys.length; i++) {
            if ((typeof obj !== "undefined") && (keys[i] in obj)) {
                combined[keys[i]] = obj[keys[i]];
            } else {
                combined[keys[i]] = defaultObj[keys[i]];
            }
        }
        return combined;
    };

    /**
     * Minify-olja és visszaállítja a panelek konstrukciós konstruktorhívó parancsait.
     * 
     * @param {String} initString Átalakítandó sztring.
     * @param {Boolean} isBack Ha true, akkor visszaállít.
     * @returns {String} Az átalakított sztring.
     */
    var minifyInits = function(initString, isBack) {

        // Az oda-visszaalakító szótár. Vigyázni kell, nehogy valamelyik oldalon
        // valami más részhalmazát adjunk meg, mert a csere elbaszódik!
        var dictionary = [
            ['panel_pie', 'PP'],
            ['panel_bar2d', 'PB2'],
            ['panel_barline', 'PB'],
            ['panel_horizontalbar', 'PH'],
            ['panel_map', 'PM'],
            ['panel_table1d', 'PT1'],
            ['panel_table2d', 'PT2'],
            ['group:', 'A:'],
            ['position:', 'B:'],
            ['dim:', 'C:'],
            ['dimx:', 'D:'],
            ['dimy:', 'E:'],
            ['dimr:', 'F:'],
            ['dimc:', 'G:'],
            ['val:', 'H:'],
            ['valbars:', 'I:'],
            ['vallines:', 'J:'],
            ['valavglines:', 'K:'],
            ['valpos:', 'L:'],
            ['valneg:', 'M:'],
            ['multiplier:', 'N:'],
            ['ratio:', 'O:'],
            ['streched:', 'P:'],
            ['centered:', 'Q:'],
            ['domain:', 'R:'],
            ['domainr:', 'S:'],
            ['symbols:', 'T:'],
            ['top10:', 'U:'],
            ['range:', 'V:'],
            ['poi:', 'W:'],
            ['false', 'Ff'],
            ['true', 'Tt'],
            ['undefined', 'Uu']
        ];

        initString = initString.replace(/ /g, "");
        var from = (isBack) ? 1 : 0;
        var to = (isBack) ? 0 : 1;
        for (var i = 0, iMax = dictionary.length; i < iMax; i++) {
            initString = initString.replace(new RegExp(dictionary[i][from], "g"), dictionary[i][to]);
        }
        return initString;
    };

    /**
     * Az oszlopdiagram tengelybetű-méretét határozza meg.
     * 
     * @param {Number} x Az oszlop szélessége pixelben.
     * @returns {Number} Javasolt betűméret (px).
     */
    var axisTextSize = function(x) {
        var size = Math.sin(Math.pow(Math.min(x, 80), 0.92) / 40) * 40;
        return Math.min(size, 32);
    };

    /**
     * Egy szám helyett 0-t ad, ha az NaN, vagy infinite.
     * 
     * @param {Number} n Bejövő szám.
     * @returns {Number} n ha normális szám, 0 különben.
     */
    var orZero = function(n) {
        return isFinite(n) ? n : 0;
    };

    /**
     * Egy adott html elemről megállapítja, hogy melyik panelben van.
     * 
     * @param {Object} element A kérdéses html elem.
     * @returns {String} A tartalmazó panel Id-je, vagy null, ha ilyen nincs.
     */
    var getContainerPanelId = function(element) {
        if (element === null) {
            return null;
        } else if (element.nodeName.toLowerCase() === 'div' && element.id.substring(0, 5) === 'panel') {
            return element.id;
        } else {
            return getContainerPanelId(element.parentNode);
        }
    };

    /**
     * Megmutatja/elrejti a kért help-elemet.
     * 
     * @param {String} item A megmutatandó elem html-id-je.
     * Ha undefined, becsukja a help-et, ha null, az alapértelmezettet mutatja.
     * @returns {undefined}
     */
    var mainToolbar_help = function(item) {
        if (item === undefined) {
            document.getElementById("helpMask").style.opacity = 0;
            setTimeout(function() {
                document.getElementById("helpMask").style.display = "none";
            }, 100);
        } else if (item === null) {
            document.getElementById("helpMask").style.display = "block";
            d3.selectAll("#helpContent div[id]").style("display", "none");
            d3.selectAll("#helpContent #helpStart").style("display", null);
            d3.selectAll("#helpControl span").classed("activeHelp", false);
            d3.selectAll("#helpControl .startItem").classed("activeHelp", true);
            setTimeout(function() {
                document.getElementById("helpMask").style.opacity = 1;
            }, 5);
        } else {
            var domItem = d3.select(item);
            var link = domItem.attr("data-link");
            d3.selectAll("#helpControl .activeHelp").classed("activeHelp", false);
            domItem.classed("activeHelp", true);
            d3.selectAll("#helpContent div[id]").style("display", "none");
            d3.selectAll("#helpContent #" + link).style("display", null);
        }
    };

    /**
     * Egyel több, vagy kevesebb panel méretűre kicsinyít/nagyít.
     * 
     * @param {Integer} direction 1: 1-el több panel, -1: 1-el kevesebb.
     * @returns {undefined}
     */
    var mainToolbar_magnify = function(direction) {
        global.mediators[0].publish("magnify", direction);
        global.getConfig2();
    };

    /**
     * Bezárja az épp böngészett reportot.
     * 
     * @returns {undefined}
     */
    var mainToolbar_closeSide = function() {
        d3.select("#progressDiv").style("z-index", -1);
        global.mediators[0].publish("killside", 0);
        global.mediators[1].publish("killside", 1);
        global.getConfig2();
    };

    /**
     * Nézett oldalt vált.
     * 
     * @returns {undefined}
     */
    var mainToolbar_switchSide = function() {
        global.mediators[0].publish("changepanels");
        global.getConfig2();
    };

    /**
     * Új panelt hoz létre.
     * 
     * @param {String} panelType A létrehozandó panel típusa.
     * @returns {undefined}
     */
    var mainToolbar_createNewPanel = function(panelType) {
        global.mediators[0].publish('addPanel', panelType);
        global.mediators[1].publish('addPanel', panelType);
    };

    /**
     * Panelölővé változtatja a kurzort.
     * 
     * @param {Object} e A ráklikkelés esemény.
     * @returns {undefined}
     */
    var mainToolbar_killCursor = function(e) {
        e.stopPropagation();
        d3.selectAll("svg > *").style("pointer-events", "none");
        d3.select("body").style('cursor', 'crosshair');
        d3.select("body").on('click', function() {
            var event = d3.event;
            event.stopPropagation();
            d3.select("body").style('cursor', 'default');
            d3.select("body").on('click', null);
            d3.selectAll("svg > *").style("pointer-events", null);
            var targetId = '#' + global.getContainerPanelId(d3.event.target);
            global.mediators[0].publish('killPanel', targetId);
            global.mediators[1].publish('killPanel', targetId);
            global.getConfig2();
        });
    };

    /**
     * Elindítja az épp aktív oldal adatmentését.
     * 
     * @returns {undefined}
     */
    var mainToolbar_save = function() {
        global.mediators[0].publish('save');
        global.mediators[1].publish('save');
    };

    /**
     * Képként menti az összes látható panelt.
     * 
     * @returns {undefined}
     */
    var mainToolbar_saveAllImages = function() {
        var today = new Date();
        var todayString = today.toISOString().slice(0, 10) + "_" + today.toTimeString().slice(0, 8).split(":").join("-");
        d3.selectAll(".activeSide div.panel > svg").each(function(d, i) {
            saveSvgAsPng(this, todayString + "_P" + (i + 1), 2, panelWidth, panelHeight, 0, 0);
        });
    };


    /**
     * Frissíti az ikonok láthatóságát.
     * 
     * @returns {undefined}
     */
    var mainToolbar_refreshState = function() {
        var numberOfActiveSides = d3.selectAll(".container.activeSide")[0].length; // Hány aktív oldal van? (2 ha osztottkijelzős üzemmód, 1 ha nem.)

        // Alap láthatósági beállítás: ha osztottkijelzős a mód, akkor inaktívak a lokálisra ható gombok.
        d3.selectAll("#mainToolbar .onlyforreport")
                .classed("inactive", (numberOfActiveSides === 2));
        // Ha nem osztott kijelzős a mód, akkor finomhangoljuk a láthatóságot.
        if (numberOfActiveSides === 1) {

            // Megállapítjuk a program állapotát.
            var side = d3.selectAll("#container1.activeSide")[0].length; // Aktív oldal id-je, 0 vagy 1. Csak akkor ételmes, ha 1 aktív oldal van.
            var isContainsReport = d3.selectAll("#container" + side + " .HeadPanel_Browser").empty(); // True ha épp aktív reportkijelzés van, false ha nem.
            var panelNumber = d3.selectAll("#container" + side + " .panel")[0].length; // Az épp fennlevő panelek száma.

            // Ha már csak a fejlécpanel létezik, akkor a megölő inaktív.
            if (panelNumber === 1) {
                d3.selectAll("#mainToolbar .panelKiller").classed("inactive", true);
            }

            // Ha elértük a maximális számot, nem lehet újat létrehozni.
            if (panelNumber > global.maxPanelCount || !isContainsReport) {
                d3.selectAll("#mainToolbar .newpanel").classed("inactive", true);
            }

            // Ha nincs mutatott adat, akkor a mentés, és a bezárás gomb legyen inaktív.
            if (!isContainsReport) {
                d3.selectAll("#mainToolbar .save").classed("inactive", true);
                d3.selectAll("#mainToolbar .save, #mainToolbar #mainCloseButton").classed("inactive", true);
            }

            // Ha nincs területi dimenzió, a mappanel letiltása.
            if (global.facts[side]) {
                var isHaveTerritorial = false;
                for (var d = 0, dMax = global.facts[side].reportMeta.dimensions.length; d < dMax; d++) {
                    if (global.facts[side].reportMeta.dimensions[d].is_territorial === 1) {
                        isHaveTerritorial = true;
                        break;
                    }
                }
                d3.selectAll("#mainToolbar .mappanelcreator").classed("inactive", !isHaveTerritorial);
            }
        }

        // + és - gombok.
        d3.selectAll("#mainToolbar #mainPlusButton")
                .classed("inactive", (global.panelNumberOnScreen <= 1));
        d3.selectAll("#mainToolbar #mainMinusButton")
                .classed("inactive", (global.panelNumberOnScreen >= global.maxPanelCount));
    };

    var dialogTimeoutVar; // A dialógusablak időzített eltüntetését számontartó időzítő.

    /**
     * Dialógusablak beállítása/levétele.
     * 
     * @param {String} title A címe.
     * @param {String} body Az ablak hasában levő szöveg html kódja.
     * @param {String} leftButtonLabel Baloldali gomb szövege. Ha undefined, nincs bal gomb.
     * @param {Function} leftButtonFunction Baloldali gomb megnyomásakor lefutó függvény.
     * @param {String} rightButtonLabel Jobboldali gomb szövege. Ha undefined, nincs jobb gomb.
     * @param {Function} rightButtonFunction Jobboldali gomb megnyomásakor lefutó függvény.
     * @param {Integer} enterFunctionNumber Az enter melyik gombklikkelést hajtsa végre? (1: bal, 2: jobb, undefined: semmit se)
     * @returns {undefined}
     */
    var setDialog = function(title, body, leftButtonLabel, leftButtonFunction, rightButtonLabel, rightButtonFunction, enterFunctionNumber) {
        clearTimeout(dialogTimeoutVar);
        var dialogMask = d3.select("#dialogMask");
        if (enterFunctionNumber) {
            dialogMask.on("keydown", function() {
                if (d3.event && d3.event.keyCode === 13) {
                    if (enterFunctionNumber === 1 && leftButtonFunction) {
                        leftButtonFunction();
                    } else if (enterFunctionNumber === 2 && rightButtonFunction) {
                        rightButtonFunction();
                    }
                }
            });
        } else {
            dialogMask.on("keydown", null);
        }

        var leftButton = dialogMask.select("#dialogFirstButton");
        var rightButton = dialogMask.select("#dialogSecondButton");
        if (title === undefined) { // Ha üres a cím, eltüntetjük a panelt.
            if (dialogMask.style("display") !== "none") {
                dialogMask.style("opacity", 0);
                dialogTimeoutVar = setTimeout(function() {
                    dialogMask.style("display", "none");
                }, 200);
            }
        } else { // Különben megjelenítjük.
            dialogMask.select("h1")
                    .html(title);
            dialogMask.select("#dialogMessage")
                    .html(body);
            if (leftButtonLabel === undefined) {
                leftButton.classed("hidden", true);
                leftButton[0][0].onclick = undefined;
            } else {
                leftButton.html(leftButtonLabel);
                leftButton[0][0].onclick = leftButtonFunction;
                leftButton.classed("hidden", false);
            }
            if (rightButtonLabel === undefined) {
                rightButton.classed("hidden", true);
                rightButton[0][0].onclick = undefined;
            } else {
                rightButton.html(rightButtonLabel);
                rightButton[0][0].onclick = rightButtonFunction;
                rightButton.classed("hidden", false);
            }

            // Fókusz elvétele bármin is volt.
            rightButton[0][0].focus();
            rightButton[0][0].blur();
            dialogMask.style("display", "block");
            setTimeout(function() {
                dialogMask.style("opacity", 1);
                dialogMask.node().focus();
            }, 50);
        }
    };

////////////////////////////////////////////////////
// Lokálisan használt változók.
//////////////////////////////////////////////////

    {
        var writeOnDimColor = varsFromCSS.writeOnDimColor;
        var writeOnValColor = varsFromCSS.writeOnValColor;
    }

//////////////////////////////////////////////////
// Globálisan használt változók.
//////////////////////////////////////////////////

    {
        // Az értékek megjelenését színező színpaletta.
        var colorNA = 'grey';
        var colors = [
            '#40bddf',
            '#bad642',
            '#8c8014',
            '#22ada6',
            '#85c222',
            '#faeb4c',
            '#00a6d3',
            '#9eb060',
            '#43b57c',
            '#d4cc4c',
            '#3db8a3',
            '#80d4e9',
            '#9ccf61',
            '#bfe8f6',
            '#f7e306',
            '#b8bf5a',
            '#badb8e',
            '#c2b211',
            '#7d9c53',
            '#0885a4',
            '#fcf288',
            '#7dc772'];
        // A CSS-ből kiolvasott értékek.
        var mapBorder = parseInt(varsFromCSS.elementBorderSize);
        var rectRounding = parseInt(varsFromCSS.rounding);
        var panelWidth = parseInt(varsFromCSS.panelWidth);
        var panelMargin = parseInt(varsFromCSS.panelMargin);
        var panelHeight = parseInt(varsFromCSS.panelHeight);
        var panelBackgroundColor = varsFromCSS.panelBackgroundColor;
        var axisTextOpacity = varsFromCSS.axisTextOpacity;
        var fontSizeSmall = parseInt(varsFromCSS.fontSizeSmall);
        var mainToolbarHeight = parseInt(varsFromCSS.mainToolbarHeight);

        // Húzd-és-ejtsd működését vezérlő ojektum.
        var dragDropManager = {
            draggedSide: null, // A húzott objektum származási oldala (0 v 1).
            draggedType: null, // A húzott valami típusa: 0: dimenzió, 1: érték.
            draggedId: null, // A húzott valami ID-je.
            targetObject: null, // A dobás célpont objektuma.
            targetPanelId: null, // A dobás célpontpanelének ID-je.
            targetSide: null, // A dobás célpontpaneljének oldala (0 v 1).
            targetId: null, // A dobás által megváltoztatandó objektum ID-je.
            draggedMatchesTarget: function() {
                return (this.draggedSide === this.targetSide);
            }
        };

        {
            var outer = document.createElement("div");
            outer.style.visibility = "hidden";
            outer.style.width = "100px";
            outer.style.msOverflowStyle = "scrollbar";
            document.body.appendChild(outer);
            var widthNoScroll = outer.offsetWidth;
            outer.style.overflow = "scroll";
            // add innerdiv
            var inner = document.createElement("div");
            inner.style.width = "100%";
            outer.appendChild(inner);
            var widthWithScroll = inner.offsetWidth;
            // remove divs
            outer.parentNode.removeChild(outer);
            var scrollBarSize = widthNoScroll - widthWithScroll;
        }

    }

//////////////////////////////////////////////////
// A létrejövő, globálisan elérhető objektum
//////////////////////////////////////////////////

    return {
        // Globálisan elérendő változók.
        facts: [], // Az adatokat tartalmazó 2 elemű tömb.
        maxPanelCount: 6, // Egy oldalon levő panelek maximális száma.		
        panelNumberOnScreen: undefined, // Megjelenítendő panelszám soronként.
        mediators: [], // Az oldalak mediátorát tartalmazó 2 elemű tömb.
        baseLevels: [[], []], // A két oldal aktuális lefúrási szintjeit tartalmazó tömb.
        superMeta: undefined, // SuperMeta: az összes riport adatait tartalmazó leírás.
        scrollbarWidth: 10, // Scrollbarok szélessége.
        mapBorder: mapBorder, // A térképi elemek határvonal-vastagsága.
        fontSizeSmall: fontSizeSmall, // A legkisebb betűméret.
        panelBackgroundColor: panelBackgroundColor, // Panelek háttérszíne.
        panelWidth: panelWidth, // Panelek szélessége.
        panelHeight: panelHeight, // Panelek magassága.
        panelMargin: panelMargin, // Panelek margója.
        mainToolbarHeight: mainToolbarHeight, // A képernyő tetején levő toolbar magassága.
        selfDuration: 800, // A fő animációs időhossz (ms).
        legendOffsetX: 20, // A jelkulcs vízszintes pozicionálása.
        legendOffsetY: 15, // A jelkulcs függőleges pozicionálása.
        panelTitleHeight: 30, // A panelek fejlécének magassága.
        numberOffset: 35, // Ha a panel bal oldalán számkijelzés van a tengelyen, ennyi pixelt foglal.
        legendHeight: 20, // Jelkulcs magassága.
        rectRounding: rectRounding, // A téglalapi elemek sarkának lekerekítettsége.
        scaleRatio: undefined, // A képernyő svg elemeire vonatkozó nagyítás szorzója.
        colorNA: colorNA, // A "nem szám", ill "nem definiált" érték színezési színe.
        axisTextOpacity: axisTextOpacity, // Az oszlopdiagramok tengelyszövegének átlátszósága.
        dragDropManager: dragDropManager, // Húzd-és-ejtsd működését vezérlő ojektum.
        tooltip: undefined, // Épp aktuális tooltip törzse, html.
        secretToken: 'zzz', // Autentikáció után kapott token.
        secretUsername: undefined, // Sikeres autentikáció user-neve.
        maxEntriesIn1D: 150,
        maxEntriesIn2D: 1000,
        // Globálisan elérendő függvények.
        axisTextSize: axisTextSize, // Az oszlopdiagram tengelybetű-méretét határozza meg.
        getFromArrayByProperty: getFromArrayByProperty, // Megkeresi egy tömb elemét az elem egyik property-je alapján.
        positionInArrayByProperty: positionInArrayByProperty, // Megkeresi egy tömb elemének indexét az elem egyik property-je alapján.
        positionInArray: positionInArray, // Megnézi, hogy a tömb hányadik eleme egy érték.
        valueInRange: valueInRange, // Eldönti, hogy egy érték a [min, max) intervallumba esik-e?
        initGlobals: initGlobals, // Inicializálja a globális változókat a belépés után.
        readableColor: readableColor, //  Olvasható színt választ egy adott háttérszínhez.
        combineObjects: combineObjects, // Összekombinál két objektumot, ha egy property mindkettőben szerepel, akkor a másodikbeli értéke lesz, ha csak az elsőben, akkor az.
        getContainerPanelId: getContainerPanelId, // Egy adott html elemről megállapítja, hogy melyik panelben van.
        mainToolbar_help: mainToolbar_help, // Megmutatja/elrejti a kért help-elemet.
        mainToolbar_magnify: mainToolbar_magnify, // Egyel több, vagy kevesebb panel méretűre kicsinyít/nagyít.
        mainToolbar_closeSide: mainToolbar_closeSide, // Bezárja az épp böngészett reportot.
        mainToolbar_switchSide: mainToolbar_switchSide, // Nézett oldalt vált.
        mainToolbar_createNewPanel: mainToolbar_createNewPanel, // Új panelt hoz létre.
        mainToolbar_killCursor: mainToolbar_killCursor, // Panelölővé változtatja a kurzort.		
        mainToolbar_save: mainToolbar_save, // Elindítja az épp aktív oldal adatmentését.
        mainToolbar_saveAllImages: mainToolbar_saveAllImages,
        mainToolbar_refreshState: mainToolbar_refreshState, // Frissíti az ikonok láthatóságát.
        getConfig: getConfig, // Kiírja a pillanatnyilag meglevő panelek konfigurációját a konzolra.
        getConfig2: getConfigToHash, // A böngésző URL-jébe írja boomarkolhatóan hash-ként az állapotot.
        minifyInits: minifyInits, // Minifyol egy init-stringet, hogy az URL-kódolt verzió kisebb legyen.
        setDialog: setDialog, // Dialógusablak beállítása/levétele.
        get: get, // Aszinkron ajax adatletöltés GET-en át, hibakezeléssel.
        subclassOf: subclassOf, // Osztály származtatását megvalósító függvény.
        getStyleForScale: getStyleForScale, // Nagyítást/kicsinyítést végrehajtó style generálása.
        orZero: orZero, // Egy szám helyett 0-t ad, ha az NaN, vagy infinite.
        getAnimDuration: getAnimDuration, // Egy panel animálásának ideje.
        cleverRound3: cleverRound3, // Szám rövid kijelzése kiíráshoz, max 3 számkarakterrel. (pl. 3.51 Mrd.)
        cleverRound5: cleverRound5, // Szám rövid kijelzése kiíráshoz, max 5 számkarakterrel. (pl. 34514 M.)
        realCompare: realCompare, // Pótlás a picit hibásan működő localeCompare helyett.
        cleverCompress: cleverCompress, // Betömörít kiírt feliratokat a megadott helyre.
        rectanglePath: rectanglePath, // Egy SVG téglalapot kirajzoló path-t generál, opcionálisan lekerekített sarkokkal.
        colorValue: colorValue, // Megadja egy érték kijelzésének színét.
        color: color // Megadja egy dimenzióelem kijelzésének színét.
    };

}();
