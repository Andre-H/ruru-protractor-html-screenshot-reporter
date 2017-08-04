var fs = require('fs');
var path = require('path');
var reporter = require('./reporter.js');

const __featureDenominator = 'Feature: ';
const __scenarioDenominator = ' - Scenario: ';

function HTMLScreenshotReporter(options) {

	var self = this;
	self.tsStart = new Date();

	options.title = options.title || 'Protractor End to End Test Report';
	options.screenshotsFolder = options.screenshotsFolder || 'screenshots';
	options.fileName = options.fileName || 'protractor-e2e-report.html';
	options.targetPath = options.targetPath || 'target';
	options.takeScreenShotsForPassedSpecs = options.takeScreenShotsForPassedSpecs === undefined? true : options.takeScreenShotsForPassedSpecs;

	self.jasmineStarted = function (summary) {};

	self.suiteStarted = function (suite) {};

	self.specStarted = function (spec) {
		var featureName = spec.fullName.replace(spec.description, '');
		spec.description = __featureDenominator + featureName + __scenarioDenominator + spec.description;
		browser.currentTest = spec.description;
		if(browser.browserName){
			spec.description += '|' + browser.browserName;
			browser.currentTest += '|' + browser.browserName;
			if(browser.browserVersion){
				spec.description +=  '-' + browser.version;
			}
		}
		spec.fullName = spec.description;
	};

	self.specDone = function (spec) {
		if(options.takeScreenShotsForPassedSpecs || (spec.assertions[0] && !spec.assertions[0].passed)){
      browser.takeScreenshot().then(function (png) {
        writeScreenShot(png, path.join(options.targetPath, options.screenshotsFolder, sanitizeFilename(spec.description)) + '.png');
      });
    }
	};

	self.suiteDone = function (suite) {};

	self.jasmineDone = function () {};

	self.generateHtmlReport = function (inputFile) {
		var jsonResult = require(path.resolve(inputFile));
		var result = generateReport(jsonResult, options.title, elapsedTime(self.tsStart, Date.now()));
		fs.writeFileSync(path.resolve(options.targetPath, options.fileName), result);
	};

	var writeScreenShot = function (data, filePath) {
		var stream = fs.createWriteStream(filePath);
		stream.write(new Buffer(data, 'base64'));
		stream.end();
	};

	var sanitizeFilename = function (name) {
		name = name.replace(/\s+/g, '-'); // Replace white space with dash
		return name.replace(/[^0-9a-zA-Z\-]/gi, ''); // Strip any special characters except the dash
	};

	function generateReport(jsonstr, automationHeader, elapsedTime) {
		var allResults = [];
		var testArray = [];
		var browserArrayUnique = reporter.getUniqueBrowserNames(jsonstr);

		for (var q = 0; q < jsonstr.length; q++) {
			var browserName = reporter.getBrowserNameFromResult(jsonstr[q]);
			var testName = reporter.getTestNameFromResult(jsonstr[q]);
			var passed = reporter.determineTestStatus(jsonstr[q]);
			var stack = [];
			stack = consolidateAllStackTraces(jsonstr[q]);
			allResults.push(passed);
			testArray.push({
				testName : testName,
				browser : browserName,
				res : passed,
				duration: jsonstr[q].duration,
				stackTrace:  stack
			});
		}

		var result = '';
		result += '<!-- saved from url=(0014)about:internet -->';
		result += '<!DOCTYPE html>';
		result += '<html>';
		result += concatHeadSection();
		result += '<body>';
		result += concatReportHeaderSection(automationHeader);
		result += concatRunInfoSection(elapsedTime);
		result += concatReportSummary(allResults);
		result += concatKnownIssues();
		result += concatSpecResults(testArray, browserArrayUnique);
		result += '</body>';
		result += '</html>';
		return result;
	}

	function consolidateAllStackTraces (run){
		var assertions = (run.assertions)? run.assertions : [];
		var stk = [];
		for (var i = 0; i < assertions.length; i++) {
			if(assertions[i].passed === false){
				if(assertions[i].errorMsg){
					stk.push(assertions[i].errorMsg);
				}
				if(assertions[i].stackTrace){
					var stckTrc = assertions[i].stackTrace.split('\n');
					for(var j=0; j<stckTrc.length; j++){
						stk.push(stckTrc[j]);
					}
				}
			}
		}
		return stk;
	}

	function concatSpecResults(testArray, browsers){

		var features = copyResultsToFeatureCollection(testArray);
		var countIndex = 0;
		var result = '';
		var timeTrack = {};
		browsers.sort();

		for (var b=0; b < browsers.length; b++) {
			timeTrack[browsers[b]] = {};
		}

		for(var f in features){
			if(!features.hasOwnProperty(f)){
				continue;
			}
			var feature = features[f];
			result += '<table class="testlist">';

			result += concatSpecTableHeader(f, browsers);

			var featureDuration = {};

			for(var scen in feature){

				if (!feature.hasOwnProperty(scen)) {
          continue;
				} else {
          countIndex++;
        }
        var scene = feature[scen];

				result += '<tr><td>' + countIndex + '</td><td class="testname">' + scen + '</td>';

				var exceptions = [];
				for (b=0; b < browsers.length; b++) {
					var browserName = browsers[b];
					if(featureDuration[browserName]===undefined){
						featureDuration[browserName] = 0;
					}
					for (var run in scene) {
            if(!scene.hasOwnProperty(run)){
              continue;
            }
            var r = scene[run];
						if (browserName === r.name) {
							featureDuration[browserName] += r.duration;

							if(timeTrack[browserName][f]===undefined){
								timeTrack[browserName][f] = 0;
							}

							timeTrack[browserName][f] += r.duration;

							if (r.status === "true") {
								result += '<td class="pass">' + linkToScreenshot(scen, browserName) + 'PASS</a>' +
									' <span class="miliss">'+(r.duration/1000).toFixed(2)+'s.</span></td>';
							}
							if (r.status === "false") {
								result += '<td class="fail">FAIL - <a href="javascript:void(0)" onclick="showhide(\''+sanitizeFilename(scen) +'\', \'' +
									sanitizeFilename(browserName)+'\')">stack trace</a> - ' + linkToScreenshot(scen, browserName) +
									'screen shot</a> <span class="miliss">'+(r.duration/1000).toFixed(2)+'s.</span></td>';
								exceptions.push(concatStackTrace(runId(scen, browserName), r, browsers.length + 2));
							}
							if (r.status === "Skipped") {
								result += '<td class="skip">Skipped (test duration '+r.duration+' ms.)</td>';
							}
						}
					}
				}
				result += '</tr>';
				if(exceptions.length > 0){
					for(var i=0; i<exceptions.length; i++){
						result += exceptions[i];
					}
				}

			}
			result += '</tr>';

			result += concatSpecTotalDuration(browsers, featureDuration);

			result += '</table>';
		}

		result += concatTimeAnalysisTable(timeTrack);

		return result;
	}

	function concatTimeAnalysisTable(timeTrack){
		var result = '';
		result += '<div class="header">Feature Performance Report</div>';
		result += '<table class="testlist">';
		result += '<tr><th>Feature</th><th>Browser</th><th>Duration</th><th>Comparison</th></tr>';
		var largest = 0;
		for (var b in timeTrack) {
			if(!timeTrack.hasOwnProperty(b)){
				continue;
			}
			for(var f in timeTrack[b]){
        if(!timeTrack[b].hasOwnProperty(f)){
          continue;
        }
				if (timeTrack[b][f] > largest){
					largest = timeTrack[b][f];
				}
			}
		}
		for (b in timeTrack) {
      if(!timeTrack.hasOwnProperty(b)){
        continue;
      }
			for(f in timeTrack[b]){
        if(!timeTrack[b].hasOwnProperty(f)){
          continue;
        }
				result += '<tr>';
				result += '<td>'+f+'</td>';
				result += '<td>'+b+'</td>';
				result += '<td>'+timeTrack[b][f]+' ms.</td>';
				var percentage = (timeTrack[b][f] / largest * 100).toFixed();
				result += '<td><div style="width:100%;background-color: #CCCCCC"><div style="width: '+percentage +
					'%;background-color: #1c94c4"><span>'+timeTrack[b][f]+'</span></div></div></td>';
				result += '</tr>';
			}
		}
		result += '</table>';
		return result;
	}

	function concatStackTrace(id, run, colspan){
		var result = '';
		if(run.stackTrace) {
			if (run.stackTrace.length > 0) {
				result += '<tr class="stack" style="display:none" id="' + id + '">' +
					'<td colspan="' + colspan + '" style="background-color: #FFBBBB">' +
					'<table class="stacker">' +
					'<tr><td class="error">' + reporter.encodeEntities(run.stackTrace[0]) + '</td></tr>';
				for (var i = 1; i < run.stackTrace.length; i++) {
					result += '<tr><td';
					if(run.stackTrace[i].indexOf('    at ') === 0){
						if(run.stackTrace[i].indexOf('node_modules') === -1 && run.stackTrace[i].indexOf('process._tickCallback') === -1){
							result += ' class="atstrong"';
						}else {
							result += ' class="at"';
						}
					}
					result += '>' + reporter.encodeEntities(run.stackTrace[i]) + '</td></tr>'
				}
				result += '</table></td></tr>';
			}

		}	return result;
	}

	function concatSpecTableHeader(featureName, sortedBrowsers){
		var result = '<tr><th>Test#</th><th>' + featureName + '</th>';
		for (var i = 0; i < sortedBrowsers.length; i++) {
			result += '<th>' + sortedBrowsers[i] + '</th>';
		}
		result += '</tr>';
		return result;
	}

	function concatSpecTotalDuration(browsers, featureDuration){
		var result = '<tr><td>Total Duration:</td><td></td>';
		for (var b=0; b < browsers.length; b++) {
			var tElapseBegin = new Date();
			var tElapseEnd = new Date().setSeconds(new Date().getSeconds() + featureDuration[browsers[b]]/1000);
			result += '<td>'+elapsedTime(tElapseBegin, tElapseEnd)+'</td>';
		}
		result += '</tr>';
		return result;
	}

	function linkToScreenshot(scenarioName, browserName){
		return '<a href="' + options.screenshotsFolder + '/' + runId(scenarioName, browserName) + '.png">';
	}

	function runId(scenarioName, browserName){
		return sanitizeFilename(scenarioName) + sanitizeFilename(browserName);
	}

	function copyResultsToFeatureCollection(resultArray){
		var featuresDummy = {};
		for (var i = 0; i < resultArray.length; i++) {
			var offset = __featureDenominator.length;
			var featureName = resultArray[i].testName.substr(offset, resultArray[i].testName.indexOf(__scenarioDenominator)-offset);
			if (!featuresDummy[featureName]) {
				featuresDummy[featureName] = {};
			}

			if (!featuresDummy[featureName][resultArray[i].testName]) {
				featuresDummy[featureName][resultArray[i].testName] = {};
			}

			if (!featuresDummy[featureName][resultArray[i].testName][resultArray[i].browser]) {
				featuresDummy[featureName][resultArray[i].testName][resultArray[i].browser] = {};
			}

			featuresDummy[featureName][resultArray[i].testName][resultArray[i].browser] = {
				name: resultArray[i].browser,
				duration : resultArray[i].duration,
				status : resultArray[i].res,
				stackTrace : resultArray[i].stackTrace
			};
		}
		return featuresDummy;
	}

	function concatHeadSection(){
		var result = '<head><meta http-equiv="Content-Type" content="text/html" />';
		result += concatCssSection();
		result += concatScriptSection();
		result += '</head>';
		return result;
	}

	function concatScriptSection(){
		var result = '<script type="text/javascript">';
		result += 'function showhide(scenarioName, browserName) {';
		result += '	var e = document.getElementById(scenarioName+browserName);';
		result += '	var s = e.style.display;';
		result += '	var divs = document.getElementsByTagName("tr"), item;';
		result += '	for (var i = 0, len = divs.length; i < len; i++) {';
		result += '		item = divs[i];';
		result += '		if (item.id){';
		result += '			if(item.id.indexOf(scenarioName) == 0) {';
		result += '				item.style.display = "none"';
		result += '			}';
		result += '		}';
		result += '	}';
		result += '	e.style.display = (s == "none") ? "table-row" : "none";';
		result += '}';
		result += '</script>';
		return result;
	}

	function concatCssSection(){
		var result ='<style type="text/css">';
		result += 'body{';
		result +='	font-family: verdana, arial, sans-serif;';
		result +='}';
		result +='table {';
		result +='	border-collapse: collapse;';
		result +='	display: table;';
		result +='}';
		result +='.header {';
		result +='	font-size: 21px;';
		result +='	margin-top: 21px;';
		result +='	text-decoration: underline;';
		result +='	margin-bottom:21px;';
		result +='}';
		result +='table.runInfo tr {';
		result +='	border-bottom-width: 1px;';
		result +='	border-bottom-style: solid;';
		result +='	border-bottom-color: #d0d0d0;';
		result +='	font-size: 10px;';
		result +='	color: #999999;';
		result +='}';
		result +='table.runInfo td {';
		result +='	padding-right: 6px;';
		result +='	text-align: left';
		result +='}';
		result +='table.runInfo th {';
		result +='	padding-right: 6px;';
		result +='	text-align: left';
		result +='}';
		result +='table.runInfo img {';
		result +='	vertical-align:text-bottom;';
		result +='}';
		result +='table.summary {';
		result +='	font-size: 9px;';
		result +='	color: #333333;';
		result +='	border-width: 1px;';
		result +='	border-color: #999999;';
		result +='	margin-top: 21px;';
		result +='}';
		result +='table.summary tr {';
		result +='	background-color: #EFEFEF';
		result +='}';
		result +='table.summary th {';
		result +='	background-color: #DEDEDE;';
		result +='	border-width: 1px;';
		result +='	padding: 6px;';
		result +='	border-style: solid;';
		result +='	border-color: #B3B3B3;';
		result +='}';
		result +='table.summary td {';
		result +='	border-width: 1px;';
		result +='	padding: 6px;';
		result +='	border-style: solid;';
		result +='	border-color: #CFCFCF;';
		result +='	text-align: center';
		result +='}';
		result +='table.testlist {';
		result +='	font-size: 10px;';
		result +='	color: #666666;';
		result +='	border-width: 1px;';
		result +='	border-color: #999999;';
		result +='	margin-top: 21px;';
		result +='	width: 100%;';
		result +='}';
		result +='table.testlist th {';
		result +='	background-color: #CDCDCD;';
		result +='	border-width: 1px;';
		result +='	padding: 6px;';
		result +='	border-style: solid;';
		result +='	border-color: #B3B3B3;';
		result +='}';
		result +='table.testlist tr {';
		result +='	background-color: #EFEFEF';
		result +='}';
		result +='table.testlist td {';
		result +='	border-width: 1px;';
		result +='	padding: 6px;';
		result +='	border-style: solid;';
		result +='	border-color: #CFCFCF;';
		result +='	text-align: center';
		result +='}';
		result +='table.testlist td.pass {';
		result +='	background-color: #BBFFBB;';
		result +='}';
		result +='table.testlist td.clean a {';
		result +='	text-decoration: none;';
		result +='}';
		result +='table.testlist td.fail {';
		result +='	background-color: #FFBBBB;';
		result +='}';
		result +='table.testlist td.skip {';
		result +='	color: #787878;';
		result +='}';
		result +='table.testlist td.testname {';
		result +='	text-align: left;';
		result +='}';
		result +='table.testlist td.totals {';
		result +='	background-color: #CDCDCD;';
		result +='	border-color: #B3B3B3;';
		result +='	color: #666666;';
		result +='	padding: 2px;';
		result +='}';
		result +='tr.stack {';
		result +='	display : none';
		result +='}';
		result +='table.stacker {';
		result +='	font-size: 10px;';
		result +='	width: 100%;';
		result +='	border-style: solid;';
		result +='	border-width: 1px;';
		result +='	border-color: #CFCFCF;';
		result +='}';
		result +='table.stacker td {';
		result +='	text-align: left;';
		result +='	padding: 3px;';
		result +='	padding-left:43px;';
		result +='	color: #888888;';
		result +='	border-style: none;';
		result +='}';
		result +='table.stacker td.error {';
		result +='	text-align: left;';
		result +='	color: #FF0000;';
		result +='	padding: 3px;';
		result +='	padding-left:13px;';
		result +='	border-style: none;';
		result +='}';
		result +='table.stacker td.at {';
		result +='	padding-left:63px;';
		result +='	color: #888888;';
		result +='}';
		result +='table.stacker td.atstrong {';
		result +='	padding-left:63px;';
		result +='	color: #333333;';
		result +='}';
		result +='table.stacker tr:nth-child(odd) {';
		result +='	background-color: #F8F8F8;';
		result +='}';
		result +='.miliss {';
		result +='	color: #9B9B9B;';
		result +='}';
		result += '</style>';
		return result;
	}

	function concatReportHeaderSection(automationHeader){
		return '<div class="header">' + automationHeader + '</div>';
	}

	function concatRunInfoSection(elapsedTime){
		return '<table class="runInfo"><tr><td>Elapsed time</td><td>' + elapsedTime + '</td></tr></table>';
	}

	function concatReportSummary(allResults){
		var pass = reporter.countPassed(allResults);
		var fail = reporter.countFailed(allResults);
		var skipped = reporter.countSkipped(allResults);
		var result = '';
		var total = pass + fail + skipped;
		if(skipped > 0){
			result += '<table class="summary"><tr><th>Total</th><th>Executed</th><th>Pending</th><th>Pass</th><th>Fail</th><th>Pass%</th></tr><tr><td>';
		}else {
			result += '<table class="summary"><tr><th>Total</th><th>Pass</th><th>Fail</th><th>Pass%</th></tr><tr><td>';
		}
		result += total + '</td><td>';
		if(skipped > 0){
			result += (pass+fail) + '</td><td>';
			result += (skipped) + '</td><td>';
		}
		result += pass + '</td><td>';
		result += fail + '</td><td>';
		result += calculatePassPercentage(pass, fail) + '</td></tr></table>';
		return result;
	}

	function concatKnownIssues(){
		var result = '';
		var tempFiles = fs.readdirSync(path.resolve(options.targetPath));
		var filterFn = function (fname){
			return fname.match('.*\.tmp$');
		};
		tempFiles = tempFiles.filter(filterFn);
		if(tempFiles.length) {
			result += '<div class="header">Known Issues</div>';
			result += '<table class="runInfo' +
				' knownIssues"><tr><th>Type</th><th>Severity</th><th>Key</th><th>Description</th></tr>';
		}
		for(var i=0; i<tempFiles.length; i++){
			var bugPath = path.join(path.resolve(options.targetPath), tempFiles[i]);
			var raw = fs.readFileSync(bugPath);
			var bug = JSON.parse(raw);
			var key = bug.key;
			var type = '<img src="'+bug.fields.issuetype.iconUrl+'" title="'+bug.fields.issuetype.description+'">';
			var description = bug.fields.summary;
			var severity = '<img src="'+bug.fields.priority.iconUrl+'" title="'+bug.fields.priority.name+'">';
			result += '<tr><td>'+type+'</td><td>'+severity+'</td><td>'+key+'</td><td>'+description+'</td></tr>';
		}
		if(tempFiles.length) {
			result += '</table>';
		}
		return result;
	}

	function calculatePassPercentage(pass, fail){
		return Math.floor((pass / (pass+fail)) * 100);
	}

	function elapsedTime(tsStart, tsEnd){
		var timeDiff = tsEnd - tsStart;
		timeDiff /= 1000;
		var seconds = Math.round(timeDiff % 60);
		timeDiff = Math.floor(timeDiff / 60);
		var minutes = Math.round(timeDiff % 60);
		timeDiff = Math.floor(timeDiff / 60);
		var hours = Math.round(timeDiff % 24);
		timeDiff = Math.floor(timeDiff / 24);
		var days = timeDiff ;
		var str = '';
		str += (days>0) ? days + ' days ' : '';
		str += (days>0 || hours>0) ? hours + ' hs. ' : '';
		str += (days>0 || hours>0 || minutes>0) ? minutes + ' mins. ' : '';
		str += seconds + ' secs.';
		return str;
	}

	return this;
}

module.exports = HTMLScreenshotReporter;
