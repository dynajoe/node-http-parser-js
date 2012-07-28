process.binding("http_parser").HTTPParser = require('./HttpParser').HTTPParser;

var http = require('http');

var server = http.createServer(function (req, res) {
  res.writeHead(200, {
    "Content-Length": 12,
    "Content-Type": "text/plain"
  });
  res.end("Hello World\n");
});

server.listen(8080, function () {
  var port = server.address().port;
  var url = "http://127.0.0.1:" + port + "/";
  console.log(url);
  
  var params = {
    method: "GET",
    host: "127.0.0.1",
    path: "/",
    port: 8080
  };  
});
