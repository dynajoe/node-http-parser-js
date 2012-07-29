var Parser = require('./HttpParser').HTTPParser;
var NodeParser = process.binding("http_parser").HTTPParser;

if (!process) {
	var module = {};
	var exports = {};
}

var request = [71, 69, 84, 32, 47, 32, 72, 84, 84, 80, 47, 49, 46, 48, 13, 10, 67, 111, 110, 110, 101, 99, 116, 105, 111, 110, 58, 32, 75, 101, 101, 112, 45, 65, 108, 105, 118, 101, 13, 10, 72, 111, 115, 116, 58, 32, 49, 50, 55, 46, 48, 46, 48, 46, 49, 58, 56, 48, 56, 48, 13, 10, 85, 115, 101, 114, 45, 65, 103, 101, 110, 116, 58, 32, 65, 112, 97, 99, 104, 101, 66, 101, 110, 99, 104, 47, 50, 46, 51, 13, 10, 65, 99, 99, 101, 112, 116, 58, 32, 42, 47, 42, 13, 10, 13, 10];
var buffer = new Buffer(request);

function runTest(name, test){
	var start = (new Date).getTime();
	var total = 0.0;

	for (var n = 0; n < 10000; n++) 
	{
		test();

		if (n % 100 == 0) {
			total += ((new Date).getTime() - start) / 100.0;	
			start = (new Date).getTime();
		}
	}

	var avgMs = total / 1000.0;

	console.log(name + ": " + avgMs);

	return avgMs;
}

var testParser = function () {
	var parser = new Parser(Parser.REQUEST);
	parser.execute(buffer, 0, buffer.length);
}

var nodeParser = function () {
	var parser = new NodeParser(NodeParser.REQUEST);
	parser.execute(buffer, 0, buffer.length);
};

var mine = runTest('Mine', testParser);
var node = runTest('Node', nodeParser);

console.log( Math.round(node / mine * 100));