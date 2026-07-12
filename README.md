# AK Base Optimizer

Công cụ phân tích & gợi ý combo RIIC (Base) cho Arknights dựa trên roster của bạn.
Backend Java (không phụ thuộc thư viện ngoài) + Frontend HTML/CSS/JS chạy trong trình duyệt.

![status](https://img.shields.io/badge/status-seed--project-orange)

## Tính năng

- Nhập roster (tên, elite, level, skill) trực tiếp trên UI, không cần login/API key.
- Tự động khớp roster với các **combo RIIC nổi tiếng**: Texas+Vermeil, Proviso Refill Squad
  (Proviso/Tequila/Bibeak), Factory Gold Squad (Pudding/Waai Fu/Jaye/Kafka), Shamare, Scene/Bubble,
  Podenco, Lancet-2, Castle-3, Quartz, Orchid/Mon3tr, Gravel/Purestream...
- Phân loại mỗi combo: **đang hoạt động / cần nâng cấp / chưa sở hữu**.
- Ước tính chi phí LMD để nâng elite operator còn thiếu, xếp **Priority S/A/B/C** theo ROI ước tính.
- Gợi ý "nếu sau này có operator X thì chuyển sang combo Y".

## ⚠️ Giới hạn quan trọng — đọc trước khi dùng

1. **Database operator (`backend/data/operators.json`) là seed data**, không phải bộ dữ liệu đầy đủ
   300+ operator của Arknights. Nó được tạo dựa trên kiến thức chung, không fetch trực tiếp từ
   PRTS.wiki/GamePress, nên **có thể sai lệch % buff, điều kiện elite, hoặc thiếu operator mới**.
2. **Chi phí LMD nâng elite chỉ là ước tính trung bình theo rarity** (`Analyzer.java`), KHÔNG tính
   Chip, EXP, hay vật liệu chuyên biệt — vì bộ dữ liệu chi phí chính xác theo từng operator quá lớn
   để nhồi vào bản seed này. Luôn kiểm tra chi phí thật trong game trước khi quyết định nâng cấp lớn.
3. Trước khi dùng kết quả để ra quyết định đầu tư tài nguyên thật, hãy đối chiếu với
   [PRTS.wiki](https://prts.wiki) hoặc GamePress.

👉 Vì vậy project này được thiết kế để **dễ mở rộng** — xem phần "Thêm operator mới" bên dưới.

## Cấu trúc project

```
ak-base-optimizer/
├── backend/
│   ├── src/main/java/ak/base/
│   │   ├── Json.java        # JSON parser/serializer viết tay (không cần internet để build)
│   │   ├── DataStore.java   # Load operators.json + combos.json
│   │   ├── Analyzer.java    # Logic match combo, ước tính ROI, xếp priority
│   │   └── Server.java      # HTTP server (com.sun.net.httpserver), phục vụ API + static frontend
│   └── data/
│       ├── operators.json   # Database operator base skill (seed, có thể mở rộng)
│       └── combos.json      # Định nghĩa các combo (map theo combo_tags)
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── run.sh / run.bat         # Build + chạy server 1 lệnh
└── README.md
```

## Yêu cầu

- JDK 17+ (chỉ dùng thư viện chuẩn `com.sun.net.httpserver`, không cần Maven/Gradle).
- Trình duyệt bất kỳ.

## Chạy

**Linux/macOS:**
```bash
chmod +x run.sh
./run.sh           # mặc định cổng 8080
./run.sh 9090       # đổi cổng
```

**Windows:**
```cmd
run.bat
run.bat 9090
```

Sau đó mở **http://localhost:8080** trong trình duyệt.

### Build/chạy thủ công (không dùng script)

```bash
cd backend
javac -d out src/main/java/ak/base/*.java
java -cp out ak.base.Server 8080
```

## API

Backend expose 3 endpoint JSON đơn giản (frontend gọi qua `fetch`):

| Method | Path            | Mô tả                                          |
|--------|-----------------|-------------------------------------------------|
| GET    | `/api/operators`| Trả về toàn bộ database operator                 |
| GET    | `/api/combos`    | Trả về danh sách định nghĩa combo                |
| POST   | `/api/analyze`   | Body `{ "roster": [...] }` → phân tích combo/ROI |

Ví dụ `POST /api/analyze`:
```json
{
  "roster": [
    { "name": "Texas", "elite": 2, "level": 60, "skill": "S2M3" },
    { "name": "Vermeil", "elite": 1, "level": 50 }
  ]
}
```

## Thêm operator mới vào database

Mở `backend/data/operators.json`, thêm object vào mảng `operators`:

```json
{
  "name": "Ten Operator",
  "rarity": 5,
  "profession": "Guard",
  "skills": [
    {
      "id": "ten_s2",
      "name": "Ten Skill Base",
      "room": "TradingPost",
      "elite_required": 2,
      "level_required": 1,
      "skill_slot": 2,
      "module_required": null,
      "effect": "Mô tả hiệu ứng",
      "value_pct": 30,
      "combo_tags": ["ten_combo_tag"]
    }
  ]
}
```

Nếu muốn operator này thuộc một combo mới, thêm định nghĩa tương ứng vào `backend/data/combos.json`
với `tag` trùng với `combo_tags` ở trên. Không cần build lại gì — server đọc file JSON mỗi lần khởi động
(khởi động lại server sau khi sửa data).

## Đưa lên GitHub

Repo đã được khởi tạo local (`git init` + commit đầu tiên). Để đẩy lên GitHub của bạn:

```bash
git remote add origin https://github.com/<username>/<ten-repo>.git
git branch -M main
git push -u origin main
```

## Roadmap gợi ý (nếu muốn phát triển thêm)

- Mở rộng `operators.json` cho đủ toàn bộ operator có base skill (dùng PRTS.wiki làm nguồn).
- Thêm bảng chi phí elite chính xác theo từng operator (thay vì ước tính theo rarity).
- Tính lợi nhuận/ngày thực tế (LMD hoặc EXP quy đổi) thay vì chỉ ước tính chi phí nâng cấp.
- Cho phép lưu/tải roster dưới dạng file JSON để không phải nhập lại mỗi lần.
- Thêm chế độ so sánh nhiều hướng đầu tư (A/B/C) side-by-side như yêu cầu ban đầu.

# AK Base Optimizer

> A lightweight, offline-first Arknights RIIC (Base) optimizer that analyzes your operator roster and recommends the most efficient base combinations, upgrade priorities, and future investment paths.

![Status](https://img.shields.io/badge/status-early--development-orange)

---

## Features

* Import your operator roster directly through the web interface — no login or API key required.
* Automatically detect popular RIIC combinations, including:

  * Texas + Vermeil
  * Proviso Refill Squad (Proviso / Tequila / Bibeak)
  * Factory Gold Squad (Pudding / Waai Fu / Jaye / Kafka)
  * Shamare
  * Scene + Bubble
  * Podenco
  * Lancet-2
  * Castle-3
  * Quartz
  * Orchid + Mon3tr
  * Gravel + Purestream
  * ...and many more.
* Classify each RIIC combination as:

  * ✅ Active
  * 🟡 Upgradeable
  * ❌ Missing Operators
* Estimate Elite promotion LMD costs for missing operators.
* Prioritize upgrades using estimated Return on Investment (ROI), ranked from **Priority S** to **Priority C**.
* Recommend future operators that would unlock stronger RIIC combinations.

---

# ⚠️ Important Limitations

Please read this section before relying on the optimizer's recommendations.

### 1. Operator Database

The operator database (`backend/data/operators.json`) currently contains **seed data** rather than the complete Arknights roster (300+ operators).

The data was manually compiled from community knowledge instead of being fetched directly from resources such as PRTS Wiki or GamePress. Therefore, some information may be inaccurate or incomplete, including:

* Base skill values
* Elite requirements
* Newly released operators
* Future balance changes

---

### 2. Upgrade Cost Estimation

Elite promotion costs are estimated using rarity-based averages implemented in `Analyzer.java`.

The current estimator **does not include**:

* EXP Cards
* Chips / Dualchips
* Elite materials
* Operator-specific promotion costs

Always verify the actual in-game requirements before investing significant resources.

---

### 3. Data Accuracy

This project is intended as a planning assistant rather than an authoritative game database.

For official or up-to-date information, please consult:

* PRTS Wiki
* GamePress
* Arknights in-game data

The project is intentionally designed to be easy to extend. See **Adding New Operators** below.

---

# Project Structure

```text
ak-base-optimizer/
├── backend/
│   ├── src/main/java/ak/base/
│   │   ├── Json.java        # Custom JSON parser/serializer (no external libraries)
│   │   ├── DataStore.java   # Loads operators.json and combos.json
│   │   ├── Analyzer.java    # RIIC analysis, ROI estimation, priority calculation
│   │   └── Server.java      # Lightweight HTTP server using com.sun.net.httpserver
│   └── data/
│       ├── operators.json   # Operator database (seed data, easily extendable)
│       └── combos.json      # RIIC combination definitions
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── run.sh / run.bat         # One-command build & launch
└── README.md
```

---

# Requirements

* Java Development Kit (JDK) 17 or later
* Any modern web browser

No Maven, Gradle, Node.js, or third-party libraries are required.

---

# Running the Project

## Linux / macOS

```bash
chmod +x run.sh
./run.sh
```

Default port:

```text
http://localhost:8080
```

Run on a custom port:

```bash
./run.sh 9090
```

---

## Windows

```cmd
run.bat
```

Custom port:

```cmd
run.bat 9090
```

Then open your browser:

```text
http://localhost:8080
```

---

## Manual Build

If you prefer not to use the helper scripts:

```bash
cd backend

javac -d out src/main/java/ak/base/*.java

java -cp out ak.base.Server 8080
```

---

# API

The backend exposes three simple JSON endpoints consumed by the frontend.

| Method | Endpoint         | Description                                                            |
| ------ | ---------------- | ---------------------------------------------------------------------- |
| GET    | `/api/operators` | Returns the complete operator database.                                |
| GET    | `/api/combos`    | Returns all RIIC combination definitions.                              |
| POST   | `/api/analyze`   | Analyzes a roster and returns RIIC recommendations and ROI estimation. |

Example request:

```json
{
  "roster": [
    {
      "name": "Texas",
      "elite": 2,
      "level": 60,
      "skill": "S2M3"
    },
    {
      "name": "Vermeil",
      "elite": 1,
      "level": 50
    }
  ]
}
```

---

# Adding New Operators

To add a new operator, edit:

```text
backend/data/operators.json
```

Append a new object to the `operators` array.

```json
{
  "name": "Ten Operator",
  "rarity": 5,
  "profession": "Guard",
  "skills": [
    {
      "id": "ten_s2",
      "name": "Ten Skill Base",
      "room": "TradingPost",
      "elite_required": 2,
      "level_required": 1,
      "skill_slot": 2,
      "module_required": null,
      "effect": "Skill description",
      "value_pct": 30,
      "combo_tags": [
        "ten_combo_tag"
      ]
    }
  ]
}
```

If the operator belongs to a new RIIC combination, create a corresponding entry in:

```text
backend/data/combos.json
```

using the same tag defined in `combo_tags`.

No recompilation is required. The server loads the JSON files each time it starts. Simply restart the server after modifying the data.

---

# Publishing to GitHub

The repository has already been initialized locally.

To publish it to GitHub:

```bash
git remote add origin https://github.com/<username>/<repository>.git

git branch -M main

git push -u origin main
```

---

# Roadmap

Planned improvements include:

* Complete operator database covering every RIIC base skill.
* Accurate Elite promotion costs for every operator.
* Daily productivity estimation (LMD, EXP, Gold, etc.) instead of upgrade-cost estimation alone.
* Import and export roster as JSON files.
* Side-by-side comparison of multiple upgrade plans.
* Automatic roster synchronization from a player account.
* Advanced RIIC optimization with long-term ROI calculations.
