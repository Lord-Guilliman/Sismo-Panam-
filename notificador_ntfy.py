#!/usr/bin/env python3
"""Notificador de Sismo Panamá → tu teléfono vía ntfy (https://ntfy.sh).

POR QUÉ EXISTE
Una página web no puede despertar un teléfono bloqueado. Este script corre en una
computadora (o en Termux/un servidor) que esté siempre encendida, consulta USGS e IGC-UP
y, cuando hay un sismo que cumple tus reglas, envía una notificación de prioridad máxima
a la app ntfy de tu teléfono, que sí puede sonar con la pantalla bloqueada.

USO RÁPIDO
  1. Instala la app "ntfy" en el teléfono (Play Store / F-Droid) y suscríbete a un tema
     con un nombre largo y difícil de adivinar (el nombre del tema funciona como contraseña).
        python notificador_ntfy.py --nuevo-tema        # imprime un nombre aleatorio
  2. Prueba:   python notificador_ntfy.py --tema TU_TEMA --prueba
  3. Déjalo corriendo:   python notificador_ntfy.py --tema TU_TEMA
  4. En la app ntfy: Ajustes del tema → activa "Anular No molestar" para prioridad máxima.

IMPORTANTE: igual que la web, esto avisa DESPUÉS de que el sismo ocurrió y se publicó.
No es alerta temprana oficial. No necesita instalar nada (solo Python 3).
"""
import argparse
import json
import math
import secrets
import sys
import time
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

USGS_FDSN = "https://earthquake.usgs.gov/fdsnws/event/1/query"
IGC_PAGE = "https://sismosgeociencias.up.ac.pa/"
REGION = dict(minlatitude=3, maxlatitude=12.5, minlongitude=-87, maxlongitude=-74)
PANAMA_TZ = timezone(timedelta(hours=-5))  # Panamá no usa horario de verano
KNOWN_SECONDS, KNOWN_KM = 150, 150  # mismas reglas que core.js para "ya lo avisé"
UA = "SismoPanama-Notificador/0.7.0"


def dist_km(a_lat, a_lon, b_lat, b_lon):
    r = 6371.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(h), math.sqrt(max(0.0, 1 - h)))


# ---------- Fuentes ----------
def http_get(url, timeout=15):
    req = Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
    with urlopen(req, timeout=timeout) as resp:
        return resp.read(3_000_000)


