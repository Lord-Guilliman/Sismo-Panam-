import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main as push_main


class ParseFeatureTests(unittest.TestCase):
    def test_valid_panama_feature(self):
        feature = {
            "id": "pt0001",
            "properties": {"mag": 4.6, "time": 1_800_000_000_000, "updated": 1_800_000_001_000,
                           "place": "Panama", "url": "https://earthquake.usgs.gov/earthquakes/eventpage/pt0001"},
            "geometry": {"coordinates": [-80.0, 8.5, 10.0]},
        }
        parsed = push_main.parse_usgs_feature(feature)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["id"], "pt0001")
        self.assertAlmostEqual(parsed["mag"], 4.6)

    def test_rejects_coordinates_outside_region(self):
        feature = {"id": "far", "properties": {"mag": 5.0, "time": 1_800_000_000_000},
                   "geometry": {"coordinates": [-120.0, 0.0, 5.0]}}
        self.assertIsNone(push_main.parse_usgs_feature(feature))

    def test_rejects_unsafe_event_url(self):
        feature = {"id": "x", "properties": {"mag": 5.0, "time": 1_800_000_000_000, "url": "javascript:alert(1)"},
                   "geometry": {"coordinates": [-80.0, 8.5, 5.0]}}
        parsed = push_main.parse_usgs_feature(feature)
        self.assertEqual(parsed["url"], "https://earthquake.usgs.gov/earthquakes/map/")


