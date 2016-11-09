#!/bin/sh
cd /comicpanda/repos/panda-imagesv
export NODE_ENV=production 
naught start --worker-count 2 --log /comicpanda/logs/node/naught.log --stdout /comicpanda/logs/node/stdout.log --stderr /comicpanda/logs/node/stderr.log panda-imagesv.js