def fetch_usgs(hours=6):
    start = (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%S")
    q = urlencode(dict(format="geojson", orderby="time", limit=500, eventtype="earthquake", starttime=start, **REGION))
    data = json.loads(http_get(f"{USGS_FDSN}?{q}"))
    out = []
    for f in data.get("features", []):
        p, c = f.get("properties") or {}, (f.get("geometry") or {}).get("coordinates") or []
        try:
            out.append(dict(source="USGS", mag=float(p["mag"]), lat=float(c[1]), lon=float(c[0]),
                            time=float(p["time"]) / 1000.0, place=p.get("place") or "",
                            url=p.get("url") or "", tsunami=bool(p.get("tsunami"))))
        except (KeyError, TypeError, ValueError, IndexError):
            continue
    return out


class _Rows(HTMLParser):
    """Lee las filas <tr> de la página del IGC-UP."""

    def __init__(self):
        super().__init__()
        self.rows, self._row, self._cell = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None


def parse_igc(html_text):
    p = _Rows()
    p.feed(html_text)
    out, seen = [], set()
    for cells in p.rows:
        if len(cells) < 8:
            continue
        status, date, clock, lat, lon, _depth, mag, place = cells[:8]
        try:
            t = datetime.strptime(f"{date} {clock.upper()}", "%Y-%m-%d %I:%M:%S%p").replace(tzinfo=PANAMA_TZ)
            row = dict(source="IGC-UP", mag=float(mag.replace(",", ".")), lat=float(lat.replace(",", ".")),
                       lon=float(lon.replace(",", ".")), time=t.timestamp(),
                       place=place.replace("Localizado en ", ""), url=IGC_PAGE, tsunami=False, status=status)
        except ValueError:
            continue
        key = (row["time"], row["lat"], row["lon"], row["mag"])
        if key not in seen:
            seen.add(key)
            out.append(row)
    return out


def fetch_igc():
    return parse_igc(http_get(IGC_PAGE).decode("utf-8", errors="replace"))


# ---------- Reglas ----------
class Watcher:
    def __init__(self, center, radius_km, min_mag, always_mag, max_age_h):
        self.center, self.radius_km, self.min_mag = center, radius_km, min_mag
        self.always_mag, self.max_age = always_mag, max_age_h * 3600
        self.known = []  # [{time, lat, lon, mag}]
        self.primed = False

    def _find_known(self, e):
        for k in self.known:
            if abs(k["time"] - e["time"]) <= KNOWN_SECONDS and dist_km(k["lat"], k["lon"], e["lat"], e["lon"]) <= KNOWN_KM:
                return k
        return None

    def worthy(self, e):
        if e["mag"] >= self.always_mag:
            return True
        near = dist_km(self.center[0], self.center[1], e["lat"], e["lon"]) <= self.radius_km
        return e["mag"] >= self.min_mag and near

    def process(self, reports, now=None):
        """Devuelve la lista de (evento, tipo) que hay que avisar. tipo: 'new' | 'upgraded'."""
        now = now if now is not None else time.time()
        alerts = []
        for e in sorted(reports, key=lambda r: r["time"]):
            k = self._find_known(e)
            kind = "new" if k is None else ("upgraded" if e["mag"] - k["mag"] >= 0.5 else "known")
            if k is None:
                self.known.append(dict(time=e["time"], lat=e["lat"], lon=e["lon"], mag=e["mag"]))
            else:
                k["mag"] = max(k["mag"], e["mag"])
            if kind == "known" or not self.primed:
                continue
            if now - e["time"] > self.max_age or not self.worthy(e):
                continue
            alerts.append((e, kind))
        self.primed = True
        return alerts


def build_message(e, kind, center):
    d = round(dist_km(center[0], center[1], e["lat"], e["lon"]))
    hora = datetime.fromtimestamp(e["time"], PANAMA_TZ).strftime("%d/%m %I:%M %p")
    title = f"{'Magnitud corregida' if kind == 'upgraded' else 'Sismo reportado'} · M {e['mag']:.1f}"
    body = f"{e['place']}\n{e['source']} · hora Panamá {hora} · a ~{d} km de tu punto."
    if e.get("tsunami"):
        body += "\nUSGS marca posible aviso de tsunami: revisa las indicaciones oficiales."
    body += "\nAviso posterior al sismo, no alerta temprana. Si sientes movimiento: agáchate, cúbrete, sujétate."
    return title, body


def send_ntfy(server, topic, title, body, click=None, priority=5):
    payload = {"topic": topic, "title": title, "message": body, "priority": priority, "tags": ["rotating_light"]}
    if click:
        payload["click"] = click
    req = Request(server.rstrip("/") + "/", data=json.dumps(payload).encode("utf-8"),
                  headers={"Content-Type": "application/json", "User-Agent": UA}, method="POST")
    with urlopen(req, timeout=15) as resp:
        return resp.status


def main(argv=None):
    ap = argparse.ArgumentParser(description="Avisos de sismos al teléfono con ntfy.")
    ap.add_argument("--tema", help="nombre del tema ntfy (largo y difícil de adivinar)")
    ap.add_argument("--servidor", default="https://ntfy.sh")
    ap.add_argument("--mag-min", type=float, default=4.5, help="magnitud mínima para avisar (por defecto 4.5)")
    ap.add_argument("--radio", type=float, default=500, help="radio en km desde tu punto (por defecto 500)")
    ap.add_argument("--lat", type=float, default=8.9824)
    ap.add_argument("--lon", type=float, default=-79.5199)
    ap.add_argument("--siempre-mag", type=float, default=6.0, help="avisar siempre desde esta magnitud en la región")
    ap.add_argument("--intervalo", type=int, default=30, help="segundos entre consultas")
    ap.add_argument("--solo-prueba-sin-enviar", action="store_true", help="muestra los avisos sin enviarlos")
    ap.add_argument("--prueba", action="store_true", help="envía una notificación de prueba y termina")
    ap.add_argument("--nuevo-tema", action="store_true", help="imprime un nombre de tema aleatorio y termina")
    a = ap.parse_args(argv)

    if a.nuevo_tema:
        print("sismo-" + secrets.token_urlsafe(16).replace("_", "x").replace("-", "y"))
        return 0
    if not a.tema:
        ap.error("falta --tema (usa --nuevo-tema para generar uno)")
    center = (a.lat, a.lon)
    if a.prueba:
        send_ntfy(a.servidor, a.tema, "Prueba · Sismo Panamá", "Si ves esto con prioridad máxima, el notificador funciona.")
        print("Prueba enviada.")
        return 0

    w = Watcher(center, a.radio, a.mag_min, a.siempre_mag, max_age_h=6)
    print(f"Vigilando: M≥{a.mag_min} a ≤{a.radio:g} km, o M≥{a.siempre_mag} en la región. Tema: {a.tema}. Ctrl+C para salir.")
    last_ok = time.time()
    warned = False
    while True:
        reports, ok = [], False
        for name, fn in (("USGS", fetch_usgs), ("IGC-UP", fetch_igc)):
            try:
                reports += fn()
                ok = True
            except (URLError, HTTPError, TimeoutError, OSError, ValueError) as exc:
                print(f"[{datetime.now():%H:%M:%S}] {name}: {type(exc).__name__}", file=sys.stderr)
        if ok:
            last_ok, warned = time.time(), False
            for e, kind in w.process(reports):
                title, body = build_message(e, kind, center)
                print(f"[{datetime.now():%H:%M:%S}] AVISO: {title} — {e['place']}")
                if not a.solo_prueba_sin_enviar:
                    try:
                        send_ntfy(a.servidor, a.tema, title, body, click=e.get("url") or None)
                    except (URLError, HTTPError, OSError) as exc:
                        print(f"No se pudo enviar a ntfy: {exc}", file=sys.stderr)
        elif time.time() - last_ok > 300 and not warned:
            warned = True  # avisar de que NO estamos vigilando: la falsa tranquilidad es peor
            try:
                send_ntfy(a.servidor, a.tema, "Sismo Panamá: sin conexión con las fuentes",
                          "Hace más de 5 minutos que no puedo consultar USGS ni IGC-UP. No recibirás avisos hasta que vuelva.", priority=3)
            except (URLError, HTTPError, OSError):
                pass
        time.sleep(a.intervalo)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nDetenido.")
