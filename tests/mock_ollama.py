#!/usr/bin/env python3
"""Finto server Ollama per i test: /api/tags, /api/chat (streaming e non) e /api/pull con avanzamento."""
import json, sys, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
REPLY = ("Il **Wi-Fi** è come una strada invisibile.\n\n1. Il router crea la strada.\n2. Il computer la percorre.\n\n"
         "[DIAGRAMMA]\nflowchart LR\n  A[\"Computer\"] --> B[\"Router\"] --> C[\"Internet\"]\n[/DIAGRAMMA]")
LAST = {}
MODELS = ["qwen2.5:1.5b", "llama3.2:3b"]
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path == "/api/tags":
            b = json.dumps({"models": [{"name": m} for m in MODELS]}).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
        elif self.path == "/last":
            b = json.dumps(LAST).encode(); self.send_response(200); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
        else:
            self.send_response(404); self.end_headers()
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); req = json.loads(self.rfile.read(n))
        if self.path == "/api/pull":
            self.send_response(200); self.send_header("Content-Type", "application/x-ndjson"); self.end_headers()
            self.wfile.write(b'{"status":"pulling manifest"}\n')
            for c in range(0, 101, 20):
                self.wfile.write((json.dumps({"status": "pulling abc", "digest": "sha256:abc", "total": 100000000, "completed": c * 1000000}) + "\n").encode()); self.wfile.flush(); time.sleep(0.05)
            self.wfile.write(b'{"status":"success"}\n')
            if req.get("model") not in MODELS: MODELS.append(req.get("model"))
            return
        if req.get("stream") is False:
            b = json.dumps({"message": {"role": "assistant", "content": "Il mouse serve a indicare e scegliere."}, "done": True}).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
            return
        LAST.clear(); LAST.update(req)
        self.send_response(200); self.send_header("Content-Type", "application/x-ndjson"); self.end_headers()
        for i in range(0, len(REPLY), 7):
            self.wfile.write((json.dumps({"message": {"role": "assistant", "content": REPLY[i:i+7]}, "done": False}) + "\n").encode()); self.wfile.flush(); time.sleep(0.01)
        self.wfile.write((json.dumps({"message": {"content": ""}, "done": True}) + "\n").encode())
ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 11434), H).serve_forever()
