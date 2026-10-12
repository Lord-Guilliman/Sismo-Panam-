#!/usr/bin/env python3
"""Servidor local de desarrollo para Sismo Panamá v0.7.1.

Prototipo educativo, no apto como sistema oficial de alerta sísmica.
No persiste ubicación ni pings en disco; todo se guarda temporalmente en RAM.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from urllib.parse import urlsplit, parse_qs
from pathlib import Path
import json
import math
import os
import threading
import time
import secrets
import gzip

ROOT = Path(__file__).resolve().parent
IGC_PAGE = "https://sismosgeociencias.up.ac.pa/"
PORT = int(os.environ.get("SISMO_PORT", "8000"))
# 127.0.0.1 = solo esta computadora (seguro). No lo cambies sin entender los riesgos.
HOST = os.environ.get("SISMO_HOST", "127.0.0.1")
# Umbrales de demostración. No usar estos valores para alertas públicas.
CLUSTER_MIN_DEVICES = int(os.environ.get("SISMO_CLUSTER_MIN", "5"))
CLUSTER_WINDOW_SECONDS = float(os.environ.get("SISMO_CLUSTER_WINDOW", "10"))
CLUSTER_RADIUS_KM = float(os.environ.get("SISMO_CLUSTER_RADIUS_KM", "5"))
CLUSTER_KEEP_SECONDS = 60
IGC_CACHE_SECONDS = 15

# Tipos MIME correctos aunque Windows tenga el registro mal configurado.
import mimetypes
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/manifest+json", ".webmanifest")
lock = threading.Lock()
recent_pings = []
active_clusters = []
igc_cache = {"body": None, "expires": 0.0}


def distance_km(a_lat, a_lon, b_lat, b_lon):
    r = 6371.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(h), math.sqrt(max(0.0, 1 - h)))


def valid_coord(lat, lon):
    return math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180


def prune(now):
    global recent_pings, active_clusters
    recent_pings = [p for p in recent_pings if now - p["time"] <= CLUSTER_WINDOW_SECONDS]
    active_clusters = [c for c in active_clusters if now - c["time"] <= CLUSTER_KEEP_SECONDS]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    server_version = "SismoPanamaDev/0.7.0"

    # En desarrollo el navegador no debe guardar copias viejas de tus archivos.
    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # Do not print user IPs or request paths in the console by default.
    def log_message(self, fmt, *args):
        pass

    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/api/igc":
            now = time.time()
            with lock:
                cached = igc_cache["body"] if now < igc_cache["expires"] else None
            if cached is None:
                try:
                    req = Request(IGC_PAGE, headers={"User-Agent": "SismoPanama-Experimental/0.4", "Accept": "text/html"})
                    with urlopen(req, timeout=8) as resp:
                        body = resp.read(2_500_000)
                    with lock:
                        igc_cache["body"] = body
                        igc_cache["expires"] = now + IGC_CACHE_SECONDS
                    cached = body
                except (URLError, HTTPError, TimeoutError, OSError) as exc:
                    self.send_json(502, {"error": "No se pudo consultar IGC-UP", "detail": type(exc).__name__})
                    return
            payload = cached
            wants_gzip = "gzip" in self.headers.get("Accept-Encoding", "")
            if wants_gzip:
                payload = gzip.compress(cached, compresslevel=6)  # la página pesa ~180 KB; comprimida, ~20 KB
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            if wants_gzip:
                self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)
            return

        if parsed.path == "/api/motion-status":
            query = parse_qs(parsed.query)
            try:
                lat, lon = float(query.get("lat", ["nan"])[0]), float(query.get("lon", ["nan"])[0])
            except ValueError:
                self.send_json(400, {"error": "Coordenadas inválidas"})
                return
            if not valid_coord(lat, lon):
                self.send_json(400, {"error": "Coordenadas inválidas"})
                return
            now = time.time()
            with lock:
                prune(now)
                nearby = []
                for c in active_clusters:
                    if distance_km(lat, lon, c["lat"], c["lon"]) <= max(25, CLUSTER_RADIUS_KM * 5):
                        nearby.append({k: c[k] for k in ("id", "lat", "lon", "count", "time")})
            self.send_json(200, {"events": nearby, "experimental": True})
            return

        if parsed.path == "/api/health":
            self.send_json(200, {
                "ok": True,
                "mode": "development prototype",
                "cluster_min_devices": CLUSTER_MIN_DEVICES,
                "cluster_window_seconds": CLUSTER_WINDOW_SECONDS,
                "cluster_radius_km": CLUSTER_RADIUS_KM,
                "push_notifications_configured": False,
            })
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlsplit(self.path)
        if parsed.path != "/api/motion-ping":
            self.send_json(404, {"error": "Ruta desconocida"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > 4096:
            self.send_json(400, {"error": "Tamaño de solicitud inválido"})
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            if body.get("consent") is not True:
                self.send_json(403, {"error": "Se requiere consentimiento explícito"})
                return
            lat, lon = float(body["lat"]), float(body["lon"])
            peak = float(body["peak"])
            device_id = str(body["deviceId"])[:100]
        except (ValueError, TypeError, KeyError, json.JSONDecodeError):
            self.send_json(400, {"error": "Datos inválidos"})
            return
        if not valid_coord(lat, lon) or not math.isfinite(peak) or not 0 <= peak <= 100 or not device_id:
            self.send_json(400, {"error": "Datos fuera de rango"})
            return

        now = time.time()
        with lock:
            prune(now)
            # Count only one ping per session/device in the active window.
            recent_pings[:] = [p for p in recent_pings if p["device"] != device_id]
            recent_pings.append({"time": now, "lat": lat, "lon": lon, "peak": peak, "device": device_id})
            group = [p for p in recent_pings if distance_km(lat, lon, p["lat"], p["lon"]) <= CLUSTER_RADIUS_KM]
            devices = {p["device"] for p in group}
            candidate = None
            if len(devices) >= CLUSTER_MIN_DEVICES:
                # Reuse an active cluster nearby rather than creating one per ping.
                existing = next((c for c in active_clusters if now - c["time"] <= CLUSTER_WINDOW_SECONDS and distance_km(lat, lon, c["lat"], c["lon"]) <= CLUSTER_RADIUS_KM), None)
                if existing:
                    existing["count"] = max(existing["count"], len(devices))
                    existing["expires"] = now + CLUSTER_KEEP_SECONDS
                    candidate = existing
                else:
                    candidate = {
                        "id": "motion-" + secrets.token_hex(6), "lat": sum(p["lat"] for p in group) / len(group),
                        "lon": sum(p["lon"] for p in group) / len(group), "count": len(devices),
                        "time": now, "expires": now + CLUSTER_KEEP_SECONDS,
                    }
                    active_clusters.append(candidate)
            response = {"ok": True, "candidate": bool(candidate), "count": len(devices), "experimental": True}
            if candidate:
                response["event"] = {k: candidate[k] for k in ("id", "lat", "lon", "count", "time")}
        self.send_json(200, response)


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Sismo Panamá v0.7.1 está disponible en http://localhost:{PORT}/")
    print("Modo de desarrollo: solo accesible desde esta computadora.")
    print(f"Agrupación DEMO: {CLUSTER_MIN_DEVICES} dispositivos / {CLUSTER_WINDOW_SECONDS:g} s / radio {CLUSTER_RADIUS_KM:g} km.")
    print("No es un sistema de alerta oficial. Para compartirlo con teléfonos de otras personas hace falta desplegarlo con HTTPS y revisar seguridad/privacidad.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
