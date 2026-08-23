#!/usr/bin/env python3
"""本地静态 + 代理服务器。代理 /stream?url=... 转发 B 站直播流,绕过浏览器 CORS/Referer 限制。
用法: python3 server.py [port]"""
import sys, urllib.request, urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/stream?'):
            self.proxy_stream()
        elif self.path.startswith('/api/room-init?'):
            self.proxy_bilibili_api('https://api.live.bilibili.com/room/v1/Room/room_init')
        elif self.path.startswith('/api/play-info?'):
            self.proxy_bilibili_api('https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo')
        else:
            super().do_GET()

    def proxy_bilibili_api(self, endpoint):
        from urllib.parse import urlparse, parse_qs, urlencode
        query = parse_qs(urlparse(self.path).query)
        target = endpoint + '?' + urlencode({k: v[0] for k, v in query.items()})
        req = urllib.request.Request(target, headers={
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://live.bilibili.com/',
        })
        try:
            upstream = urllib.request.urlopen(req, timeout=15)
            body = upstream.read()
        except Exception as e:
            self.send_error(502, str(e)); return
        self.send_response(upstream.status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def proxy_stream(self):
        from urllib.parse import urlparse, parse_qs
        qs = parse_qs(urlparse(self.path).query)
        target = qs.get('url', [''])[0]
        if not target:
            self.send_error(400, 'missing url'); return
        req = urllib.request.Request(target, headers={
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://live.bilibili.com/',
        })
        try:
            upstream = urllib.request.urlopen(req, timeout=15)
        except urllib.error.HTTPError as e:
            self.send_error(e.code, f'upstream {e.code}'); return
        except Exception as e:
            self.send_error(502, str(e)); return
        self.send_response(upstream.status)
        self.send_header('Content-Type', upstream.headers.get('Content-Type', 'application/octet-stream'))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        try:
            while True:
                chunk = upstream.read(64 * 1024)
                if not chunk: break
                self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            upstream.close()

    def log_message(self, fmt, *args):
        pass  # 静音访问日志

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f'serving on http://localhost:{port}')
    HTTPServer(('127.0.0.1', port), Handler).serve_forever()
