# Simple nodejs CDN server

This app supports uploading, delivering and manipulating images (resizing on the fly with cache)

[![Docker Cloud Automated build](https://img.shields.io/docker/cloud/automated/assorium/granny-server-backend?style=for-the-badge "Docker Cloud Automated build")](https://hub.docker.com/r/assorium/granny-server-backend "Docker Cloud Automated build")
[![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/assorium/granny-server-backend?style=for-the-badge "Docker Cloud Build Status")](https://hub.docker.com/r/assorium/granny-server-backend "Docker Cloud Build Status")
[![Docker Pulls](https://img.shields.io/docker/pulls/assorium/granny-server-backend?style=for-the-badge "Docker Pulls")](https://hub.docker.com/r/assorium/granny-server-backend "Docker Pulls")  <br/>

[![Latest Github tag](https://img.shields.io/github/v/tag/mrspartak/granny-server-backend?sort=date&style=for-the-badge "Latest Github tag")](https://github.com/mrspartak/granny-server-backend/releases "Latest Github tag") [![Join the chat at https://gitter.im/granny-js/community](https://badges.gitter.im/granny-js/community.svg)](https://gitter.im/granny-js/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## Ecosystem
![image](https://user-images.githubusercontent.com/993910/74678258-8f250380-51cb-11ea-9b5e-1640e713380e.PNG)

[granny-server-backend](https://github.com/mrspartak/granny-server-backend "granny-server-backend") - Backend service with API exposed to upload and serve/manipulate images  
[granny-js-client](https://github.com/mrspartak/granny-js-client "granny-js-client") - Client library that works both in nodejs and browser. Makes API calls easier  
[granny-server-frontend](https://github.com/mrspartak/granny-server-frontend "granny-server-frontend") - Frontend APP that uses client to manage your CDN domains and settings  
[granny-server-cron](https://github.com/mrspartak/granny-server-cron "granny-server-cron") - Utility app  

## Sample usage
Let's say tou have new avatar to upload, and you want it to be avialable at path **/users/sergio.jpeg**  
After you upload an image via API, the image is avialable at path **cdn.example.com/i/users/sergio.jpeg**  
And now magic begins. Lets modify it! **cdn.example.com/i/height=100,width=100/_/users/sergio.jpeg** is of course resize on fly with cache  
```
Resized image will be in cover mode. You can provide only one dimension too
- width || w: Number
- height || h: Number
- resize || r: String (100x100 || 100, 100x200)

Progressive image. Supported by jpeg, png
- progressive || pr: No value

Quality. Supported by jpeg, png, webp
- quality || q: Number [1-100]

Format to convert
- format || f: String [jpg|jpeg|png|webp]

Black and white
- bw: No value

Blur. Gaussian if number provided
- blur: No value or Number [1-1000]
```

## Requirements
- **MongoDB**  
- **Nginx**
- **S3** or [Minio instance](https://min.io/)

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
    
## Docker
```
docker run -p 3000:3000 --name granny-server-backend \
  -e MONGO='mongodb://user@password:example.com/granny' \
  assorium/granny-server-backend:latest
```

## Nginx
This an example Nginx config for all CDN.* subdomains
All you need is to point your DNS A record to server IP and add domain via API or [granny-server-frontend](https://github.com/mrspartak/granny-server-frontend "granny-server-frontend") app
This is only an example. I recommend to use real CDN service such as free CloudFlare before your app, and it will serve and cache all your images across the globe.
```
server {
    listen 80;
    charset UTF-8;
        
    server_name cdn.*;
    
    client_max_body_size 60m;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-NginX-Proxy true;
    }
}
```
