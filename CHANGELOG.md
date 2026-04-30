# Changelog

Alle wichtigen Änderungen an diesem Projekt werden hier dokumentiert.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung nach `X.Y.Z` (siehe README).

---

## [0.2.3] – 2026-04-30 19:04

### Geändert
- Vorschau-Panel im Editor vergrößert: Breite 256 → 340 px, SVG-Größe 210 → 290 px
- Modal-Breite 820 → 980 px

---



### Hinzugefügt
- Vorschau im Button-Editor per Klick vergrößerbar (großes Overlay, Schließen per Klick oder ESC)

### Geändert
- Dropdown-Felder (Größenauswahl, Schrift, Form-Typ): solider dunkler Hintergrund (#14143a) statt transparentem Glas, damit Text in Browser-nativen Optionslisten sichtbar ist

---



### Geändert
- Hintergrundbild wird jetzt über den gesamten Button (bis zur blauen Außenlinie) dargestellt, nicht mehr auf den Innenkreis beschränkt
- Roter Innenkreis bleibt reine Entwurfs-Schablone (kein Clip für das Bild)
- Cover-Skalierung und Canvas-Widget angepasst (Referenzgröße: Außendurchmesser statt Innendurchmesser)

---



### Hinzugefügt
- **Formen-Editor**: Beliebig viele Formebenen pro Button – Typen: Kreis, Ellipse, Rechteck, Abgerundetes Rechteck, Dreieck, Stern, Linie
- Jede Form konfigurierbar: Füllfarbe, Deckkraft (Schieberegler), Konturfarbe, Konturbreite, Position X/Y (%), Größe B/H (%), Rotation (°)
- **Pipette für Formen**: Jede Form hat ihren eigenen Eyedropper-Button (🔬) – Farbe direkt aus dem Canvas-Widget aufnehmen
- Formen-Rendering in SVG (Druckausgabe) und Canvas (Editor-Preview) vollständig implementiert
- Callback-basierter Eyedropper: Pipette leitet Farbe gezielt an bgColor oder Shape-Füllfarbe weiter

### Geändert
- **Komplettes UI-Redesign**: „Midnight Studio" Glassmorphism-Design
  - Ultra-dunkler Hintergrund (#08081a) mit gepunktetem Rastermuster
  - Glassmorphism-Panels mit `backdrop-filter: blur()`
  - Gradient-Akzente (Violet → Blau → Cyan) für Logo, Überschriften, Buttons
  - Custom Scrollbar, Hover-Animationen, Glow-Effekte
  - Abgerundete Elemente, Pill-Buttons, verbesserte Typografie-Hierarchie

---



### Hinzugefügt
- **Bild verschieben**: Im Button-Editor können Hintergrundbilder per Drag&Drop innerhalb des Buttons repositioniert werden (interaktives Canvas-Widget)
- **Zoom-Schieberegler**: Bild lässt sich von 0.5× bis 3× zoomen
- **Pipette (Eyedropper)**: Klick auf den Pipette-Button + Klick ins Bild übernimmt die Pixelfarbe als Hintergrundfarbe (Außenbereich/Falz)
- **Position zurücksetzen**: Reset-Button setzt Offset und Zoom auf Standardwerte zurück
- Bild-Positionierung wird korrekt im SVG-Rendering übernommen (Cover-Berechnung mit Offset und Zoom)

### Geändert
- Bild-Rendering: von SVG-Pattern auf direkte `<image>`-Elemente mit exakter Cover-Positionierung (benötigt gespeicherte Natural-Dimensionen)
- `ButtonConfig` um Felder `imgNaturalW/H`, `imgX`, `imgY`, `imgScale` erweitert; Rückwärts-Kompatibilität zu älteren Saves bleibt erhalten

---



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
