/* Lokális értékek beállítása */

'use strict';

// Az adatok beszerzési url-je
// Lokális gép
var baseUrl = "http://localhost:8080/AgnosReportingServer";
//var baseUrl = "http://192.168.123.18/AgnosReportingServer";
//var baseUrl = "http://10.64.4.21:7979/AgnosReportingServer";  // Zsolt gépe

global.url = {
    auth: baseUrl + "/auth/login",
    superMeta: baseUrl + "/meta/cubes",
    meta: baseUrl + "/meta/cube",
    fact: baseUrl + "/cube"};

global.i18nRequired = true;
global.saveToBookmarkRequired = true;
global.demoEntry = true;

// Astar demo
//global.url = {
//    auth: "https://demo-diy.aeek.hu/DIYBridge/auth/login",
//    superMeta: "https://demo-diy.aeek.hu/DIYBridge/meta/cubes",
//    meta: "https://demo-diy.aeek.hu/DIYBridge/meta/cube",
//    fact: "https://demo-diy.aeek.hu/DIYBridge/cube"};


// Zsolt gépe
//global.url = {
//    auth: "http://10.64.4.21:8080/DIYBridge/auth/login",
//    superMeta: "http://10.64.4.21:8080/DIYBridge/meta/cubes",
//    meta: "http://10.64.4.21:8080/DIYBridge/meta/cube",
//    fact: "http://10.64.4.21:8080/DIYBridge/cube"};

// Enxémnagyobb
//  global.url = {
//	auth: "http://localhost:8080/DIYBridge/auth/login",
// superMeta: "http://localhost:8080/DIYBridge/meta/cubes",
//	meta: "http://localhost:8080/DIYBridge/meta/cube",
// 	fact: "http://localhost:8080/DIYBridge/cube"};


// Zsolt gépe, kloúdszerver
//global.url = {
//	auth: "http://10.64.4.14:7979/CloudServer/webresources/auth/login",
//	superMeta: "http://10.64.4.14:7979/CloudServer/webresources/meta/cubes",
//	meta: "http://10.64.4.14:7979/CloudServer/webresources/meta/cube",
//	fact: "http://10.64.4.14:7979/CloudServer/webresources/cube"};


//webszerver, éles
//global.url = {
//    auth: "https://karteritesiugyek.aeek.hu/Karterites/webresources/auth/login",
//    superMeta: "https://karteritesiugyek.aeek.hu/Karterites/webresources/meta/cubes",
//    meta: "https://karteritesiugyek.aeek.hu/Karterites/webresources/meta/cube",
//    fact: "https://karteritesiugyek.aeek.hu/Karterites/webresources/cube"};


