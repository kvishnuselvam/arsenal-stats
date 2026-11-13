"""Shared helpers: polite HTTP, JSON storage, name matching."""
import json
import os
import re
import time
import unicodedata

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
UA = {"User-Agent": "arsenal-stats personal tracker (+https://github.com/kvishnuselvam/arsenal-stats)"}

_session = requests.Session()
_session.headers.update(UA)
_last = [0.0]


def get_json(url, delay=0.25, tries=4):
    """GET a JSON document with a small delay between calls and simple retries."""
    for attempt in range(tries):
        wait = delay - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            r = _session.get(url, timeout=45)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
            print(f"  HTTP {r.status_code} {url}")
        except (requests.RequestException, ValueError) as e:
            print(f"  error {e} {url}")
        time.sleep(3 * (attempt + 1))
    return None


def load(path, default=None):
    full = os.path.join(DATA, path)
    if not os.path.exists(full):
        return default
    with open(full) as f:
        return json.load(f)


def save(path, obj, compact=True):
    full = os.path.join(DATA, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    tmp = full + ".tmp"
    with open(tmp, "w") as f:
        if compact:
            json.dump(obj, f, separators=(",", ":"), sort_keys=True, ensure_ascii=False)
        else:
            json.dump(obj, f, indent=1, sort_keys=True, ensure_ascii=False)
    os.replace(tmp, full)


def norm(name):
    """Lowercase ASCII letters and spaces only, for name matching."""
    s = unicodedata.normalize("NFKD", name or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("ø", "o").replace("Ø", "o").replace("ł", "l").replace("ß", "ss").replace("æ", "ae")
    s = re.sub(r"[^a-zA-Z ]+", " ", s).lower()
    return " ".join(s.split())


def season_label(start_year):
    return f"{start_year}-{str(start_year + 1)[-2:]}"
