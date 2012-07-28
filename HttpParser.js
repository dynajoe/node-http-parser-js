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

var CR = 0xD;
var LF = 0xA;
var COLON = 0x3A;

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
      this.state = states.REQUEST;
   } else {
      this.state = states.RESPONSE;
   }

   this.type = type;
   this.current_buffer = [];
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
   this.current_buffer = [];
   this.info = new Info();
}

HTTPParser.prototype.finish = function () { }

HTTPParser.prototype.execute = function (data, offset, length) {
   var i = offset;
   var max = offset + length;
   
   if (length == 0) {
      this.state = states.EOF;
   }

   for (;i < max; i++)
   {
      var c = data[i];

      //Ignoring CR's because they're not always around. 
      //LF's will be more reliable.
      if (c == CR) {
         continue;
      }

      switch(this.state) {

         case states.HEADER_KEY:
            //KEY END
            if (c == COLON) {
               this.info.headers.push(this.current_buffer.join(""));
               this.state = states.HEADER_VALUE;
               this.current_buffer = [];
               continue;
            }
            break;
         
         case states.HEADER_VALUE:
            //END OF HEADER
            if (c == LF) {
               this.info.headers.push(this.current_buffer.join(""));
               this.state = states.HEADER_END;
               this.current_buffer = [];
               continue;
            }
            break;
         
         case states.HEADER_END:
            //END OF HEADERS
            if (c == LF) {
               this._finishHeaders();  
               continue;
            }

            //MORE HEADERS TO CONSUME
            this.state = states.HEADER_KEY;
            break;

         case states.RESPONSE_DONE:
         case states.REQUEST_DONE:
            //END OF HEADERS
            if (c == LF) {
               //this should determine if we go
               // to chunked parsing or normal body parsing
               this._finishHeaders();
            }   

            //START CONSUMING HEADERS         
            this.state = states.HEADER_KEY;
            break;
         
         case states.REQUEST:
         case states.RESPONSE:
            //END OF FIRST LINE
            if (c == LF) {

               if (this.type == HTTPParser.REQUEST) {
                  var match = requestExpression.exec(this.current_buffer.join(""));
                  
                  this.info.method = match[1];
                  this.info.url = match[2];
                  this.info.versionMajor = match[3];
                  this.info.versionMinor = match[4];
                  this.info.shouldKeepAlive = false;

                  this.state = states.REQUEST_DONE;
                  continue;
               } 

               if (this.type == HTTPParser.RESPONSE) {
                  var match = responseExpression.exec(this.current_buffer.join(""));
                  
                  this.info.versionMajor = match[1]
                  this.info.versionMinor = match[2];
                  this.info.statusCode = match[3];
                  this.info.shouldKeepAlive = this._shouldKeepAlive();

                  this.state = states.RESPONSE_DONE;
                  continue;
               }
            }
            break;

         case states.BODY:
            this.onBody(data, i, max - i);
            this.onMessageComplete();
            i = max;
            break;
      }

      this.current_buffer.push(String.fromCharCode(c));
   }

   return length;
}

HTTPParser.prototype._finishHeaders = function () {
   this.onHeadersComplete(this.info);
   this.state = states.BODY;
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