/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2013 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 */
define('moxiecode/tiny_mce/plugins/emoji/conversions',
       [], function () {

    "use strict";

    var JIS_MAP = {
        "\ufbd7": "\u2122",
        "\uf7ef": "\u00ae",
        "\uf7ee": "\u00a9",
        "\uf7b1": "\u27bf",
        "\uf7f1": "\ud83d\udcf4",
        "\uf7f0": "\ud83d\udcf3",
        "\uf7ab": "\ud83d\udcf6",
        "\uf7bb": "\ud83d\udd33",
        "\uf7ba": "\ud83d\udd32",
        "\uf7a6": "\u2733",
        "\uf7a5": "\u2734",
        "\uf7a4": "\ud83d\udc9f",
        "\uf7b9": "\ud83d\udd34",
        "\uf76c": "\u303d",
        "\uf971": "\ud83d\udd31",
        "\uf7a7": "\ud83d\udd1e",
        "\uf9b5": "\u3299",
        "\uf9ad": "\u3297",
        "\uf7b8": "\ud83c\ude38",
        "\uf7b7": "\ud83c\ude37",
        "\uf7b6": "\ud83c\ude1a",
        "\uf7b5": "\ud83c\ude36",
        "\uf7c9": "\ud83c\udd94",
        "\uf7cd": "\ud83c\ude3a",
        "\uf7cc": "\ud83c\ude2f",
        "\uf7c8": "\ud83c\ude02",
        "\uf7c7": "\ud83c\ude39",
        "\uf7c6": "\ud83c\ude50",
        "\uf7cb": "\ud83c\ude33",
        "\uf7ca": "\ud83c\ude35",
        "\uf76e": "\ud83c\udd9a",
        "\uf7a3": "\ud83c\ude01",
        "\uf7b4": "\ud83c\udd92",
        "\uf7b3": "\ud83c\udd99",
        "\uf7b2": "\ud83c\udd95",
        "\uf7ec": "\ud83d\udd1d",
        "\uf7ed": "\ud83c\udd97",
        "\uf773": "\ud83c\udfb0",
        "\uf78a": "\ud83d\udcb1",
        "\uf78b": "\ud83d\udcb9",
        "\ufbd5": "\ud83c\udd7e",
        "\ufbd4": "\ud83c\udd8e",
        "\ufbd3": "\ud83c\udd71",
        "\ufbd2": "\ud83c\udd70",
        "\uf7eb": "\u26ce",
        "\uf7ea": "\u2653",
        "\uf7e9": "\u2652",
        "\uf7e8": "\u2651",
        "\uf7e7": "\u2650",
        "\uf7e6": "\u264f",
        "\uf7e5": "\u264e",
        "\uf7e4": "\u264d",
        "\uf7e3": "\u264c",
        "\uf7e2": "\u264b",
        "\uf7e1": "\u264a",
        "\uf7e0": "\u2649",
        "\uf7df": "\u2648",
        "\uf7de": "\ud83d\udd2f",
        "\uf7b0": "#\u20e3",
        "\uf7c5": "0\u20e3",
        "\uf7c4": "9\u20e3",
        "\uf7c3": "8\u20e3",
        "\uf7c2": "7\u20e3",
        "\uf7c1": "6\u20e3",
        "\uf7c0": "5\u20e3",
        "\uf7bf": "4\u20e3",
        "\uf7be": "3\u20e3",
        "\uf7bd": "2\u20e3",
        "\uf7bc": "1\u20e3",
        "\uf7d1": "\ud83d\udc49",
        "\uf7d0": "\ud83d\udc48",
        "\uf7cf": "\ud83d\udc47",
        "\uf7ce": "\ud83d\udc46",
        "\uf7dd": "\u23ea",
        "\uf7dc": "\u23e9",
        "\uf7db": "\u25c0",
        "\uf7da": "\u25b6",
        "\uf7d5": "\u2b05",
        "\uf7d4": "\u27a1",
        "\uf7d3": "\u2b07",
        "\uf7d2": "\u2b06",
        "\uf7d9": "\u2199",
        "\uf7d8": "\u2198",
        "\uf7d7": "\u2196",
        "\uf7d6": "\u2197",
        "\uf7af": "\u2663",
        "\uf7ae": "\u2660",
        "\uf7ad": "\u2666",
        "\uf7ac": "\u2665",
        "\uf9d3": "\u274c",
        "\uf9d2": "\u2b55",
        "\uf780": "\ud83d\udec0",
        "\uf9be": "\ud83d\udc86",
        "\uf9bd": "\ud83d\udc85",
        "\uf9bf": "\ud83d\udc87",
        "\uf9c0": "\ud83d\udc88",
        "\ufba2": "\ud83c\udfa8",
        "\uf765": "\ud83c\udfab",
        "\uf9c4": "\ud83c\udfac",
        "\uf97d": "\ud83c\udfa5",
        "\uf981": "\ud83c\udfb7",
        "\uf983": "\ud83c\udfba",
        "\uf982": "\ud83c\udfb8",
        "\uf9b6": "\ud83d\udcbd",
        "\uf769": "\ud83d\udcfc",
        "\uf767": "\ud83d\udcc0",
        "\uf766": "\ud83d\udcbf",
        "\uf9aa": "\ud83c\udfa7",
        "\uf97c": "\ud83c\udfa4",
        "\uf782": "\ud83d\udd0a",
        "\uf78c": "\ud83d\udce1",
        "\uf768": "\ud83d\udcfb",
        "\uf948": "\ud83d\udcf7",
        "\uf9bc": "\ud83d\udc84",
        "\uf975": "\ud83d\udc8e",
        "\uf974": "\ud83d\udc8d",
        "\ufb7c": "\ud83c\udf02",
        "\uf75e": "\ud83d\udcbc",
        "\uf9c3": "\ud83d\udc5c",
        "\uf9b8": "\ud83d\udc52",
        "\ufba3": "\ud83c\udfa9",
        "\uf9b4": "\ud83c\udf80",
        "\uf9bb": "\ud83d\udc62",
        "\uf9ba": "\ud83d\udc61",
        "\uf77e": "\ud83d\udc60",
        "\uf947": "\ud83d\udc5f",
        "\uf9a2": "\ud83d\udc54",
        "\uf9c2": "\ud83d\udc59",
        "\uf9c1": "\ud83d\udc58",
        "\uf9b9": "\ud83d\udc57",
        "\uf946": "\ud83d\udc55",
        "\uf775": "\ud83d\udea4",
        "\uf957": "\ud83c\udfc4",
        "\ufb6d": "\ud83c\udfca",
        "\ufb6c": "\ud83c\udfb1",
        "\ufb6b": "\ud83c\udfc8",
        "\uf953": "\ud83c\udfbf",
        "\uf954": "\u26f3",
        "\ufb6a": "\ud83c\udfc0",
        "\uf955": "\ud83c\udfbe",
        "\uf956": "\u26be",
        "\uf958": "\u26bd",
        "\uf96e": "\ud83d\udd5a",
        "\uf96d": "\ud83d\udd59",
        "\uf96c": "\ud83d\udd58",
        "\uf96b": "\ud83d\udd57",
        "\uf96a": "\ud83d\udd56",
        "\uf969": "\ud83d\udd55",
        "\uf968": "\ud83d\udd54",
        "\uf967": "\ud83d\udd53",
        "\uf966": "\ud83d\udd52",
        "\uf965": "\ud83d\udd51",
        "\uf964": "\ud83d\udd50",
        "\uf96f": "\ud83d\udd5b",
        "\uf781": "\ud83d\udebd",
        "\uf77b": "\ud83d\udc89",
        "\uf9af": "\ud83d\udc8a",
        "\uf9ae": "\ud83d\udeac",
        "\uf75f": "\ud83d\udcba",
        "\uf94b": "\ud83d\udce0",
        "\uf949": "\u260e",
        "\uf94a": "\ud83d\udcf1",
        "\uf744": "\ud83d\udcf2",
        "\uf743": "\ud83d\udce9",
        "\uf94c": "\ud83d\udcbb",
        "\uf76a": "\ud83d\udcfa",
        "\uf9b3": "\u2702",
        "\uf9a1": "\ud83d\udcdd",
        "\uf789": "\ud83d\udcd6",
        "\uf76f": "\ud83d\udcb0",
        "\uf786": "\ud83d\udd13",
        "\uf785": "\ud83d\udd12",
        "\uf980": "\ud83d\udd11",
        "\ufbb4": "\ud83c\uddf0\ud83c\uddf7",
        "\ufbb3": "\ud83c\udde8\ud83c\uddf3",
        "\ufbb2": "\ud83c\uddf7\ud83c\uddfa",
        "\ufbb1": "\ud83c\uddea\ud83c\uddf8",
        "\ufbb0": "\ud83c\uddec\ud83c\udde7",
        "\ufbaf": "\ud83c\uddee\ud83c\uddf9",
        "\ufbae": "\ud83c\udde9\ud83c\uddea",
        "\ufbad": "\ud83c\uddeb\ud83c\uddf7",
        "\ufbac": "\ud83c\uddfa\ud83c\uddf8",
        "\ufbab": "\ud83c\uddef\ud83c\uddf5",
        "\uf77a": "\ud83d\udebc",
        "\uf779": "\ud83d\udeba",
        "\uf778": "\ud83d\udeb9",
        "\ufba7": "\ud83c\udfa6",
        "\uf7aa": "\u267f",
        "\uf9a9": "\ud83d\udebe",
        "\uf792": "\ud83d\udebb",
        "\uf790": "\ud83c\udd7f",
        "\uf7a9": "\ud83d\udd30",
        "\uf777": "\ud83d\udea7",
        "\uf7f2": "\u26a0",
        "\uf78f": "\ud83d\udea5",
        "\uf791": "\ud83d\ude8f",
        "\u0000": "\u26fd", //FIXME
        "\uf763": "\u2668",
        "\uf762": "\u26fa",
        "\uf761": "\u26f2",
        "\ufb73": "\ud83c\udfa2",
        "\uf764": "\ud83c\udfa1",
        "\ufba8": "\ud83c\udfed",
        "\ufbaa": "\u0000", //FIXME
        "\ufba9": "\ud83d\uddfc",
        "\ufba6": "\ud83c\udff0",
        "\ufba5": "\ud83c\udfef",
        "\uf977": "\u26ea",
        "\ufb7d": "\ud83d\udc92",
        "\ufba4": "\ud83c\udfec",
        "\ufba1": "\ud83c\udfe9",
        "\uf799": "\ud83c\udfe8",
        "\uf798": "\ud83c\udfeb",
        "\uf797": "\ud83c\udfea",
        "\uf796": "\ud83c\udfe5",
        "\ufb8b": "\ud83c\udf07",
        "\ufb8a": "\ud83c\udf05",
        "\uf98e": "\ud83c\udf04",
        "\ufb69": "\ud83d\udc6f",
        "\ufbbf": "\ud83d\udc83",
        "\uf76d": "\ud83c\udc04",
        "\uf772": "\ud83c\udfc1",
        "\uf9b7": "\ud83d\udce3",
        "\uf783": "\ud83d\udce2",
        "\uf9b1": "\ud83d\udca3",
        "\uf75d": "\ud83d\udd25",
        "\uf756": "\ud83d\udd28",
        "\uf753": "\ud83d\udd2b",
        "\uf9b0": "\ud83c\udf88",
        "\uf74f": "\ud83d\udca1",
        "\uf754": "\ud83d\udd0d",
        "\uf9c5": "\ud83d\udd14",
        "\uf770": "\ud83c\udfaf",
        "\uf74e": "\ud83d\udc51",
        "\uf771": "\ud83c\udfc6",
        "\uf9b2": "\ud83c\udf89",
        "\uf9eb": "\ud83c\udf82",
        "\uf752": "\ud83c\udf81",
        "\uf759": "\ud83c\udf42",
        "\ufb85": "\ud83c\udf3e",
        "\ufb88": "\ud83c\udf43",
        "\uf9a8": "\ud83c\udf35",
        "\uf9a7": "\ud83c\udf34",
        "\uf9a6": "\ud83d\udc90",
        "\uf9a5": "\ud83c\udf3b",
        "\uf9a3": "\ud83c\udf3a",
        "\uf972": "\ud83c\udf39",
        "\uf750": "\ud83c\udf40",
        "\uf758": "\ud83c\udf41",
        "\uf9a4": "\ud83c\udf37",
        "\uf970": "\ud83c\udf38",
        "\uf97b": "\ud83d\uddfb",
        "\ufb8d": "\ud83c\udf08",
        "\ufb7e": "\ud83c\udf0a",
        "\ufb84": "\ud83c\udf00",
        "\uf77d": "\u26a1",
        "\uf98d": "\ud83c\udf19",
        "\uf989": "\u26c4",
        "\uf98a": "\u2601",
        "\uf98c": "\u2614",
        "\uf98b": "\u2600",
        "\ufb68": "\ud83d\udc6b",
        "\ufb65": "\ud83d\udc91",
        "\uf751": "\ud83d\udc8f",
        "\uf9d4": "\ud83d\udca2",
        "\uf77c": "\ud83d\udca4",
        "\uf9d1": "\ud83d\udca6",
        "\uf9d0": "\ud83d\udca8",
        "\uf755": "\ud83c\udfc3",
        "\uf7a1": "\ud83d\udeb6",
        "\ufbd6": "\ud83d\udc63",
        "\ufb66": "\ud83d\ude47",
        "\ufb63": "\ud83d\ude45",
        "\ufb64": "\ud83d\ude46",
        "\ufb62": "\ud83d\udc50",
        "\ufb67": "\ud83d\ude4c",
        "\ufb5a": "\ud83d\udc43",
        "\ufb5b": "\ud83d\udc42",
        "\ufb59": "\ud83d\udc40",
        "\ufb48": "\ud83d\ude2a",
        "\ufb4c": "\ud83d\ude37",
        "\ufb56": "\ud83d\ude21",
        "\uf99a": "\ud83d\ude20",
        "\uf747": "\ud83d\ude31",
        "\ufb50": "\ud83d\ude32",
        "\ufb52": "\ud83d\ude02",
        "\ufb51": "\ud83d\ude2d",
        "\ufb53": "\ud83d\ude22",
        "\ufb46": "\ud83d\ude23",
        "\ufb4b": "\ud83d\ude28",
        "\ufb4f": "\ud83d\ude30",
        "\ufb41": "\ud83d\ude25",
        "\ufb47": "\ud83d\ude16",
        "\uf999": "\ud83d\ude1e",
        "\ufb43": "\ud83d\ude14",
        "\ufb57": "\ud83d\ude1a",
        "\ufb58": "\ud83d\ude18",
        "\uf746": "\ud83d\ude0d",
        "\ufb45": "\ud83d\ude09",
        "\ufb54": "\u263a",
        "\uf998": "\ud83d\ude03",
        "\uf997": "\ud83d\ude0a",
        "\ufb55": "\ud83d\ude04",
        "\ufb4d": "\ud83d\ude33",
        "\ufb4a": "\ud83d\ude0c",
        "\ufb44": "\ud83d\ude01",
        "\uf745": "\ud83d\ude1c",
        "\ufb49": "\ud83d\ude1d",
        "\ufb4e": "\ud83d\ude12",
        "\ufb42": "\ud83d\ude0f",
        "\uf748": "\ud83d\ude13",
        "\uf962": "\u2764",
        "\uf963": "\ud83d\udc94",
        "\uf9c7": "\ud83d\udc93",
        "\uf9c8": "\ud83d\udc97",
        "\uf9c9": "\ud83d\udc98",
        "\uf9ca": "\ud83d\udc99",
        "\uf9cb": "\ud83d\udc9a",
        "\uf9cc": "\ud83d\udc9b",
        "\uf9cd": "\ud83d\udc9c",
        "\uf961": "\u2757",
        "\uf9d7": "\u2755",
        "\uf960": "\u2753",
        "\uf9d6": "\u2754",
        "\uf97e": "\ud83c\udfb5",
        "\uf9c6": "\ud83c\udfb6",
        "\uf9ce": "\u2728",
        "\uf9cf": "\u2b50",
        "\uf9d5": "\ud83c\udf1f",
        "\uf950": "\u270a",
        "\uf951": "\u270c",
        "\uf952": "\u270b",
        "\uf94e": "\ud83d\udc4d",
        "\uf94d": "\ud83d\udc4a",
        "\uf94f": "\u261d",
        "\ufb60": "\ud83d\udc4c",
        "\ufb61": "\ud83d\udc4e",
        "\ufb5d": "\ud83d\ude4f",
        "\ufb5e": "\ud83d\udc4b",
        "\ufb5f": "\ud83d\udc4f",
        "\uf78d": "\ud83d\udcaa",
        "\uf943": "\ud83d\udc8b",
        "\ufb5c": "\ud83d\udc44",
        "\uf787": "\ud83c\udf06",
        "\ufb8c": "\ud83c\udf03",
        "\ufb76": "\ud83c\udf8d",
        "\ufb77": "\ud83d\udc9d",
        "\ufb78": "\ud83c\udf8e",
        "\ufb79": "\ud83c\udf93",
        "\ufb7a": "\ud83c\udf92",
        "\ufb7b": "\ud83c\udf8f",
        "\uf757": "\ud83c\udf86",
        "\ufb81": "\ud83c\udf87",
        "\ufb83": "\ud83c\udf90",
        "\ufb87": "\ud83c\udf91",
        "\ufb86": "\ud83c\udf83",
        "\ufb89": "\ud83c\udf85",
        "\uf973": "\ud83c\udf84",
        "\uf990": "\ud83d\udc31",
        "\uf993": "\ud83d\udc36",
        "\uf74b": "\ud83d\udc37",
        "\uf994": "\ud83d\udc2d",
        "\uf991": "\ud83d\udc2f",
        "\uf749": "\ud83d\udc35",
        "\uf992": "\ud83d\udc3b",
        "\ufbcc": "\ud83d\udc30",
        "\ufbcb": "\ud83d\udc2e",
        "\ufbc7": "\ud83d\udc28",
        "\ufbc4": "\ud83d\udc39",
        "\ufbd1": "\ud83d\udc38",
        "\uf95a": "\ud83d\udc34",
        "\ufbca": "\ud83d\udc3a",
        "\ufbcf": "\ud83d\udc17",
        "\ufbd0": "\ud83d\udc2b",
        "\ufbc8": "\ud83d\udc12",
        "\uf774": "\ud83d\udc0e",
        "\ufbc6": "\ud83d\udc18",
        "\ufbc9": "\ud83d\udc11",
        "\ufbce": "\ud83d\udc14",
        "\ufbc3": "\ud83d\udc24",
        "\ufbc1": "\ud83d\udc26",
        "\uf996": "\ud83d\udc27",
        "\uf995": "\ud83d\udc33",
        "\ufbc0": "\ud83d\udc2c",
        "\uf959": "\ud83d\udc1f",
        "\ufbc2": "\ud83d\udc20",
        "\uf74a": "\ud83d\udc19",
        "\ufbcd": "\ud83d\udc0d",
        "\ufbc5": "\ud83d\udc1b",
        "\ufb82": "\ud83d\udc1a",
        "\uf941": "\ud83d\udc66",
        "\uf942": "\ud83d\udc67",
        "\uf944": "\ud83d\udc68",
        "\uf945": "\ud83d\udc69",
        "\ufbb8": "\ud83d\udc74",
        "\ufbb9": "\ud83d\udc75",
        "\ufbba": "\ud83d\udc76",
        "\uf7f3": "\ud83d\udc81",
        "\uf793": "\ud83d\udc6e",
        "\ufbbb": "\ud83d\udc77",
        "\ufbb5": "\ud83d\udc71",
        "\ufbb6": "\ud83d\udc72",
        "\ufbb7": "\ud83d\udc73",
        "\ufbbe": "\ud83d\udc82",
        "\ufbbd": "\ud83d\uddfd",
        "\ufbbc": "\ud83d\udc78",
        "\uf98f": "\ud83d\udc7c",
        "\uf75a": "\ud83d\udc7f",
        "\uf75b": "\ud83d\udc7b",
        "\uf75c": "\ud83d\udc80",
        "\uf74c": "\ud83d\udc7d",
        "\uf76b": "\ud83d\udc7e",
        "\uf99b": "\ud83d\udca9",
        "\uf984": "\ud83c\udf74",
        "\uf988": "\ud83c\udf7a",
        "\uf9ac": "\ud83c\udf7b",
        "\uf985": "\ud83c\udf78",
        "\uf9ab": "\ud83c\udf76",
        "\uf9d8": "\ud83c\udf75",
        "\uf986": "\u2615",
        "\uf987": "\ud83c\udf70",
        "\uf9da": "\ud83c\udf66",
        "\uf9dc": "\ud83c\udf61",
        "\uf9dd": "\ud83c\udf58",
        "\ufb80": "\ud83c\udf67",
        "\uf9e2": "\ud83c\udf59",
        "\uf9de": "\ud83c\udf5a",
        "\uf9d9": "\ud83c\udf5e",
        "\uf760": "\ud83c\udf54",
        "\uf9e1": "\ud83c\udf5b",
        "\uf9df": "\ud83c\udf5d",
        "\uf9e0": "\ud83c\udf5c",
        "\uf9e4": "\ud83c\udf63",
        "\uf9ec": "\ud83c\udf71",
        "\uf9ed": "\ud83c\udf72",
        "\uf9e3": "\ud83c\udf62",
        "\uf9db": "\ud83c\udf5f",
        "\uf788": "\ud83c\udf73",
        "\uf9e5": "\ud83c\udf4e",
        "\uf9e7": "\ud83c\udf53",
        "\uf9e6": "\ud83c\udf4a",
        "\uf9e8": "\ud83c\udf49",
        "\uf9e9": "\ud83c\udf45",
        "\uf9ea": "\ud83c\udf46",
        "\uf784": "\ud83c\udf8c",
        "\uf776": "\ud83d\udeb2",
        "\uf95b": "\ud83d\ude97",
        "\ufb6e": "\ud83d\ude99",
        "\uf79a": "\ud83d\ude8c",
        "\ufb6f": "\ud83d\ude9a",
        "\ufb72": "\ud83d\ude93",
        "\ufb71": "\ud83d\ude91",
        "\ufb70": "\ud83d\ude92",
        "\uf79b": "\ud83d\ude95",
        "\uf95e": "\ud83d\ude83",
        "\ufb74": "\ud83d\ude87",
        "\uf979": "\ud83d\ude89",
        "\uf95f": "\ud83d\ude85",
        "\ufb75": "\ud83d\ude84",
        "\uf7a2": "\ud83d\udea2",
        "\uf95c": "\u26f5",
        "\uf95d": "\u2708",
        "\uf74d": "\ud83d\ude80",
        "\uf7a8": "\ud83d\udead",
        "\uf976": "\ud83c\udfe0",
        "\uf978": "\ud83c\udfe2",
        "\uf741": "\ud83d\udceb",
        "\uf742": "\ud83d\udcee",
        "\uf794": "\ud83c\udfe3",
        "\uf78e": "\ud83c\udfe6",
        "\uf795": "\ud83c\udfe7"
    };

    var EMOJI_JIS_RE = null;

    function createRegexp(map) {
        var keys = Object.keys(map);
        keys.sort(function (a, b) {
            return b.length - a.length;
        });
        return new RegExp('(' + keys.join('|') + ')', 'g');
    }

    function jisToUnified(text) {
        if (!EMOJI_JIS_RE) {
            EMOJI_JIS_RE = createRegexp(JIS_MAP);
        }
        return text.replace(EMOJI_JIS_RE, function (_, m) {
            return JIS_MAP[m];
        });
    }

    return {
        jisToUnified: jisToUnified
    };
});
