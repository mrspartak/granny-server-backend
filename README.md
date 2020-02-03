# Simple nodejs CDN server

This app supports uploading, delivering and manipulating images (resizing on fly with cache)

[![Docker Cloud Automated build](https://img.shields.io/docker/cloud/automated/assorium/granny-server-backend?style=for-the-badge "Docker Cloud Automated build")](https://hub.docker.com/r/assorium/granny-server-backend "Docker Cloud Automated build")
[![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/assorium/granny-server-backend?style=for-the-badge "Docker Cloud Build Status")](https://hub.docker.com/r/assorium/granny-server-backend "Docker Cloud Build Status")
[![Docker Pulls](https://img.shields.io/docker/pulls/assorium/granny-server-backend?style=for-the-badge "Docker Pulls")](https://hub.docker.com/r/assorium/granny-server-backend "Docker Pulls")  <br/>

[![Latest Github tag](https://img.shields.io/github/v/tag/mrspartak/granny-server-backend?sort=date&style=for-the-badge "Latest Github tag")](https://github.com/mrspartak/granny-server-backend/releases "Latest Github tag")


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