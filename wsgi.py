from pathlib import Path
from urllib.parse import unquote
from mimetypes import guess_type

WEB_ROOT = Path(__file__).parent / "web"


def application(environ, start_response):
    request_path = unquote(environ.get("PATH_INFO", "/")).lstrip("/")
    if request_path == "health":
        body = b'{"status":"ok","service":"clearmind"}'
        start_response("200 OK", [
            ("Content-Type", "application/json"),
            ("Content-Length", str(len(body))),
            ("X-Content-Type-Options", "nosniff"),
        ])
        return [body]
    file_path = (WEB_ROOT / request_path).resolve()

    if request_path == "" or file_path.is_dir():
        file_path = WEB_ROOT / "index.html"

    try:
        if WEB_ROOT.resolve() not in file_path.parents and file_path != WEB_ROOT.resolve():
            raise FileNotFoundError
        body = file_path.read_bytes()
        content_type = guess_type(file_path.name)[0] or "application/octet-stream"
        start_response("200 OK", [
            ("Content-Type", content_type),
            ("Content-Length", str(len(body))),
            ("X-Content-Type-Options", "nosniff"),
            ("X-Frame-Options", "DENY"),
            ("Referrer-Policy", "strict-origin-when-cross-origin"),
            ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
        ])
        return [body]
    except (FileNotFoundError, OSError):
        body = b"Not found"
        start_response("404 Not Found", [("Content-Type", "text/plain"), ("Content-Length", str(len(body)))])
        return [body]
