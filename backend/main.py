"""Backend Web Push de Sismo Panamá.

Este servicio administra suscripciones y envía notificaciones informativas a partir
exclusivamente de eventos públicos de USGS. No es un sistema oficial de alerta temprana.
Despliega por separado del sitio estático de GitHub Pages.
"""
from __future__ import annotations

import base64
import binascii
import json
import logging
import math
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from cryptography.hazmat.primitives.asymmetric import ec

from fastapi import FastAPI, Request as FastAPIRequest
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
try:
    from pywebpush import WebPushException, webpush
    WEBPUSH_AVAILABLE = True
except ImportError:  # Permite ejecutar pruebas puras/health sin la dependencia opcional instalada.
    WEBPUSH_AVAILABLE = False
    class WebPushException(Exception):
        response = None
    def webpush(**kwargs):
        raise RuntimeError("Falta la dependencia pywebpush; instala backend/requirements.txt")

LOG = logging.getLogger("sismo_push")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("SISMO_DB_PATH", str(ROOT / "data" / "sismo_push.sqlite3"))).expanduser()
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY_PATH = os.getenv("VAPID_PRIVATE_KEY_PATH", "").strip()
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:contacto@example.invalid").strip()
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "https://TU_USUARIO.github.io/sismo-panama/").strip()
ALLOWED_ORIGINS = {item.strip().rstrip("/") for item in os.getenv("ALLOWED_ORIGINS", "").split(",") if item.strip()}
ENABLE_MONITOR = os.getenv("ENABLE_MONITOR", "false").lower() in {"1", "true", "yes"}
POLL_SECONDS = max(30, int(os.getenv("POLL_SECONDS", "30")))
MAX_SUBSCRIPTIONS = max(100, int(os.getenv("MAX_SUBSCRIPTIONS", "1000")))
RATE_LIMIT_WINDOW = 600
RATE_LIMIT_REQUESTS = 20
REGION = {"minlatitude": 3, "maxlatitude": 12.5, "minlongitude": -87, "maxlongitude": -74}
USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
USER_AGENT = "SismoPanama-PushService/0.7.0 (open-source project; contact configured by operator)"
ALLOWED_MAGNITUDES = {3.5, 4.0, 4.5, 5.0, 5.5, 6.0}

app = FastAPI(title="Sismo Panamá Push API", version="0.7.0", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(ALLOWED_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=300,
)
_rate_lock = threading.Lock()
_rate_buckets: dict[str, list[float]] = {}
_monitor_thread: threading.Thread | None = None
_monitor_status_lock = threading.Lock()
_monitor_status: dict[str, Any] = {
    "last_started_at": None, "last_success_at": None, "last_error_at": None,
    "last_error_type": None, "last_event_count": None, "last_sent": 0, "last_errors": 0,
}


@contextmanager
def db_connect() -> Iterator[sqlite3.Connection]:
    """Abre una conexión SQLite y la cierra siempre al salir del bloque."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=10000")
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    with db_connect() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS subscriptions (
            endpoint TEXT PRIMARY KEY,
            subscription_json TEXT NOT NULL,
            min_magnitude REAL NOT NULL,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS sent_notifications (
            endpoint TEXT NOT NULL,
            event_id TEXT NOT NULL,
            last_magnitude REAL NOT NULL,
            last_sent_at REAL NOT NULL,
            PRIMARY KEY(endpoint, event_id)
        )""")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_updated ON subscriptions(updated_at)")
        conn.commit()


def rate_limit(request: FastAPIRequest, action: str) -> bool:
    # El límite en memoria ayuda en un piloto de una sola instancia; el hosting debe
    # añadir rate limiting de borde/WAF para resistir abuso distribuido.
    ip = request.client.host if request.client else "unknown"
    key = f"{action}:{ip}"
    now = time.time()
    with _rate_lock:
        events = [stamp for stamp in _rate_buckets.get(key, []) if now - stamp < RATE_LIMIT_WINDOW]
        if len(events) >= RATE_LIMIT_REQUESTS:
            _rate_buckets[key] = events
            return False
        events.append(now)
        _rate_buckets[key] = events
        if len(_rate_buckets) > 10000:
            for k in list(_rate_buckets)[:2500]:
                _rate_buckets.pop(k, None)
    return True


