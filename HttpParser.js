exports.HTTPParser = HTTPParser;

var states = { 
   RESPONSE: 0,
   REQUEST: 1,
   RESPONSE_DONE: 2,
   REQUEST_DONE: 3,
   HEADER_KEY: 4,
   HEADER_VALUE: 5,
   HEADER_END: 6,
   BODY: 7
};

var state_map = [];

for (k in states) {
   state_map[states[k]] = k;
}

var requestExpression = /([A-Z]+) ([^ ]*) HTTP\/(\d)\.(\d)/i;
var responseExpression = /HTTP\/(\d)\.(\d) (\d{3}) (.*)/i;

var CR = 0xD;
var LF = 0xA;
var COLON = 0x3A;

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
}

function HTTPParser(type) {
   if (type == HTTPParser.REQUEST) {
      this.state = states.REQUEST;
   } else {
      this.state = states.RESPONSE;
   }

   this.type = type;
   this.info = new Info();

   this.onHeaders = function (headers, url) {};
   this.onHeadersComplete = function (info) {};
   this.onBody = function(buffer, start, len) {};
   this.onMessageComplete = function () {};
}

HTTPParser.prototype.reinitialize = function (type) {
   if (type == HTTPParser.REQUEST) {
      this.state = states.REQUEST;
   } else {
      this.state = states.RESPONSE;
   }

   this.type = type;
   this.info = new Info();
}

HTTPParser.prototype.finish = function () { 

}

HTTPParser.prototype.execute = function (data, offset, length) {
   var i = offset;
   var max = offset + length;
   var lastOffset = i;

   for (;i < max; i++)
   {
      //Ignoring CR's because they're not always around. 
      //LF's will be more reliable.
      if (data[i] == CR) {
         continue;
      }

      switch(this.state) {

         case states.HEADER_KEY:
            //KEY END
            if (data[i] == COLON) {
               var header = data.toString('ascii', lastOffset + 1, i);
               this.info.headers.push(header);
               this.state = states.HEADER_VALUE;
               lastOffset = i;
               continue;
            }
            break;
         
         case states.HEADER_VALUE:
            //END OF HEADER
            if (data[i] == LF) {
               var value = data.toString('ascii', lastOffset + 2, i - 1);
               this.info.headers.push(value);
               this.state = states.HEADER_END;
               lastOffset = i;
               continue;
            }
            break;
         
         case states.HEADER_END:
            //END OF HEADERS
            if (data[i] == LF) {
               this.onHeadersComplete(this.info);
               this.state = states.BODY;
               continue;
            }

            //MORE HEADERS TO CONSUME
            this.state = states.HEADER_KEY;
            break;

         case states.RESPONSE_DONE:
         case states.REQUEST_DONE:
            //END OF HEADERS
            if (data[i] == LF) {
               //this should determine if we go
               // to chunked parsing or normal body parsing
               this.onHeadersComplete(this.info);
               this.state = states.BODY;
               continue;
            }   

            //START CONSUMING HEADERS         
            this.state = states.HEADER_KEY;
            break;
         
         case states.REQUEST:
         case states.RESPONSE:
            //END OF FIRST LINE
            if (data[i] == LF) {

               if (this.type == HTTPParser.REQUEST) {
                  
                  var request = data.toString('ascii', lastOffset, i);
                  var match = requestExpression.exec(request);
                  
                  this.info.method = match[1];
                  this.info.url = match[2];
                  this.info.versionMajor = match[3];
                  this.info.versionMinor = match[4];
                  this.info.shouldKeepAlive = false;
                  
                  lastOffset = i;
                  
                  this.state = states.REQUEST_DONE;
                  continue;
               } 

               if (this.type == HTTPParser.RESPONSE) {
                  
                  var response = data.toString('ascii', lastOffset, i);
                  var match = responseExpression.exec(response);
                  
                  this.info.versionMajor = match[1]
                  this.info.versionMinor = match[2];
                  this.info.statusCode = match[3];
                  this.info.shouldKeepAlive = this._shouldKeepAlive();
                  
                  lastOffset = i;

                  this.state = states.RESPONSE_DONE;
                  continue;
               }
            }
            break;

         case states.BODY:
            if (max - i > 0) {
               this.onBody(data, i, max - i);
            }

            this.onMessageComplete();
            i = max;
            break;
      }
   }

   return length;
}