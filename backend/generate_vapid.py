"""Genera claves VAPID para Web Push y muestra la clave pública para el frontend.

Ejecuta: python backend/generate_vapid.py --output /ruta-privada/vapid_private.pem
El archivo privado NO debe subirse a GitHub ni añadirse al ZIP distribuible.
"""
from __future__ import annotations
import argparse
import base64
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera claves VAPID Web Push")
    parser.add_argument("--output", required=True, help="Ruta segura fuera del repositorio para la clave privada PEM")
    args = parser.parse_args()
    path = Path(args.output).expanduser().resolve()
    if path.exists():
        parser.error(f"El archivo ya existe; no se sobrescribirá: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    key = ec.generate_private_key(ec.SECP256R1())
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    path.write_bytes(pem)
    try:
        path.chmod(0o600)
    except OSError:
        pass
    public = key.public_key().public_numbers()
    raw_public = b"\x04" + public.x.to_bytes(32, "big") + public.y.to_bytes(32, "big")
    print("Clave privada guardada en:", path)
    print("No subas ese archivo a GitHub ni lo compartas en capturas.")
    print("VAPID_PUBLIC_KEY=" + b64url(raw_public))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
