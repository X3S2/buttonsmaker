# Changelog

Alle wichtigen Änderungen an diesem Projekt werden hier dokumentiert.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung nach `X.Y.Z` (siehe README).

---

## [0.1.1] – 2026-04-30 16:52

### Geändert
- Button-Abstand: fester Mindestabstand von 2 mm zwischen den Außenkreisen benachbarter Buttons (horizontal und vertikal), überschüssiger Platz wird als Rand verteilt
- Innenkreis (rot) wird beim Drucken ausgeblendet (`no-print`); nur der Außenkreis (blau) wird mitgedruckt

---

## [0.1.0] – 2026-04-30 16:17

### Hinzugefügt
- Initiale Version der ButtonsMaker-Webapplikation
- A4-Layout-Berechnung: automatische Platzierung von maximal vielen Buttons auf DIN-A4
- Vordefinierte Button-Größen: 25 mm, 31 mm, 37 mm, 50 mm, 56 mm, 75 mm sowie benutzerdefinierte Eingabe
- SVG-basiertes Button-Rendering mit rotem Innenkreis (Druckbereich) und blauem Außenkreis (Falzbereich)
- Button-Konfigurator: Hintergrundfarbe, Bild-Upload (base64), Text-Ebenen (Schrift, Größe, Farbe, X/Y-Position, Ausrichtung, Fett/Kursiv)
- Button kopieren: Duplizieren eines ausgewählten Buttons ins nächste freie Slot
- Vorlagen-System: Buttons als benannte Vorlage in LocalStorage speichern und wiederverwenden
- Mehrere Seiten: Seiten hinzufügen/löschen, Navigation ◀ ▶
- Projekt speichern/laden: LocalStorage-Persistenz und JSON-Datei-Export/Import
- Drucken: `@media print` blendet alle UI-Elemente aus; Führungskreise werden mitgedruckt
- Entwurfsansicht: Auswahl-Highlights, Toolbar und Sidebar beim Drucken unsichtbar
- README.md mit Projekt-Beschreibung (DE/EN), Feature-Übersicht und Anleitungen
- CHANGELOG.md (dieses Dokument)
- .gitignore für macOS-Metadaten, Design-Quelldateien und gängige IDE-Dateien
