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
| Tabelle | Ein Endpoint je Zeile: Preise, Kontext, tok/s, TTFT, Uptime, **Cache-Quote je Anbieter**, **Kosten gesamt** und **Kosten je 1.000 Calls** |
| Spaltenfilter | Jede Spalte ein- und ausblendbar, sechs Spalten-Sets |
| Anbieterfilter | Einzelne Anbieter aus Tabelle und Grafik ausblenden, mit Suche und „alle/keine“ |
| Nutzungsprofil | Absolute Tokenmengen (Calls, Input in Mio, Output in Mio) oder Activity-CSV — an einer Stelle oberhalb der Tabelle. Das Log wird auf das gewählte Modell gefiltert: Tokenmengen eines anderen Modells auf fremde Preise zu übertragen wäre ein Modellvergleich und sagt nichts aus |
| Grafik | Streudiagramm mit frei wählbaren Achsen, log-Skala, Farbe = Quantisierung, Größe = Uptime |
| Schnellauswahl | Sechs Presets, die Achsen, Spalten und Sortierung zusammen umstellen — Preis/Leistung getrennt nach Listenpreis und Nutzungsprofil |
| CSV-Export | Exportiert genau die angezeigte Liste (Sortierung, Spalten, Anbieterfilter) |
| Sprachen | Deutsch und Englisch, umschaltbar im Kopf; Auswahl bleibt lokal gespeichert |

## Aufbau

```
index.html              Seite (Struktur, zweisprachige Erklärtexte)
datenschutz.html        Datenschutzerklärung (deutsch und englisch)
assets/style.css        Tokens, Layout, Tabelle, Grafik
assets/app.js           gesamte Logik: Texte, Suche, Tabelle, Filter, Export, Grafik, CSV
assets/datenschutz.js   Sprache und Datenstand für die Datenschutzseite
assets/favicon.svg
data/models.json        Datenstand (wird vom Generator geschrieben)
tools/build_data.py     holt die Daten von OpenRouter und schreibt data/models.json
.github/workflows/      tägliche Aktualisierung des Datenstands
```

## Bedienung in zwei Sätzen

Tokenmengen aus dem OpenRouter-Dashboard unter **Dashboard → Logs → Menü (⋯) → Export**
herunterladen und im Feld „Nutzungsprofil“ ablegen — oder die Summen (Calls, Input-Token,
Output-Token) direkt eintragen. Alles darunter rechnet sofort mit diesen Werten; „Als CSV
exportieren“ gibt die aktuelle Tabelle mit allen Filtern zurück.

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

## Entstehung

Diese Seite wurde **vollständig von einem Hermes Agent** (Nous Research) generiert, der mit
**DeepSeek V4.1 Flash** lief: Struktur, Styles, Anwendungslogik, Datengenerator, GitHub-Workflow,
Datenschutztext und die englische Fassung. Grundlage sind die öffentlichen OpenRouter-APIs; die 
inhaltlichen Entscheidungen, Korrekturen und Abnahmekriterien kamen vom Betreiber.

Der Code ist also maschinell erzeugt und anschließend geprüft — im Browser (Klicks, Export,
beide Sprachen, schmale Viewports, Konsole) und gegen die API (Datensätze, Feldzuordnung). Er ist
nicht Zeile für Zeile von Hand geschrieben; wer daran weiterarbeitet, sollte das im Hinterkopf
haben.

## Rechte und Grenzen

- Keine offizielle Seite von OpenRouter. Preise und Verfügbarkeit ohne Gewähr.
- Qualität ist nicht gemessen: Quantisierung ist ein Indiz, kein Beweis.
- Zahlen sind Momentaufnahmen (30 Minuten für Tempo, eine Woche für die Cache-Quote).
