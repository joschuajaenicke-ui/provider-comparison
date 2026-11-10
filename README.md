# Provider-Vergleich für OpenRouter

Eine statische Website, die die Anbieter (Provider) eines OpenRouter-Modells nebeneinander
stellt: Preise pro Million Token, Durchsatz, Time-to-First-Token, Uptime, Cache-Trefferquote —
und die daraus hochgerechneten Kosten für ein eigenes Nutzungsprofil.

**Kein Server, kein Konto, kein API-Schlüssel.** Die Seite lädt eine Datendatei, rechnet im
Browser und sendet nichts.

## Was drin ist

| Bereich | Funktion |
|---|---|
| Modellsuche | Alle Modelle aus OpenRouter durchsuchbar (Name, Kennung, Tippfehler-tolerant) |
| Tabelle | Ein Endpoint je Zeile: Preise, Kontext, tok/s, TTFT, Uptime, Cache-Quote, Kosten |
| Spaltenfilter | Jede Spalte ein- und ausblendbar, vier Spalten-Presets |
| Kostenmodell | Calls, Input-/Output-Token pro Call, Cache-Quote → „Kosten je n Calls“ |
| Grafik | Streudiagramm mit frei wählbaren Achsen, log-Skala, Farbe = Quantisierung, Größe = Uptime |
| Schnellauswahl | Sechs Presets, die Achsen, Spalten und Sortierung zusammen umstellen |
| Nutzungsprofil | Activity-CSV aus OpenRouter wird lokal ausgewertet und ersetzt die Annahmen |
| Filterliste | `ignore`/`only`-Liste für `provider_routing` — bewusst untergeordnet, nur zum Kopieren |

## Aufbau

```
index.html              Seite (Struktur, Erklärtexte)
datenschutz.html        Datenschutzerklärung
assets/style.css        Tokens, Layout, Tabelle, Grafik
assets/app.js           gesamte Logik: Suche, Tabelle, Grafik, CSV, Filterliste
assets/favicon.svg
data/models.json        Datenstand (wird vom Generator geschrieben)
tools/build_data.py     holt die Daten von OpenRouter und schreibt data/models.json
.github/workflows/      tägliche Aktualisierung des Datenstands
```

## Lokal ansehen

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

`file://` funktioniert nicht, weil die Seite `data/models.json` per `fetch` lädt.

## Daten aktualisieren

```bash
python3 tools/build_data.py            # alle Modelle, ~3–5 Minuten
python3 tools/build_data.py --limit 5  # schneller Test
```

Der Generator braucht **keinen API-Schlüssel**: `/api/v1/models`,
`/api/v1/models/<id>/endpoints` und die Frontend-Statistiken sind ohne Authentifizierung
lesbar.

Wichtig für Nachvollziehbarkeit: Durchsatz und Latenz stehen **nicht** in der öffentlichen
Endpoint-API (`throughput_last_30m` ist dort `null`). Sie kommen aus
`/api/frontend/v1/stats/endpoint` — derselben Quelle, aus der die OpenRouter-Modellseite ihre
Werte zieht. Diese Endpunkte sind undokumentiert und können sich ändern; dann bricht der
Generator mit einer leeren Messwert-Spalte ab, nicht mit einem Fehler. Die Seite zeigt in dem
Fall „—“ statt falscher Zahlen.

## Veröffentlichen (GitHub Pages)

1. Repository → Settings → Pages → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
2. Die Action `.github/workflows/refresh-data.yml` aktualisiert `data/models.json` täglich und
   committet den neuen Stand. Sie braucht keine Secrets.
3. Vor dem ersten öffentlichen Auftritt in `datenschutz.html` den Abschnitt „Verantwortlich“
   ausfüllen.

## Rechte und Grenzen

- Keine offizielle Seite von OpenRouter. Preise und Verfügbarkeit ohne Gewähr.
- Qualität ist nicht gemessen: Quantisierung ist ein Indiz, kein Beweis.
- Zahlen sind Momentaufnahmen (30 Minuten für Tempo, eine Woche für die Cache-Quote).
