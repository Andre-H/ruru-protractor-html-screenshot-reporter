var fs = require('fs');
require('node-jasmine-file-contents-matcher');

describe('Generate HTML Report', function () {

    var ProtractorHTMLReporter = require('../index.js');
   /* process.env.TZ = 'Europe/Amsterdam'
    jasmine.clock().mockDate(new Date(2013, 9, 23));*/

    it('should create HTML from JSON', function (done) {
        var htmlReporter = new ProtractorHTMLReporter({
            title : 'My Protractor End to End Test Results',
            targetPath : 'target',
            fileName : 'protractor-e2e-report-basic.html'
        });
        htmlReporter.generateHtmlReport('./resources/protractor-e2e-report-basic.json');
        expect(fs.readFileSync('target/protractor-e2e-report-basic.html')).toEqualFileContents('protractor-e2e-report-basic', done);
    });
});