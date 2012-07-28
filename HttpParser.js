exports.HTTPParser = HTTPParser;

var states = { 
   PARSING_HEADER: 0,
   PARSING_BODY: 1,
   PARSING_REQUEST: 2,
   PARSING_RESPONSE: 3,
};

var state_map = [];

for (k in states) {
   state_map[states[k]] = k;
}

var CR = 0xD;
var LF = 0xA;

var requestExpression = /^([A-Z]+) (.*) HTTP\/(\d)\.(\d)$/i;
var responseExpression = /^HTTP\/(\d)\.(\d) (\d{3}) (.*)$/i;

HTTPParser.REQUEST = "REQUEST";
HTTPParser.RESPONSE = "RESPONSE";

var Info = function () {
   this.versionMajor = 1;
   this.versionMinor = 1;
   this.statusCode = 200;
   this.method = undefined;
   this.url = undefined;
   this.headers = [];
   this.shouldKeepAlive = true;
   this.upgrade = false;
   this.httpVersion = null;
}

function HTTPParser(type) {
   if (type == HTTPParser.REQUEST) {
      this.state = states.PARSING_REQUEST;
   } else {
      this.state = states.PARSING_RESPONSE;
   }

   this.type = type;
   this.current_line = [];
   this.info = new Info();
   
   this.onHeaders = function (headers, url) {};
   this.onHeadersComplete = function (info) {};
   this.onBody = function(buffer, start, len) {};
   this.onMessageComplete = function () {};
}

HTTPParser.prototype.reinitialize = function (type) {
   if (type == HTTPParser.REQUEST) {
      this.state = states.PARSING_REQUEST;
   } else {
      this.state = states.PARSING_RESPONSE;
   }

   this.type = type;
   this.current_line = [];
   this.info = new Info();
}

HTTPParser.prototype.finish = function () { }

HTTPParser.prototype.execute = function (data, offset, length) {
   var i = offset;
   var max = offset + length;
   
   for (;i < max; i++)
   {
      var c = data[i];

      if (this.state == states.PARSING_BODY) {
         this.onBody(data, i, max - i);
         break;
      }

      if (c == LF) {
         if (this.current_line.length == 0) {
            this.state = states.PARSING_BODY;
            this.onHeadersComplete(this.info);
            this.onMessageComplete();
         } else {
            var line = this.current_line.join("");
            
            if (this.state == states.PARSING_REQUEST) {
               this._parseRequestLine(line);
            }
            else if (this.state == states.PARSING_RESPONSE) {
               this._parseResponseLine(line); 
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

   return length;
}

HTTPParser.prototype._parseResponseLine = function (line) {
   var match = responseExpression.exec(line);
   this.info.versionMajor = match[1]
   this.info.versionMinor = match[2];
   this.info.statusCode = match[3];
   this.info.shouldKeepAlive = this._shouldKeepAlive();
}

HTTPParser.prototype._shouldKeepAlive = function () {

   if (this.info.versionMajor > 0 && this.info.versionMinor > 0) {
      // if (parser->flags & F_CONNECTION_CLOSE) {
      //    return 0;
      // }
   } else {
      // /* HTTP/1.0 or earlier */
      // if (!(parser->flags & F_CONNECTION_KEEP_ALIVE)) {
      // return 0;
      // }
   }

   return !this._messageNeedsEOF();
}

HTTPParser.prototype._messageNeedsEOF = function () {

   if (this.type == HTTPParser.REQUEST) {
      return false;
   }

   if (this.info.statusCode / 100 == 1 ||
       this.info.statusCode == 204 || 
       this.info.statusCode == 304) {
      // || parser->flags & F_SKIP_BODY
      return false;
   }

   // if ((parser->flags & F_CHUNKED) || parser->content_length != ULLONG_MAX) {
   //    return 0;
   // }

   return true;
}

HTTPParser.prototype._parseRequestLine = function (line) {
   var match = requestExpression.exec(line);
   this.info.method = match[1];
   this.info.url = match[2];
   this.info.versionMajor = match[3];
   this.info.versionMinor = match[4];
   this.info.shouldKeepAlive = false;
}

HTTPParser.prototype._parseHeaderLine = function (line) {
   var lastIndex = line.indexOf(":");
   this.info.headers.push(line.substring(0, lastIndex));
   this.info.headers.push(line.substring(lastIndex + 1).trim());
}