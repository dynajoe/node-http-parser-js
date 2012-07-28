exports.HTTPParser = HTTPParser;

var states = { 
   PARSING_HEADER: 0,
   PARSING_BODY: 1,
   PARSING_REQUEST: 2
};

var state_map = [];

for (k in states) {
   state_map[states[k]] = k;
}

var CR = 0xD;
var LF = 0xA;

var requestExpression = /(GET|POST|PUT|DELETE) (.*) HTTP\/1.(1|0)/;

HTTPParser.REQUEST = "REQUEST";
HTTPParser.RESPONSE = "RESPONSE";

var Request = function () {
   this.versionMajor = 1;
   this.versionMinor = 1;
   this.statusCode = 200;
   this.method = "";
   this.url = "";
   this.headers = [];
}

function HTTPParser(type) {
   this.state = states.PARSING_REQUEST;
   this.current_line = [];
   this.request = new Request();
   
   this.onHeaders = function (headers, url) {};
   this.onHeadersComplete = function (info) {};
   this.onBody = function(buffer, start, len) {};
   this.onMessageComplete = function () {};
}

HTTPParser.prototype.reinitialize = function (type) {
   this.state = states.PARSING_REQUEST;
   this.current_line = [];
   this.request = new Request();
}

HTTPParser.prototype.finish = function () { return 0; }

HTTPParser.prototype.execute = function (data, offset, length) {
   var i = offset;
   var max = offset + length;
   
   for (;i < max; i++)
   {
      var c = data[i];

      if (this.state == states.PARSING_BODY) {
         //this.onBody(data, i, length);
         break;
      }

      if (c == LF) {
         if (this.current_line.length == 0) {
            this.state = states.PARSING_BODY;
            this.onHeadersComplete(this.request);
            this.onMessageComplete();
         } else {
            var line = this.current_line.join("");

            if (this.state == states.PARSING_REQUEST) {
               this._parseRequestLine(line);
            }
            else {
               this._parseHeaderLine(line);
            }

            this.state = states.PARSING_HEADER;
            this.current_line = [];
         }

         continue;
      } else if (c == CR) {
         continue;
      }

      this.current_line.push(String.fromCharCode(c));
   }
}

HTTPParser.prototype._parseRequestLine = function (line) {
   var match = requestExpression.exec(line);
   this.request.method = match[1];
   this.request.url = match[2];
   this.request.versionMinor = match[3];
}

HTTPParser.prototype._parseHeaderLine = function (line) {
   var lastIndex = line.indexOf(":");
   this.request.headers[line.substring(0, lastIndex)] = line.substring(lastIndex + 1).trim();
}