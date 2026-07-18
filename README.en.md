# AK Base Optimizer

[🇻🇳 Tiếng Việt](README.md) · 🇬🇧 English (you are here)

A RIIC (Base) combo analyzer for Arknights that gives suggestions based on your roster.
Java backend (zero external dependencies) + HTML/CSS/JS frontend running in the browser.

![status](https://img.shields.io/badge/status-active-orange) ![version](https://img.shields.io/badge/version-v0.3.0-blue)

## Features

- **Click-to-select operator picker** — a modal listing all 192 operators in the database, grouped
  by class in base order (Vanguard → Guard → Defender → Medic → Sniper → Caster → Supporter →
  Specialist), with a search box. Click an E0/E1/E2 button to select an operator and set its Elite
  at the same time, then hit Confirm to bulk-add everything to your roster in one go — **no manual
  typing required**. Elite buttons respect real rarity caps (1-2★ only go to E0, 3★ caps at E1,
  4-6★ can reach E2).
- **Bulk paste import** — paste a plain-text list (`Texas E2 60 S2M3`, one operator per line) into
  the paste box; the app parses name + elite (level/skill are optional) and adds everything at once.
- **"+ Add manually"** — still available for typing individual rows, useful for operators not yet
  in the database.
- Automatically matches your roster against **RIIC combos** built from real in-game data: Texas +
  Lappland, Bibeak/Kafka Precious Metal, Vermeil Factory, Waai Fu Factory Stack, Shamare Solo
  Trading, Scene/Bubble Factory, Purestream Power Plant, Jaye Trading Swing, Podenco/Lancet-2 Dorm,
  Castle-3 Factory, Orchid Office+Trading, Gravel Precious Metal, and more.
- Classifies each combo as **active / needs upgrade / not owned**.
- Estimates the LMD cost to elite-promote missing operators, ranking upgrades into **Priority
  S/A/B/C** tiers by estimated ROI.
- Suggests "if you get operator X later, switch to combo Y".

## ⚠️ Important limitations — read before using

1. **The operator database (`backend/data/operators.json`) is auto-generated from real in-game
   data** (see `backend/tools/generate_operators.py`), sourced from
   [Dimbreath/ArknightsData](https://github.com/Dimbreath/ArknightsData) (en-US). That source repo
   is **archived (no longer updated)**, so:
   - The 192 operators with base skills as of the archive date are complete and accurate (name,
     rarity, profession, skill description, room, elite requirement — copied verbatim from the
     game, not guessed).
   - **Operators released AFTER the archive date are NOT in the database** (e.g. Proviso, Tequila,
     Quartz, Pudding — combos the community talks about a lot but that have no data here yet). If
     you own these operators, add them manually following the schema below.
2. **`combo_tags`** (marking which operator belongs to which famous combo) are **hand-curated**,
   currently only for the 17 operators that were cross-checked against their real skill
   descriptions (Texas, Vermeil, Bibeak, Gravel, Shamare, Scene, Bubble, Purestream, Waai Fu, Jaye,
   Kafka, Podenco, Lancet-2, Castle-3, Orchid). Most of the remaining 192 operators have full skill
   data but `combo_tags: []` — they still show up in `/api/operators` and the picker, just not
   assigned to any combo in `combos.json` yet.
3. **Elite-promotion LMD cost is a rough rarity-based average** (`Analyzer.java`), and does NOT
   account for Chips, EXP, or specific materials — an exact per-operator cost table would be far
   too large for this seed dataset. Always check real costs in-game before committing resources.
4. Some combos (e.g. Texas + Lappland) require **two specific operators standing in the same
   room** — the app currently only tracks the operator that has `combo_tags` set (Texas), and does
   NOT check whether you also own Lappland. Read each combo's `notes` field carefully in the
   analysis results.
5. Before using these results to make real resource-investment decisions, cross-check with
   [PRTS.wiki](https://prts.wiki) or GamePress.

👉 This project is designed to be **easy to extend** — see "Adding a new operator" below, or rerun
`backend/tools/generate_operators.py` if you find a more actively maintained data source.

## Project structure

```
ak-base-optimizer/
├── backend/
│   ├── src/main/java/ak/base/
│   │   ├── Json.java        # Hand-written JSON parser/serializer (no internet needed to build)
│   │   ├── DataStore.java   # Loads operators.json + combos.json
│   │   ├── Analyzer.java    # Combo matching, ROI estimation, priority ranking logic
│   │   └── Server.java      # HTTP server (com.sun.net.httpserver), serves API + static frontend
│   ├── data/
│   │   ├── operators.json   # Operator base-skill database (192 operators, auto-generated)
│   │   └── combos.json      # Combo definitions (mapped via combo_tags)
│   └── tools/
│       └── generate_operators.py  # Script to fetch + generate operators.json from real data
├── frontend/
│   ├── index.html            # Main UI + picker modal + bulk paste panel
│   ├── css/style.css
│   └── js/app.js             # Picker logic, bulk paste parser, API calls, result rendering
├── run.sh / run.bat           # Build + run the server in one command
├── README.md / README.en.md
```

## Requirements

- JDK 17+ (only uses the standard `com.sun.net.httpserver` library, no Maven/Gradle needed).
- Any browser.

## Running it

**Linux/macOS:**
```bash
chmod +x run.sh
./run.sh           # defaults to port 8080
./run.sh 9090       # custom port
```

**Windows:**
```cmd
run.bat
run.bat 9090
```

Then open **http://localhost:8080** in your browser.

### Manual build/run (without the scripts)

```bash
cd backend
javac -d out src/main/java/ak/base/*.java
java -cp out ak.base.Server 8080
```

## Ways to enter your roster

Three methods, freely combinable:

1. **Picker (recommended)** — click "☰ Select from Database", search by name or scroll by class,
   click an E0/E1/E2 button to select, then hit "Confirm". Reopening the picker later preloads the
   roster's current Elite values automatically.
2. **Bulk paste** — click "⎘ Paste list", paste multiple lines like `Name E<0-2> [level] [skill]`
   (level/skill optional), then click Import.
3. **Manual add** — click "+ Add manually" to type individual rows, useful for operators not yet in
   the database.

## API

The backend exposes 3 simple JSON endpoints (the frontend calls them via `fetch`):

| Method | Path             | Description                                       |
|--------|------------------|----------------------------------------------------|
| GET    | `/api/operators` | Returns the full operator database                 |
| GET    | `/api/combos`    | Returns the list of combo definitions               |
| POST   | `/api/analyze`   | Body `{ "roster": [...] }` → combo/ROI analysis     |

Example `POST /api/analyze`:
```json
{
  "roster": [
    { "name": "Texas", "elite": 0, "level": 60, "skill": "S2M3" },
    { "name": "Bibeak", "elite": 2 }
  ]
}
```

## Adding a new operator to the database

Open `backend/data/operators.json` and add an object to the `operators` array:

```json
{
  "name": "Operator Name",
  "rarity": 5,
  "profession": "Guard",
  "skills": [
    {
      "id": "op_s2",
      "name": "Skill Base Name",
      "room": "TradingPost",
      "elite_required": 2,
      "level_required": 1,
      "effect": "Effect description",
      "combo_tags": ["your_combo_tag"]
    }
  ]
}
```

`profession` must be one of the 8 recognized values: `Vanguard`, `Guard`, `Defender`, `Medic`,
`Sniper`, `Caster`, `Supporter`, `Specialist` — this determines which group the operator shows up
in inside the picker.

If this operator should belong to a new combo, also add a matching definition in
`backend/data/combos.json` with a `tag` equal to the `combo_tags` value above. No rebuild needed —
the server re-reads the JSON files on every startup (just restart the server after editing data).

## Publishing to GitHub

```bash
git remote add origin https://github.com/<username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## Suggested roadmap (if you want to keep developing this)

- Expand `operators.json` to cover newer operators (Proviso, Tequila, Quartz, Pudding...).
- Add an accurate per-operator elite-cost table instead of the rarity-based estimate.
- Compute real daily profit (LMD or EXP-equivalent) instead of just upgrade cost.
- Allow saving/loading the roster as a JSON file so it doesn't need re-entering every time.
- Import roster from Krooster (krooster.com) — needs the exact export schema before an importer
  can be written safely.
- Add side-by-side comparison of multiple investment directions (A/B/C) as originally requested.
