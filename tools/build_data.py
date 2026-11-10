#!/usr/bin/env python3
"""Baut data/models.json aus den öffentlichen OpenRouter-Endpunkten.

Kein API-Key nötig: /api/v1/models, /api/v1/models/<id>/endpoints und die
Frontend-Statistiken sind ohne Authorization lesbar.

    python3 tools/build_data.py            # alle Modelle
    python3 tools/build_data.py --limit 5  # nur die ersten fünf (Test)
    python3 tools/build_data.py --jobs 8   # Parallelität

Ausgabe: data/models.json (eine Datei, die die Seite zur Laufzeit lädt).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "models.json"

API = "https://openrouter.ai/api/v1"
STATS = "https://openrouter.ai/api/frontend/v1/stats"
UA = "provider-comparison/1.0 (+https://github.com/joschuajaenicke-ui/provider-comparison)"


def get_json(url: str, timeout: int = 45):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def per_million(raw) -> float | None:
    """Preis pro Token -> Preis pro Million Token, gerundet."""
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None
    return round(v * 1_000_000, 4)


def round_or_none(v, digits: int = 1):
    try:
        return round(float(v), digits)
    except (TypeError, ValueError):
        return None


def fetch_frontend(permaslug: str) -> dict:
    """Alles, was die öffentliche /endpoints-API nicht (mehr) liefert.

    Die Endpoint-Liste der Modellseite enthält Durchsatz (p50_throughput) und
    Latenz (p50_latency) der letzten 30 Minuten, die abgerechneten Preise, den
    Status und die Anfragezahl; die Cache-Trefferquote kommt aus einer eigenen
    Wochenreihe. Beides ist nur über den datierten Permaslug erreichbar.
    Rückgabe: {tag: {...}} — leer, wenn der Slug nicht passt.
    """
    q = urllib.parse.quote(permaslug, safe="")
    out: dict[str, dict] = {}
    try:
        eps = get_json(f"{STATS}/endpoint?permaslug={q}&variant=standard"
                       "&perfWorkload=text_generation&latencyMetric=latency").get("data") or []
    except Exception:
        return out
    if not eps:
        return out

    latest: dict = {}
    try:
        series = get_json(f"{STATS}/cache-hit-rate-comparison?permaslug={q}&timeRange=1w").get("data") or []
        if series:
            latest = series[-1].get("y") or {}
    except Exception:
        pass

    for ep in eps:
        tag = ep.get("provider_slug")
        if not tag:
            continue
        p = ep.get("pricing") or {}
        st = ep.get("stats") or {}
        hit = latest.get(ep.get("id"))
        out[tag] = {
            "hit": round(float(hit), 1) if isinstance(hit, (int, float)) else None,
            "in": per_million(p.get("prompt")),
            "out": per_million(p.get("completion")),
            "cache": per_million(p.get("input_cache_read")),
            "toks": round_or_none(st.get("p50_throughput")),
            "ttft": round_or_none(st.get("p50_latency"), 0),
            "req": st.get("request_count"),
            "discount": round_or_none(ep.get("discount_to_user"), 3),
            "status": ep.get("status"),
            "quant": (ep.get("quantization") or "").lower() or None,
        }
    return out


def clean_endpoint(ep: dict) -> dict:
    p = ep.get("pricing") or {}
    th = ep.get("throughput_last_30m") or {}
    lat = ep.get("latency_last_30m") or {}
    return {
        "provider": ep.get("provider_name") or "?",
        "tag": ep.get("tag") or "",
        "quant": (ep.get("quantization") or "unknown").lower(),
        "in": per_million(p.get("prompt")),
        "out": per_million(p.get("completion")),
        # None = kein Cache-Tarif; Cache-Token kosten dann den vollen Input-Preis
        "cache": per_million(p.get("input_cache_read")),
        "discount": round_or_none(p.get("discount"), 3) or 0.0,
        "toks": round_or_none(th.get("p50")),
        "ttft": round_or_none(lat.get("p50"), 0),
        "uptime": round_or_none(ep.get("uptime_last_30m"), 1),
        "status": ep.get("status"),
        "ctx": ep.get("context_length"),
        "maxOut": ep.get("max_completion_tokens"),
        "req": None,
        "moderated": bool((ep.get("supports_moderation") is not None) and ep.get("supports_moderation")),
    }


def permaslug_of(model: dict, eps: list[dict]) -> str:
    for ep in eps:
        name = ep.get("name") or ""
        if " | " in name:
            return name.split(" | ", 1)[1].strip()
    return model.get("canonical_slug") or model.get("id") or ""


def build_model(model: dict) -> dict | None:
    mid = model.get("id")
    if not mid:
        return None
    try:
        data = get_json(f"{API}/models/{mid}/endpoints").get("data") or {}
    except urllib.error.HTTPError as e:
        print(f"  ! {mid}: HTTP {e.code}", file=sys.stderr)
        return None
    except Exception as e:  # noqa: BLE001
        print(f"  ! {mid}: {e}", file=sys.stderr)
        return None

    raw_eps = data.get("endpoints") or []
    if not raw_eps:
        return None
    rows = [clean_endpoint(ep) for ep in raw_eps]

    # Der Permaslug der Modellseite ist der datierte canonical_slug; die
    # Slug-Form aus der Endpoint-Liste trifft nicht immer. Alle Kandidaten
    # durchprobieren, bis einer Endpoints liefert.
    stats: dict = {}
    for cand in dict.fromkeys(filter(None, [
        model.get("canonical_slug"),
        permaslug_of(data, raw_eps),
        model.get("id"),
    ])):
        stats = fetch_frontend(cand)
        if stats:
            break

    for r in rows:
        f = stats.get(r["tag"])
        if not f:
            continue
        # Frontend-Preise gewinnen, wenn sie gesetzt sind (abgerechnete Werte)
        for k in ("in", "out"):
            if f.get(k):
                r[k] = f[k]
        r["cache"] = f.get("cache")
        r["hit"] = f.get("hit")
        # Tempo und Latenz liefert nur noch die Frontend-Statistik
        if r["toks"] is None:
            r["toks"] = f.get("toks")
        if r["ttft"] is None:
            r["ttft"] = f.get("ttft")
        if r["discount"] in (None, 0.0) and f.get("discount"):
            r["discount"] = f["discount"]
        if r["status"] is None:
            r["status"] = f.get("status")
        r["req"] = f.get("req")

    arch = data.get("architecture") or model.get("architecture") or {}
    pricing = model.get("pricing") or {}
    return {
        "id": mid,
        "name": data.get("name") or model.get("name") or mid,
        "slug": permaslug_of(data, raw_eps),
        "ctx": data.get("context_length") or model.get("context_length"),
        "created": model.get("created"),
        "modality": arch.get("modality"),
        "inputs": arch.get("input_modalities"),
        "outputs": arch.get("output_modalities"),
        # Listenpreis des Modells (ohne Anbieterwahl) — Referenz für die Suche
        "in": per_million(pricing.get("prompt")),
        "out": per_million(pricing.get("completion")),
        "cache": per_million(pricing.get("input_cache_read")),
        "endpoints": rows,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--jobs", type=int, default=6)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    print("lade Modellliste …", file=sys.stderr)
    try:
        listing = get_json(f"{API}/models?output_modalities=all").get("data") or []
    except Exception as e:  # noqa: BLE001
        print(f"Modellliste nicht abrufbar: {e}", file=sys.stderr)
        return 1
    if args.limit:
        listing = listing[: args.limit]
    print(f"{len(listing)} Modelle", file=sys.stderr)

    models: list[dict] = []
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = {pool.submit(build_model, m): m for m in listing}
        for i, fut in enumerate(as_completed(futures), 1):
            got = fut.result()
            if got:
                models.append(got)
            if i % 25 == 0 or i == len(futures):
                print(f"  {i}/{len(futures)} · {time.time() - t0:.0f}s", file=sys.stderr)

    models.sort(key=lambda m: m["id"])
    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": {
            "models": f"{API}/models?output_modalities=all",
            "endpoints": f"{API}/models/<id>/endpoints",
            "stats": f"{STATS}/endpoint + /cache-hit-rate-comparison",
        },
        "counts": {
            "models": len(models),
            "endpoints": sum(len(m["endpoints"]) for m in models),
            "providers": len({e["provider"] for m in models for e in m["endpoints"]}),
        },
        "models": models,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = args.out.stat().st_size
    print(f"geschrieben: {args.out} · {payload['counts']['models']} Modelle · "
          f"{payload['counts']['endpoints']} Endpoints · {payload['counts']['providers']} Anbieter · "
          f"{size / 1024:.0f} KB · {time.time() - t0:.0f}s", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
