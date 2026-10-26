import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path


def now_ms():
    return time.time_ns() // 1_000_000


class Store:
    def __init__(self, path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.db() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS telemetry (
                    device TEXT, boot INTEGER, seq INTEGER, received_ms INTEGER, body TEXT,
                    PRIMARY KEY(device, boot, seq));
                CREATE INDEX IF NOT EXISTS telemetry_time ON telemetry(device, received_ms);
                CREATE TABLE IF NOT EXISTS commands (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, device TEXT, boot INTEGER,
                    issued_ms INTEGER, expires_ms INTEGER, op INTEGER, args TEXT,
                    state TEXT DEFAULT 'sent', ack_code INTEGER, ack_stage TEXT);
                CREATE TABLE IF NOT EXISTS gateway (
                    device TEXT PRIMARY KEY, online INTEGER, received_ms INTEGER);
            """)

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def telemetry(self, device, body):
        with self.db() as db:
            db.execute("INSERT OR IGNORE INTO telemetry VALUES(?,?,?,?,?)", (
                device, body["boot"], body["seq"], now_ms(), json.dumps(body, allow_nan=False)))

    def gateway(self, device, online):
        with self.db() as db:
            db.execute("INSERT OR REPLACE INTO gateway VALUES(?,?,?)", (device, int(online), now_ms()))

    def latest(self, device):
        with self.db() as db:
            row = db.execute("SELECT received_ms,body FROM telemetry WHERE device=? ORDER BY received_ms DESC,rowid DESC LIMIT 1", (device,)).fetchone()
        if row is None:
            return None
        return dict(json.loads(row["body"]), received_ms=row["received_ms"])

    def history(self, device, limit=120):
        with self.db() as db:
            rows = db.execute("SELECT received_ms,body FROM telemetry WHERE device=? ORDER BY received_ms DESC,rowid DESC LIMIT ?", (device, limit)).fetchall()
        return [dict(json.loads(r["body"]), received_ms=r["received_ms"]) for r in reversed(rows)]

    def gateway_online(self, device):
        with self.db() as db:
            row = db.execute("SELECT online FROM gateway WHERE device=?", (device,)).fetchone()
        return bool(row and row["online"])

    def issue(self, device, boot, op, args):
        issued = now_ms()
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("UPDATE commands SET state='expired' WHERE state='sent' AND expires_ms<=?", (issued,))
            if db.execute("SELECT id FROM commands WHERE device=? AND state='sent'", (device,)).fetchone():
                raise ValueError("上一条指令仍在等待确认")
            cur = db.execute("INSERT INTO commands(device,boot,issued_ms,expires_ms,op,args) VALUES(?,?,?,?,?,?)", (
                device, boot, issued, issued+10000, op, json.dumps(args)))
            seq = cur.lastrowid
            if seq > 0x7FFFFFFF:
                raise ValueError("指令编号已用尽")
        return {"id": seq, "boot": boot, "issued_ms": issued, "expires_ms": issued+10000, "op": op, "args": args}

    def ack(self, device, body):
        with self.db() as db:
            db.execute("UPDATE commands SET state=?,ack_code=?,ack_stage=? WHERE device=? AND id=? AND state='sent'", (
                "accepted" if body["code"] in (0, 1) and body["stage"] == "stm32" else "rejected",
                body["code"], body["stage"], device, body["id"]))

    def fail(self, device, seq):
        with self.db() as db:
            db.execute("UPDATE commands SET state='publish_failed' WHERE device=? AND id=? AND state='sent'", (device, seq))

    def commands(self, device):
        with self.db() as db:
            db.execute("UPDATE commands SET state='expired' WHERE state='sent' AND expires_ms<=?", (now_ms(),))
            rows = db.execute("SELECT * FROM commands WHERE device=? ORDER BY id DESC LIMIT 15", (device,)).fetchall()
        return [dict(r, args=json.loads(r["args"])) for r in rows]
