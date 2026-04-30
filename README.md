# ButtonsMaker

**DE:** ButtonsMaker ist ein browserbasierter Konfigurator für DIN-A4-Druckvorlagen von Needle-Buttons (Ansteckbuttons, hergestellt mit einer Stanzmaschine). Keine Installation, kein Backend – funktioniert direkt im Browser.

**EN:** ButtonsMaker is a browser-based configurator for DIN-A4 print templates for needle buttons (badge buttons, made with a punch press). No installation, no backend – runs directly in the browser.

---

## Features / Funktionen

- **Interaktiver Canvas-Editor** – Text und Formen per Drag & Drop verschieben, rotieren und skalieren direkt im Editor-Modal
- **Text-Effekte (WordArt)** – Schatten (Farbe, Unschärfe, Offset), Konturlinie (Farbe, Breite) und Bogen-Radius (−100 bis +100 mm) pro Text-Ebene
- **Formen-Editor** – Kreis, Ellipse, Rechteck, abgerundetes Rechteck, Dreieck, Stern, Linie – mit Füllfarbe, Deckkraft, Kontur, Position, Rotation
- **A4-Layout-Optimierung** – Platziert automatisch so viele Buttons wie möglich auf einer DIN-A4-Seite
- **Button-Konfigurator** – Hintergrundfarbe, Bild-Upload, mehrzeiliger Text (Schrift, Größe, Farbe, Position)
- **Druckführungskreise** – Roter Kreis (sichtbarer Druckbereich) + blauer Kreis (Falzbereich) werden mitgedruckt
- **Entwurfsansicht** – Auswahl-Handles und UI-Elemente werden beim Drucken ausgeblendet
- **Vorlagen** – Buttons als Vorlage speichern und wiederverwenden
- **Kopieren** – Ausgewählten Button duplizieren
- **Mehrere Seiten** – Beliebig viele A4-Seiten pro Projekt
- **Projekt speichern/laden** – LocalStorage + JSON-Export/Import
- **Vordefinierte Größen** – 25 mm, 31 mm, 37 mm, 50 mm, 56 mm, 75 mm + benutzerdefiniert

---

## Buttons verstehen / Understanding Buttons

Jeder Button besteht aus zwei konzentrischen Kreisen:

| Kreis | Farbe | Bedeutung |
|-------|-------|-----------|
| Innenkreis | Rot | Sichtbarer Druckbereich (Button-Durchmesser) |
| Außenkreis | Blau | Überstand/Falzbereich (~7 mm je Seite) |

Der Inhalt (Bild, Text) wird auf den Innenkreis beschnitten. Beide Kreise werden mitgedruckt und dienen als Schnittmarken für die Stanzmaschine.

---

## Lokal starten / Run Locally

Einfach `index.html` in einem modernen Browser öffnen – keine weitere Installation nötig.

```bash
# Oder mit einem einfachen HTTP-Server:
npx serve .
# oder
python -m http.server 8080
```

---

## GitHub Pages

1. Repository-Einstellungen → **Pages**
2. Branch: `main`, Ordner: `/ (root)`
3. Speichern → Die App ist unter `https://X3S2.github.io/buttonsmaker/` erreichbar

> **Hinweis:** Bei privaten Repos ist GitHub Pages nur mit GitHub Pro/Team verfügbar. Alternativ das Repo öffentlich schalten.

---

## Versionskonvention

`X.Y.Z`
- **X** – Major: Nur auf explizite Anweisung; startet bei 0, wird beim ersten Release auf 1 gesetzt
- **Y** – Minor: Große Feature-Sprünge
- **Z** – Patch: Kleine Änderungen, Fixes

---

## Lizenz / License

MIT License – freie Nutzung, Weitergabe und Anpassung.

---

*Erstellt mit Claude Code – [ButtonsMaker auf GitHub](https://github.com/X3S2/buttonsmaker)* · v0.3.1
