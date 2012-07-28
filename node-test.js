process.binding("http_parser").HTTPParser = require('./HttpParser').HTTPParser;

var http = require('http');

var server = http.createServer(function (req, res) {
  res.writeHead(200, {
    "Content-Length": 12,
    "Content-Type": "text/plain"
  });

  res.end("Hello World\n");
});

var port = process.env.PORT || 8080;

server.listen(port);
console.log("Listening on port " + port);
