# Simple nodejs CDN server

This app supports uploading, delivering and manipulating images (resizing on fly with cache)
For better deployment use this repo <https://github.com/mrspartak/js-cdn-images-dc>


## Environment variables

    #port app will be launched at
    const APP_PORT = process.env.APP_PORT || 3000
    #mongo connection string
    const MONGO = process.env.DEBUG || 'mongodb://localhost/js_cdn'
    #S3 connection data
    const S3_HOST = process.env.S3_HOST || '127.0.0.1'
    const S3_PORT = process.env.S3_PORT || 9000
    const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin'
    const S3_ACCESS_SECRET = process.env.S3_ACCESS_SECRET || 'minioadmin'
    #start logging
    const DEBUG = process.env.DEBUG || false