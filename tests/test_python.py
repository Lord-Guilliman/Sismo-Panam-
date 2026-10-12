"""Pruebas de notificador_ntfy.py y server.py (sin internet).  Ejecuta:  python tests/test_python.py"""
import gzip, io, json, os, sys, threading, time, unittest
from http.client import HTTPConnection
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import notificador_ntfy as nt  # noqa: E402
import server  # noqa: E402

def row(st, d, h, lat, lon, dep, mag, reg):
    return f"<tr><td>{st}</td><td>{d}</td><td>{h}</td><td>{lat}</td><td>{lon}</td><td>{dep}</td><td>{mag}</td><td>{reg}</td><td><a href='x'>Ver</a></td></tr>"

HTML = ("<table><tr><th>Estado</th><th>Fecha</th><th>Hora Local</th><th>Latitud</th><th>Longitud</th><th>Profundidad</th><th>Magnitud</th><th>Región</th><th>Mapa</th></tr>"
        + row("PRELIMINAR", "2026-10-09", "11:14:02PM", "7.58288", "-80.58581", "10km", "6.2", "Localizado en Panamá a 25km al noroeste de Tonosí")
        + row("REVISADO", "2026-10-09", "11:12:39PM", "7.59900", "-80.63267", "3km", "6.2", "Localizado en Panamá a 30km al noroeste de Tonosí")
        + row("REVISADO", "2026-10-09", "12:05:00AM", "8.1", "-82.0", "5km", "3.1", "David") + "</table>")

class Notifier(unittest.TestCase):
    def test_parse_igc_time_is_panama_time(self):
        rows = nt.parse_igc(HTML)
        self.assertEqual(len(rows), 3)
        self.assertEqual(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(rows[0]["time"])), "2026-10-10T04:14:02Z")
        self.assertEqual(time.strftime("%H:%M", time.gmtime(rows[2]["time"])), "05:05")  # 12:05 AM = 00:05 local
        self.assertEqual(rows[0]["place"], "Panamá a 25km al noroeste de Tonosí")

    def test_watcher_rules(self):
        rows = nt.parse_igc(HTML)
        t0 = rows[0]["time"]
        w = nt.Watcher((8.9824, -79.5199), 500, 4.5, 6.0, 6)
        self.assertEqual(w.process(rows, now=t0 + 60), [])          # primera pasada: aprende sin avisar
        new = dict(source="USGS", mag=5.1, lat=7.6, lon=-80.6, time=t0 + 3600, place="x", url="", tsunami=False)
        self.assertEqual([k for _, k in w.process(rows + [new], now=t0 + 3700)], ["new"])
        self.assertEqual(w.process(rows + [new], now=t0 + 3730), [])  # no se repite
        up = dict(new, mag=5.8, time=t0 + 3610)                      # misma sacudida, magnitud corregida
        self.assertEqual([k for _, k in w.process([up], now=t0 + 3800)], ["upgraded"])
        small = dict(new, mag=3.9, time=t0 + 9000, lat=8.0)
        self.assertEqual(w.process([small], now=t0 + 9100), [])      # bajo el umbral
        far = dict(new, mag=5.0, time=t0 + 12000, lat=3.5, lon=-76)  # lejos (>500 km) y < always
        self.assertEqual(w.process([far], now=t0 + 12100), [])
        huge = dict(far, mag=6.4, time=t0 + 15000)                   # grande: avisa aunque esté lejos
        self.assertEqual([k for _, k in w.process([huge], now=t0 + 15100)], ["new"])
        old = dict(new, mag=5.5, time=t0 - 99999, lat=8.0)           # evento viejo: no suena
        self.assertEqual(w.process([old], now=t0 + 15200), [])

    def test_message_and_ntfy_payload(self):
        e = dict(source="USGS", mag=5.1, lat=7.6, lon=-80.6, time=1.8e9, place="a 25 km al NO de Tonosí", tsunami=True, url="")
        title, body = nt.build_message(e, "new", (8.9824, -79.5199))
        self.assertIn("M 5.1", title); self.assertIn("tsunami", body); self.assertIn("no alerta temprana", body)
        seen = {}
        class R:  status = 200; __enter__ = lambda s: s; __exit__ = lambda s, *a: False
        def fake(req, timeout=0): seen["data"] = json.loads(req.data.decode()); seen["url"] = req.full_url; return R()
        with mock.patch.object(nt, "urlopen", fake):
            nt.send_ntfy("https://ntfy.sh", "tema-x", title, body)
        self.assertEqual(seen["url"], "https://ntfy.sh/"); self.assertEqual(seen["data"]["priority"], 5)
        self.assertEqual(seen["data"]["topic"], "tema-x"); self.assertIn("Tonosí", seen["data"]["message"])

class Server(unittest.TestCase):
    def test_igc_proxy_gzip_and_static(self):
        class Resp(io.BytesIO):
            __enter__ = lambda s: s; __exit__ = lambda s, *a: False
        with mock.patch.object(server, "urlopen", lambda *a, **k: Resp(HTML.encode())):
            srv = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            port = srv.server_address[1]
            c = HTTPConnection("127.0.0.1", port); c.request("GET", "/api/igc", headers={"Accept-Encoding": "gzip"}); r = c.getresponse()
            self.assertEqual(r.status, 200); self.assertEqual(r.getheader("Content-Encoding"), "gzip")
            self.assertIn("Tonosí", gzip.decompress(r.read()).decode())
            c = HTTPConnection("127.0.0.1", port); c.request("GET", "/api/igc"); r = c.getresponse()
            self.assertIsNone(r.getheader("Content-Encoding")); self.assertIn("Tonosí", r.read().decode())
            c = HTTPConnection("127.0.0.1", port); c.request("GET", "/core.js"); r = c.getresponse()
            self.assertEqual(r.status, 200); self.assertEqual(r.getheader("Cache-Control"), "no-cache"); self.assertIn("javascript", r.getheader("Content-Type")); r.read()
            c = HTTPConnection("127.0.0.1", port); c.request("GET", "/manifest.webmanifest"); r = c.getresponse()
            self.assertIn("manifest+json", r.getheader("Content-Type")); r.read()
            srv.shutdown()
            srv.server_close()

if __name__ == "__main__":
    unittest.main(verbosity=2)