class WebPushLogicTests(unittest.TestCase):
    def test_vapid_public_key_format_validation(self):
        import base64
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        private = ec.generate_private_key(ec.SECP256R1())
        raw = private.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        valid_shape = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
        self.assertTrue(push_main.valid_vapid_public_key(valid_shape))
        self.assertFalse(push_main.valid_vapid_public_key("not-a-vapid-key!"))
        self.assertFalse(push_main.valid_vapid_public_key(""))

    def test_push_is_not_considered_configured_with_placeholders(self):
        with patch.object(push_main, "WEBPUSH_AVAILABLE", True), \
             patch.object(push_main, "VAPID_PUBLIC_KEY", "placeholder"), \
             patch.object(push_main, "VAPID_PRIVATE_KEY_PATH", "/missing/private.pem"), \
             patch.object(push_main, "VAPID_SUBJECT", "mailto:TU_CORREO_REAL"), \
             patch.object(push_main, "PUBLIC_APP_URL", "https://TU_USUARIO.github.io/sismo-panama/"), \
             patch.object(push_main, "ALLOWED_ORIGINS", set()):
            self.assertFalse(push_main.push_configured())

    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(push_main, "DB_PATH", Path(self.tempdir.name) / "test.sqlite3")
        self.db_patch.start()
        push_main.init_db()
        self.addCleanup(self.db_patch.stop)
        self.addCleanup(self.tempdir.cleanup)

    def test_invalid_subscription_is_rejected(self):
        import base64
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        public_key = ec.generate_private_key(ec.SECP256R1()).public_key()
        point = public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        keys = {"p256dh": base64.urlsafe_b64encode(point).decode("ascii").rstrip("="),
                "auth": base64.urlsafe_b64encode(b"a" * 16).decode("ascii").rstrip("=")}
        self.assertFalse(push_main.valid_subscription({"endpoint": "http://fcm.googleapis.com/push", "keys": keys}))
        self.assertFalse(push_main.valid_subscription({"endpoint": "https://127.0.0.1/internal", "keys": keys}))
        self.assertFalse(push_main.valid_subscription({"endpoint": "https://push.example/sub", "keys": keys}))
        self.assertFalse(push_main.valid_subscription({"endpoint": "https://user:pass@fcm.googleapis.com/sub", "keys": keys}))
        self.assertFalse(push_main.valid_subscription({"endpoint": "https://fcm.googleapis.com:notaport/sub", "keys": keys}))
        self.assertFalse(push_main.valid_subscription({"endpoint": "https://fcm.googleapis.com/fcm/send/demo", "keys": {"p256dh":"bad", "auth":"bad"}}))
        self.assertTrue(push_main.valid_subscription({"endpoint": "https://fcm.googleapis.com/fcm/send/demo", "keys": keys}))
        self.assertTrue(push_main.valid_subscription({"endpoint": "https://updates.push.services.mozilla.com/wpush/v2/demo", "keys": keys}))

    def test_process_sends_only_to_magnitude_threshold_and_deduplicates(self):
        now = 1_800_000_100.0
        sub1 = {"endpoint": "https://push.example/low", "keys": {"p256dh": "A"*40, "auth": "B"*20}}
        sub2 = {"endpoint": "https://push.example/high", "keys": {"p256dh": "C"*40, "auth": "D"*20}}
        with push_main.db_connect() as conn:
            conn.execute("INSERT INTO subscriptions VALUES(?,?,?,?,?)", (sub1["endpoint"], __import__("json").dumps(sub1), 4.0, now, now))
            conn.execute("INSERT INTO subscriptions VALUES(?,?,?,?,?)", (sub2["endpoint"], __import__("json").dumps(sub2), 5.0, now, now))
            conn.commit()
        event = {"id": "evt1", "mag": 4.6, "time": now - 30, "updated": now - 10,
                 "place": "Panamá", "url": "https://earthquake.usgs.gov/earthquakes/eventpage/evt1", "lat": 8.5, "lon": -80}
        sent = []
        with patch.object(push_main, "send_web_push", side_effect=lambda sub, payload: sent.append((sub["endpoint"], payload))):
            stats = push_main.process_events([event], now=now)
            second = push_main.process_events([event], now=now + 30)
        self.assertEqual(stats["sent"], 1)
        self.assertEqual(second["sent"], 0)
        self.assertEqual([x[0] for x in sent], [sub1["endpoint"]])

    def test_event_older_than_window_is_not_sent(self):
        now = 1_800_000_100.0
        event = {"id": "old", "mag": 6.0, "time": now - 1000, "updated": now - 1,
                 "place": "Panamá", "url": "https://earthquake.usgs.gov/earthquakes/map/", "lat": 8.5, "lon": -80}
        sent = []
        with patch.object(push_main, "send_web_push", side_effect=lambda sub, payload: sent.append(payload)):
            stats = push_main.process_events([event], now=now)
        self.assertEqual(stats["sent"], 0)

    def test_magnitude_upgrade_sends_revision_once(self):
        now = 1_800_000_100.0
        sub = {"endpoint": "https://push.example/revise", "keys": {"p256dh": "E"*40, "auth": "F"*20}}
        import json
        with push_main.db_connect() as conn:
            conn.execute("INSERT INTO subscriptions VALUES(?,?,?,?,?)", (sub["endpoint"], json.dumps(sub), 4.0, now, now))
            conn.commit()
        event = {"id": "revision", "mag": 4.5, "time": now - 20, "updated": now - 1,
                 "place": "Panamá", "url": "https://earthquake.usgs.gov/earthquakes/map/", "lat": 8.5, "lon": -80}
        sent = []
        with patch.object(push_main, "send_web_push", side_effect=lambda _sub, payload: sent.append(payload)):
            first = push_main.process_events([event], now=now)
            revised_event = dict(event, mag=5.0, updated=now + 1)
            second = push_main.process_events([revised_event], now=now + 2)
            third = push_main.process_events([revised_event], now=now + 3)
        self.assertEqual(first["sent"], 1)
        self.assertEqual(second["sent"], 1)
        self.assertEqual(third["sent"], 0)
        self.assertIn("Magnitud revisada", sent[1]["title"])

    def test_subscription_schema_does_not_collect_coordinates(self):
        with push_main.db_connect() as conn:
            columns = {row["name"] for row in conn.execute("PRAGMA table_info(subscriptions)")}
        self.assertNotIn("lat", columns)
        self.assertNotIn("lon", columns)


if __name__ == "__main__":
    unittest.main()