def valid_public_app_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc) and not parsed.username and not parsed.password


def decode_base64url(value: Any, expected_length: int) -> bytes | None:
    """Decodifica un campo base64url estricto y valida la longitud binaria esperada."""
    if not isinstance(value, str) or not value or any(
        ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-" for ch in value
    ):
        return None
    try:
        padded = value + "=" * ((4 - len(value) % 4) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
    except (ValueError, binascii.Error, UnicodeEncodeError):
        return None
    return raw if len(raw) == expected_length else None


def valid_vapid_public_key(value: str) -> bool:
    """Valida que VAPID sea una clave pública P-256 codificada como punto sin comprimir."""
    raw = decode_base64url(value, 65)
    if raw is None or raw[0] != 4:
        return False
    try:
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), raw)
        return True
    except ValueError:
        return False


def valid_vapid_subject(value: str) -> bool:
    if value.startswith("mailto:"):
        address = value[7:].strip()
        return "@" in address and "." in address.rsplit("@", 1)[-1] and "TU_CORREO" not in address and "example." not in address
    return valid_public_app_url(value) and "TU_USUARIO" not in value


def push_configured() -> bool:
    return bool(
        WEBPUSH_AVAILABLE
        and valid_vapid_public_key(VAPID_PUBLIC_KEY)
        and VAPID_PRIVATE_KEY_PATH
        and Path(VAPID_PRIVATE_KEY_PATH).is_file()
        and valid_vapid_subject(VAPID_SUBJECT)
        and valid_public_app_url(PUBLIC_APP_URL)
        and "TU_USUARIO" not in PUBLIC_APP_URL
        and ALLOWED_ORIGINS
    )


def valid_subscription(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    endpoint = value.get("endpoint")
    keys = value.get("keys")
    if not isinstance(endpoint, str) or len(endpoint) > 4096:
        return False
    try:
        parsed = urlparse(endpoint)
        hostname = (parsed.hostname or "").lower().rstrip(".")
        port = parsed.port
    except ValueError:
        return False
    # Allow only known browser push providers. Do not POST to arbitrary HTTPS URLs:
    # that would turn this service into an SSRF primitive against internal services.
    allowed_push_host = (
        hostname == "fcm.googleapis.com"
        or hostname == "web.push.apple.com"
        or hostname == "push.services.mozilla.com"
        or hostname.endswith(".push.services.mozilla.com")
    )
    if (parsed.scheme != "https" or not parsed.netloc or not allowed_push_host
            or parsed.username or parsed.password or port not in (None, 443) or parsed.fragment):
        return False
    if not isinstance(keys, dict):
        return False
    p256dh, auth = keys.get("p256dh"), keys.get("auth")
    public_point = decode_base64url(p256dh, 65)
    auth_secret = decode_base64url(auth, 16)
    if public_point is None or public_point[0] != 4 or auth_secret is None:
        return False
    try:
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), public_point)
    except ValueError:
        return False
    return True


def parse_usgs_feature(feature: dict[str, Any]) -> dict[str, Any] | None:
    try:
        props = feature["properties"]
        coords = feature["geometry"]["coordinates"]
        event_id = str(feature["id"])
        magnitude = float(props["mag"])
        lon, lat = float(coords[0]), float(coords[1])
        occurred_ms = int(props["time"])
        updated_ms = int(props.get("updated", props["time"]))
        place = str(props.get("place") or "Región de Panamá")[:240]
        source_url = str(props.get("url") or "https://earthquake.usgs.gov/earthquakes/map/")
        if not event_id or not math.isfinite(magnitude) or not (-87 <= lon <= -74 and 3 <= lat <= 12.5):
            return None
        if not source_url.startswith("https://earthquake.usgs.gov/"):
            source_url = "https://earthquake.usgs.gov/earthquakes/map/"
        return {"id": event_id, "mag": magnitude, "lon": lon, "lat": lat,
                "time": occurred_ms / 1000, "updated": updated_ms / 1000,
                "place": place, "url": source_url}
    except (KeyError, TypeError, ValueError, IndexError, OverflowError):
        return None


