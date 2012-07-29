exports.HTTPParser = HTTPParser;

var states = { 
   NORMAL: 0,
   ENDING: 1,
   ENDED: 2
};

var state_map = [];

for (k in states) {
   state_map[states[k]] = k;
}

var requestExpression = /([A-Z]+) ([^ ]*) HTTP\/(\d)\.(\d)/i;
var responseExpression = /HTTP\/(\d)\.(\d) (\d{3}) (.*)/i;

var CR = 0xD;
var LF = 0xA;

HTTPParser.REQUEST = "REQUEST";
HTTPParser.RESPONSE = "RESPONSE";

var Info = function () {
   this.versionMajor = undefined;
   this.versionMinor = undefined;
   this.statusCode = undefined;
   this.method = undefined;
   this.url = undefined;
   this.headers = [];
   this.shouldKeepAlive = false;
   this.upgrade = false;
   this.httpVersion = null;
   this.header = "";
}

function HTTPParser(type) {

   this.state = states.NORMAL;
   this.type = type;
   this.info = new Info();

   this.onHeaders = function (headers, url) {};
   this.onHeadersComplete = function (info) {};
   this.onBody = function(buffer, start, len) {};
   this.onMessageComplete = function () {};
}

HTTPParser.prototype.reinitialize = function (type) {
   
   this.state = states.NORMAL;
   this.type = type;
   this.info = new Info();
}

HTTPParser.prototype.finish = function () { 

}

HTTPParser.prototype._parseHeader = function () {
   var results = this.info.header.split("\r\n");
   var match = requestExpression.exec(results[0]);

   this.info.method = match[1];
   this.info.url = match[2];
   this.info.versionMajor = match[3];
   this.info.versionMinor = match[4];

   for (var i = 1; i < results.length; i++) {
      var h = results[i].indexOf(":");
      this.info.headers.push(results[i].substring(0, h));
      this.info.headers.push(results[i].substring(h + 2));  
   }
}

HTTPParser.prototype.execute = function (data, start, length) {
   var i = start;
   var max = start + length;

   for (;i < max; i++)
   {
      if (data[i] == CR) {
         continue;
      }

      if (data[i] != LF) {
         if (this.state != states.NORMAL) {
            this.state = states.NORMAL;  
         }
      } else if (this.state == states.ENDING) {   
         this.info.header = data.toString('ascii', start, i - 3);
         this._parseHeader();
         this.onHeadersComplete(this.info);
         this.state = states.ENDED;
         break;
      } else {
         this.state = states.ENDING;
      }
   }

   if (this.state == states.ENDED) {
      this.onBody(data, i, max - i);
   }
   
   this.onMessageComplete();
   return length;
}