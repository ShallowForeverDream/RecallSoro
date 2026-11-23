"""最小 SPA 静态服务器：任意路径回退到 index.html，供桌面应用调试使用。"""
import sys, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = sys.argv[2] if len(sys.argv) > 2 else "dist"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            if '.' not in os.path.basename(self.path):
                self.path = "/index.html"
        return super().do_GET()
    def log_message(self, *a):
        pass

ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
