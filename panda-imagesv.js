'use strict';
var http = require('http')
  , fs = require('fs')
  , url = require('url')
  , request = require('request')
  , gm = require('gm')
  , async = require('async')
  , sizeOf = require('image-size')
  , basedDir = '/comicpanda/data/files/mobile/cartoons/';

process.on('message', function (message) {
  if (message === 'shutdown') {
    process.exit(0);
  }
});

process.on('uncaughtException', function (err) {
  console.error(err);
});

var server = http.createServer(function (req, res) {
  var urls = url.parse(req.url, true),
    action = urls.pathname;
  if (action === '/ping') { // for ping request.
    res.writeHead(200, {'Content-Type' : 'text/plain' });
    res.end('pong \n');
  } else if (action === '/avatar') {
    var imageUrl = urls.query.url, 
    defaultImageUrl = "http://aws.tapastic.com/images/p/defaultuser-200.png",
    redirect = function (imageLocation) {
      res.writeHead(302, {'location' : imageLocation});
      res.end();
    }; 
    if (imageUrl) {
      request.head(imageUrl, function(error, response) {
        if(error) {
          redirect(defaultImageUrl);
        } else {
          var statusCode = Math.floor(response.statusCode / 100);
          if (statusCode === 4) {
            redirect(defaultImageUrl);
          } else {
            redirect(imageUrl);    
          }  
        }
      });
    } else {
      redirect(defaultImageUrl);
    }
  } else {
    // default size is 600 * 315
    var paths = action.split('/').slice(2)
      , ext = '.' + paths.shift()
      , srcFilePath = basedDir + paths.join('/')
      , distFilePath = srcFilePath + ext
      , isGif = srcFilePath.indexOf('.gif') > -1;

    if (!fs.existsSync(srcFilePath)) {
      res.writeHead(404, {'content-Type' : 'text/plain'});
      res.end();
      return;
    }

    var dimensions = sizeOf(srcFilePath)
      , orgWidth = dimensions.width
      , orgHeight = dimensions.height
      , width = orgWidth
      , height = orgHeight
      , minWidth = 600
      , minHeight = 315
      , ratio = 1.91
      , tmpFilePath
      , _gm = gm(srcFilePath + (isGif ? '[0]' : ''))
      , isNeededResize = false
      , distHeight
      , isTheSame = true
      , done;

    done = function () {
      if (isGif) {
        fs.unlink(tmpFilePath);
      }
      res.writeHead(200, {
        'Content-Type'   : 'image/' + (isGif ? 'gif' : 'jpeg'),
        'Content-Length' : fs.statSync(distFilePath).size
      });
      fs.createReadStream(distFilePath)
        .pipe(res);
    };

    // -- height < 315
    async.series([
      function (callback) {
        if (isGif) {
          tmpFilePath = srcFilePath + '.jpg';
          _gm.write(tmpFilePath, function (err) {
            _gm = gm(tmpFilePath);
            callback(null);
          });
        } else {
          callback(null);
        }
      },
      function (callback) {
        if (orgHeight < minHeight) {
          width = Math.ceil(orgWidth / orgHeight * minHeight);
          height = minHeight;
          if (width < minWidth) {
            height = Math.ceil(minHeight / width * minWidth);
            width = minWidth;
          }
          isNeededResize = true;
        }
        // -- widht < 600
        if (width < minWidth) {
          height = Math.ceil(orgHeight / orgWidth * minWidth);
          width = minWidth;
          isNeededResize = true;
        }
        if (isNeededResize) {
          _gm.resize(width, height);
          isTheSame = false;
        }
        if (width !== minWidth || height !== minHeight) {
          distHeight = Math.ceil(width / ratio);
          _gm.crop(width, distHeight, 0, Math.ceil((height - distHeight) / 2));
          isTheSame = false;
        }

        if (isTheSame) {
          var writeStream = fs.createWriteStream(distFilePath);
          writeStream.on('close', function () {
            callback(null);
          });
          fs.createReadStream(srcFilePath)
            .pipe(writeStream);
        } else {
          _gm.write(distFilePath, function (err, stdout, stderr, cmd) {
            if (err) {
              distFilePath = srcFilePath;
              console.error(cmd, stderr, err);
            }
            callback(null);
          });
        }
      }
    ], function (err) {
      done();
    });
  }
}).listen(3000, function () {
    if (process.send) {
      process.send('online');
    }
    console.log('Panda Image processing server listening on port 3000');
  });
