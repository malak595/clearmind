from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path

ROOT = Path(__file__).parent
WEB_ROOT = ROOT / "web"


class ClearMindHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/health":
            body = b'{"status":"ok","service":"clearmind"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        super().end_headers()

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer((host, port), ClearMindHandler)
    print(f"ClearMind is running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
