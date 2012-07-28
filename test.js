var HttpParser = require('./HttpParser');
var parser = new HttpParser();
var chunk = "GET / HTTP/1.1\r\nAccept-Type: xml/json\r\n\r\n";

parser.onRequest = function(request) {
	console.log(request);
}

parser.execute(chunk, 0, chunk.length);