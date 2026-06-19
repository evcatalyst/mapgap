#!/usr/bin/env python3
import hmac
import http.client
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


BACKEND_HOST = os.environ.get("VALHALLA_BACKEND_HOST", "127.0.0.1")
BACKEND_PORT = int(os.environ.get("VALHALLA_SERVICE_PORT", "8002"))
LISTEN_PORT = int(os.environ.get("PORT", "8080"))
SECRET = os.environ.get("VALHALLA_SHARED_SECRET", "").strip()
SECRET_HEADER = os.environ.get("VALHALLA_SECRET_HEADER", "X-Valhalla-Shared-Secret")

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}


class ProxyHandler(BaseHTTPRequestHandler):
    server_version = "MapGapValhallaProxy/1.0"

    def _write_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self._write_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _write_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header(
            "Access-Control-Allow-Headers",
            f"Content-Type, Accept, {SECRET_HEADER}",
        )
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _is_authorized(self):
        if not SECRET:
            return True

        candidate = self.headers.get(SECRET_HEADER, "").strip()
        return hmac.compare_digest(candidate, SECRET)

    def _forward_headers(self):
        headers = {}

        for key, value in self.headers.items():
            if key.lower() in HOP_BY_HOP_HEADERS:
                continue
            if key.lower() == "host":
                continue
            if key.lower() == SECRET_HEADER.lower():
                continue
            headers[key] = value

        headers["Host"] = f"{BACKEND_HOST}:{BACKEND_PORT}"
        return headers

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Cache-Control", "no-store")
        self._write_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/status":
            self._write_json(
                200,
                {
                    "status": "ok",
                    "service": "mapgap-valhalla",
                    "backend": f"http://{BACKEND_HOST}:{BACKEND_PORT}",
                    "requiresSecret": bool(SECRET),
                },
            )
            return

        self._proxy()

    def do_POST(self):
        self._proxy()

    def _proxy(self):
        if not self._is_authorized():
            self._write_json(
                401,
                {
                    "message": f"Missing or incorrect {SECRET_HEADER} header.",
                },
            )
            return

        body = self.rfile.read(int(self.headers.get("Content-Length", "0") or 0))

        connection = None

        try:
            connection = http.client.HTTPConnection(BACKEND_HOST, BACKEND_PORT, timeout=300)
            connection.request(
                self.command,
                self.path,
                body=body,
                headers=self._forward_headers(),
            )
            response = connection.getresponse()
            response_body = response.read()
        except Exception as error:
            self._write_json(
                502,
                {
                    "message": "Valhalla backend is not available.",
                    "detail": str(error),
                },
            )
            return
        finally:
            if connection:
                connection.close()

        self.send_response(response.status)
        for key, value in response.getheaders():
            if key.lower() in HOP_BY_HOP_HEADERS:
                continue
            if key.lower() == "content-length":
                continue
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(response_body)))
        self._write_cors_headers()
        self.end_headers()
        self.wfile.write(response_body)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}", flush=True)


if __name__ == "__main__":
    print(
        f"INFO: Starting MapGap Valhalla proxy on 0.0.0.0:{LISTEN_PORT}; "
        f"backend={BACKEND_HOST}:{BACKEND_PORT}; requires_secret={bool(SECRET)}",
        flush=True,
    )
    ThreadingHTTPServer(("0.0.0.0", LISTEN_PORT), ProxyHandler).serve_forever()
