function getUniqueBrowserNames(jsonstr){
    var browserArray = new Array();
    for (var j = 0; j < jsonstr.length; j++) {
        var browsername = getBrowserNameFromResult(jsonstr[j]);
        browserArray.push(browsername);
    }
    return browserArray.filter(uniqueFilter);
}

function getBrowserNameFromResult(result){
    return result.description.split('|')[1];
}

function getTestNameFromResult(result){
    return result.description.split('|')[0]
}

function uniqueFilter(value, index, self) {
    return self.indexOf(value) === index;
}

function determineTestStatus(run){
    var assertions = run.assertions;
    var runDuration = run.duration;
    var assertionsArray = new Array();
    var passed = "";
    var failedAssertions = new Array();
    for (var i = 0; i < assertions.length; i++) {
        assertionsArray.push(assertions[i].passed);
    }
    if (assertionsArray.length > 0) {
        for (var j = 0; j < assertionsArray.length; j++) {
            if (assertionsArray[j] == false) {
                failedAssertions.push("failed");
            }
            if (failedAssertions.length > 0) {
                passed = "false";
            }
            if (failedAssertions.length <= 0) {
                if(runDuration <= 1) {
                    passed = "Skipped";
                }else {
                    passed = "true";
                }
            }
        }
    } else {
        passed = "true";
    }
    return passed;
}

function countPassed(allResults){
    var pass = 0;
    for (var p1 = 0; p1 < allResults.length; p1++) {
        if (allResults[p1] === "true")
            pass++;
    }
    return pass;
}

function countFailed(allResults){
    var fail = 0;
    for (var p1 = 0; p1 < allResults.length; p1++) {
        if(allResults[p1] === "false")
            fail++;
    }
    return fail;
}

function countSkipped(allResults){
    var skipped = 0;
    for (var p1 = 0; p1 < allResults.length; p1++) {
        if(allResults[p1] === "Skipped")
            skipped++;
    }
    return skipped;
}

/**
 * Escapes all potentially dangerous characters, so that the
 * resulting string can be safely inserted into attribute or
 * element text.
 * @param value
 * @returns {string} escaped text
 */
function encodeEntities(value) {
    var SURROGATE_PAIR_REGEXP = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
// Match everything outside of normal chars and " (quote character)
        NON_ALPHANUMERIC_REGEXP = /([^\#-~| |!])/g;

    return value.
    replace(/&/g, '&amp;').
    replace(SURROGATE_PAIR_REGEXP, function(value) {
        var hi = value.charCodeAt(0);
        var low = value.charCodeAt(1);
        return '&#' + (((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000) + ';';
    }).
    replace(NON_ALPHANUMERIC_REGEXP, function(value) {
        return '&#' + value.charCodeAt(0) + ';';
    }).
    replace(/</g, '&lt;').
    replace(/>/g, '&gt;');
}

module.exports = {
    getUniqueBrowserNames: getUniqueBrowserNames,
    getBrowserNameFromResult: getBrowserNameFromResult,
    getTestNameFromResult: getTestNameFromResult,
    determineTestStatus: determineTestStatus,
    countPassed: countPassed,
    countFailed: countFailed,
    countSkipped: countSkipped,
    encodeEntities: encodeEntities
};