def fetch_usgs() -> list[dict[str, Any]]:
    start = (datetime.now(timezone.utc) - timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%S")
    query = urlencode({"format": "geojson", "orderby": "time", "limit": 1000,
                       "eventtype": "earthquake", "starttime": start, **REGION})
    request = Request(f"{USGS_URL}?{query}", headers={"User-Agent": USER_AGENT, "Accept": "application/geo+json"})
    with urlopen(request, timeout=12) as response:
        raw = response.read(4_000_000)
    payload = json.loads(raw.decode("utf-8"))
    return [event for event in (parse_usgs_feature(item) for item in payload.get("features", [])) if event]


def send_web_push(subscription: dict[str, Any], payload: dict[str, Any]) -> None:
    webpush(
        subscription_info=subscription,
        data=json.dumps(payload, ensure_ascii=False),
        vapid_private_key=VAPID_PRIVATE_KEY_PATH,
        vapid_claims={"sub": VAPID_SUBJECT},
        timeout=10,
    )


def cleanup_database(now: float | None = None) -> None:
    """Aplica los plazos de retención documentados para un piloto."""
    now = now if now is not None else time.time()
    with db_connect() as conn:
        conn.execute("DELETE FROM sent_notifications WHERE last_sent_at < ?", (now - 90 * 86400,))
        conn.execute("DELETE FROM subscriptions WHERE updated_at < ?", (now - 365 * 86400,))
        conn.execute("DELETE FROM sent_notifications WHERE endpoint NOT IN (SELECT endpoint FROM subscriptions)")
        conn.commit()


def process_events(events: list[dict[str, Any]], now: float | None = None) -> dict[str, int]:
    """Envía a suscriptores eventos recientes que superan el umbral configurado.

    Evita repetir la misma magnitud por suscripción/evento y permite avisar de una
    revisión de +0.5 o más. Solo envía eventos ocurridos hace menos de 15 minutos.
    Las solicitudes de red se hacen con un pool acotado para no serializar cada push.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    now = now if now is not None else time.time()
    cleanup_database(now)
    stats = {"sent": 0, "skipped": 0, "expired": 0, "errors": 0}
    candidates: list[dict[str, Any]] = []
    with db_connect() as conn:
        subscriptions = list(conn.execute("SELECT endpoint, subscription_json, min_magnitude FROM subscriptions"))
        for event in events:
            event_age = now - event["time"]
            if event_age < -120 or event_age > 900:
                stats["skipped"] += 1
                continue
            for saved in subscriptions:
                endpoint = saved["endpoint"]
                threshold = float(saved["min_magnitude"])
                if event["mag"] < threshold:
                    continue
                previous = conn.execute(
                    "SELECT last_magnitude FROM sent_notifications WHERE endpoint=? AND event_id=?",
                    (endpoint, event["id"]),
                ).fetchone()
                if previous is not None and event["mag"] - float(previous["last_magnitude"]) < 0.5:
                    stats["skipped"] += 1
                    continue
                kind = "Magnitud revisada" if previous is not None else "Sismo reportado"
                occurred = datetime.fromtimestamp(event["time"], timezone(timedelta(hours=-5))).strftime("%d/%m %H:%M")
                payload = {
                    "title": f"{kind} · M {event['mag']:.1f}",
                    "body": f"{event['place']} · USGS · hora de Panamá {occurred}. Reporte informativo; no es alerta temprana. Sigue las indicaciones de SINAPROC.",
                    "url": PUBLIC_APP_URL,
                    "tag": f"sismo-usgs-{event['id']}",
                }
                candidates.append({"endpoint": endpoint, "event_id": event["id"], "mag": event["mag"],
                                   "subscription": json.loads(saved["subscription_json"]), "payload": payload})

    def deliver(candidate: dict[str, Any]) -> tuple[dict[str, Any], str, int | None]:
        try:
            send_web_push(candidate["subscription"], candidate["payload"])
            return candidate, "sent", None
        except WebPushException as exc:
            response = getattr(exc, "response", None)
            status = getattr(response, "status_code", None)
            return candidate, "expired" if status in (404, 410) else "error", status
        except Exception as exc:
            LOG.warning("Error de envío push: %s", type(exc).__name__)
            return candidate, "error", None

    if candidates:
        with ThreadPoolExecutor(max_workers=12, thread_name_prefix="sismo-push") as pool:
            futures = [pool.submit(deliver, item) for item in candidates]
            with db_connect() as conn:
                for future in as_completed(futures):
                    candidate, result, status = future.result()
                    endpoint, event_id = candidate["endpoint"], candidate["event_id"]
                    if result == "sent":
                        conn.execute(
                            "INSERT INTO sent_notifications(endpoint,event_id,last_magnitude,last_sent_at) VALUES(?,?,?,?) "
                            "ON CONFLICT(endpoint,event_id) DO UPDATE SET last_magnitude=excluded.last_magnitude,last_sent_at=excluded.last_sent_at",
                            (endpoint, event_id, candidate["mag"], now),
                        )
                        stats["sent"] += 1
                    elif result == "expired":
                        conn.execute("DELETE FROM subscriptions WHERE endpoint=?", (endpoint,))
                        conn.execute("DELETE FROM sent_notifications WHERE endpoint=?", (endpoint,))
                        LOG.info("Se eliminó una suscripción expirada (HTTP %s)", status)
                        stats["expired"] += 1
                    else:
                        LOG.warning("Falló envío push status=%s event_id=%s", status, event_id)
                        stats["errors"] += 1
                conn.commit()
    return stats


def monitor_loop() -> None:
    LOG.info("Vigilante USGS activado; intervalo=%ss", POLL_SECONDS)
    while True:
        started = time.time()
        with _monitor_status_lock:
            _monitor_status["last_started_at"] = started
        try:
            events = fetch_usgs()
            stats = process_events(events, now=time.time())
            with _monitor_status_lock:
                _monitor_status.update({"last_success_at": time.time(), "last_error_at": None,
                                       "last_error_type": None, "last_event_count": len(events),
                                       "last_sent": stats["sent"], "last_errors": stats["errors"]})
            LOG.info("Ciclo USGS completado: consultados=%s enviados=%s expirados=%s errores=%s",
                     len(events), stats["sent"], stats["expired"], stats["errors"])
        except Exception as exc:
            with _monitor_status_lock:
                _monitor_status["last_error_at"] = time.time()
                _monitor_status["last_error_type"] = type(exc).__name__
                _monitor_status["last_errors"] = 1
            LOG.error("No se pudo completar la consulta USGS: %s", type(exc).__name__)
        elapsed = time.time() - started
        time.sleep(max(1, POLL_SECONDS - elapsed))


@app.middleware("http")
async def origin_and_size_guard(request: FastAPIRequest, call_next):
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in ALLOWED_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "Origen no autorizado"})
    try:
        content_length = int(request.headers.get("content-length", "0"))
    except ValueError:
        return JSONResponse(status_code=400, content={"detail": "Content-Length inválido"})
    if content_length > 16384:
        return JSONResponse(status_code=413, content={"detail": "Solicitud demasiado grande"})
    return await call_next(request)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    global _monitor_thread
    if ENABLE_MONITOR:
        if not WEBPUSH_AVAILABLE:
            raise RuntimeError("Falta pywebpush; instala backend/requirements.txt antes de activar el monitor")
        if not valid_vapid_public_key(VAPID_PUBLIC_KEY) or not VAPID_PRIVATE_KEY_PATH or not Path(VAPID_PRIVATE_KEY_PATH).is_file():
            raise RuntimeError("Configura una clave VAPID pública válida y VAPID_PRIVATE_KEY_PATH a un archivo privado existente")
        if not valid_public_app_url(PUBLIC_APP_URL) or "TU_USUARIO" in PUBLIC_APP_URL:
            raise RuntimeError("PUBLIC_APP_URL debe ser HTTPS y apuntar a la PWA publicada; sustituye el marcador TU_USUARIO")
        if not valid_vapid_subject(VAPID_SUBJECT):
            raise RuntimeError("Configura VAPID_SUBJECT con un correo o URL HTTPS real que administres")
        if not ALLOWED_ORIGINS:
            raise RuntimeError("Configura ALLOWED_ORIGINS con el origen HTTPS exacto de GitHub Pages")
        _monitor_thread = threading.Thread(target=monitor_loop, daemon=True, name="sismo-usgs-monitor")
        _monitor_thread.start()


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    with _monitor_status_lock:
        monitor = dict(_monitor_status)
    healthy = not ENABLE_MONITOR or (monitor["last_success_at"] is not None and
             (time.time() - float(monitor["last_success_at"])) <= max(3 * POLL_SECONDS, 180))
    return {"ok": healthy, "version": "0.7.0", "monitor_enabled": ENABLE_MONITOR,
            "push_configured": push_configured(), "subscriptions": subscription_count(),
            "monitor": monitor}


def subscription_count() -> int:
    try:
        with db_connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS n FROM subscriptions").fetchone()
            return int(row["n"])
    except sqlite3.Error:
        return 0


@app.get("/api/push/public-key")
def get_public_key(request: FastAPIRequest) -> Any:
    origin = request.headers.get("origin", "").rstrip("/")
    if origin not in ALLOWED_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "Origen no autorizado"})
    if not push_configured():
        return JSONResponse(status_code=503, content={"detail": "Web Push no está configurado en el servidor"})  # type: ignore[return-value]
    return {"publicKey": VAPID_PUBLIC_KEY}


@app.post("/api/push/subscribe")
async def subscribe(request: FastAPIRequest) -> JSONResponse:
    origin = request.headers.get("origin", "").rstrip("/")
    if origin not in ALLOWED_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "Origen no autorizado"})
    if not push_configured():
        return JSONResponse(status_code=503, content={"detail": "Web Push no está configurado en el servidor"})
    if not rate_limit(request, "subscribe"):
        return JSONResponse(status_code=429, content={"detail": "Demasiadas solicitudes; inténtalo más tarde"})
    try:
        data = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"detail": "JSON inválido"})
    subscription = data.get("subscription") if isinstance(data, dict) else None
    if not valid_subscription(subscription):
        return JSONResponse(status_code=400, content={"detail": "Suscripción Web Push inválida"})
    try:
        magnitude = float(data.get("minMagnitude"))
    except (ValueError, TypeError, AttributeError):
        return JSONResponse(status_code=400, content={"detail": "Magnitud mínima inválida"})
    if magnitude not in ALLOWED_MAGNITUDES:
        return JSONResponse(status_code=400, content={"detail": "Magnitud mínima no permitida"})
    endpoint = subscription["endpoint"]
    now = time.time()
    with db_connect() as conn:
        exists = conn.execute("SELECT 1 FROM subscriptions WHERE endpoint=?", (endpoint,)).fetchone()
        if exists is None:
            count = int(conn.execute("SELECT COUNT(*) FROM subscriptions").fetchone()[0])
            if count >= MAX_SUBSCRIPTIONS:
                return JSONResponse(status_code=503, content={"detail": "El servicio alcanzó el límite de suscripciones del piloto"})
        conn.execute(
            "INSERT INTO subscriptions(endpoint,subscription_json,min_magnitude,created_at,updated_at) VALUES(?,?,?,?,?) "
            "ON CONFLICT(endpoint) DO UPDATE SET subscription_json=excluded.subscription_json,min_magnitude=excluded.min_magnitude,updated_at=excluded.updated_at",
            (endpoint, json.dumps(subscription, separators=(",", ":")), magnitude, now, now),
        )
        conn.commit()
    return JSONResponse(status_code=201, content={"ok": True, "minMagnitude": magnitude})


@app.delete("/api/push/subscribe")
async def unsubscribe(request: FastAPIRequest) -> JSONResponse:
    origin = request.headers.get("origin", "").rstrip("/")
    if origin not in ALLOWED_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "Origen no autorizado"})
    if not rate_limit(request, "unsubscribe"):
        return JSONResponse(status_code=429, content={"detail": "Demasiadas solicitudes; inténtalo más tarde"})
    try:
        data = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"detail": "JSON inválido"})
    endpoint = data.get("endpoint") if isinstance(data, dict) else None
    if not isinstance(endpoint, str) or not endpoint.startswith("https://") or len(endpoint) > 4096:
        return JSONResponse(status_code=400, content={"detail": "Endpoint inválido"})
    with db_connect() as conn:
        conn.execute("DELETE FROM subscriptions WHERE endpoint=?", (endpoint,))
        conn.execute("DELETE FROM sent_notifications WHERE endpoint=?", (endpoint,))
        conn.commit()
    return JSONResponse(status_code=200, content={"ok": True})
