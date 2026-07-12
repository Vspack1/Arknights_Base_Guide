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

1. **Database operator (`backend/data/operators.json`) được auto-generate từ data thật của game**
   (xem `backend/tools/generate_operators.py`), nguồn: [Dimbreath/ArknightsData](https://github.com/Dimbreath/ArknightsData)
   (en-US). Repo nguồn này **đã archived (ngừng cập nhật)**, nên:
   - 192 operator có base skill tính đến thời điểm archive đã có đầy đủ, chính xác (tên, rarity,
     profession, mô tả skill, room, elite yêu cầu — copy nguyên văn từ game, không phải suy đoán).
   - **Operator phát hành SAU thời điểm archive sẽ KHÔNG có trong database** (ví dụ: Proviso,
     Tequila, Quartz, Pudding — các combo nổi tiếng cộng đồng hay nhắc nhưng chưa có data ở đây).
     Nếu bạn sở hữu các operator này, cần tự thêm thủ công theo schema (xem phần dưới).
2. **`combo_tags`** (đánh dấu operator nào thuộc combo nổi tiếng nào) là **gán thủ công**, chỉ có ở
   17 operator đã được đối chiếu kỹ với mô tả effect thật (Texas, Vermeil, Bibeak, Gravel, Shamare,
   Scene, Bubble, Purestream, Waai Fu, Jaye, Kafka, Podenco, Lancet-2, Castle-3, Orchid). Phần lớn
   192 operator còn lại có đầy đủ data skill nhưng `combo_tags: []` — vẫn hiển thị được trong
   `/api/operators` nhưng chưa được xếp vào combo nào trong `combos.json`.
3. **Chi phí LMD nâng elite chỉ là ước tính trung bình theo rarity** (`Analyzer.java`), KHÔNG tính
   Chip, EXP, hay vật liệu chuyên biệt — vì bộ dữ liệu chi phí chính xác theo từng operator quá lớn
   để nhồi vào bản seed này. Luôn kiểm tra chi phí thật trong game trước khi quyết định nâng cấp lớn.
4. Một số combo (ví dụ Texas + Lappland) yêu cầu **2 operator cụ thể đứng cùng phòng** — app hiện
   chỉ track theo operator có `combo_tags` (Texas), KHÔNG kiểm tra bạn có sở hữu Lappland hay chưa.
   Đọc kỹ phần `notes` của mỗi combo trong kết quả phân tích.
5. Trước khi dùng kết quả để ra quyết định đầu tư tài nguyên thật, hãy đối chiếu với
   [PRTS.wiki](https://prts.wiki) hoặc GamePress.

👉 Project được thiết kế để **dễ mở rộng** — xem phần "Thêm operator mới" bên dưới, hoặc chạy lại
`backend/tools/generate_operators.py` nếu tìm được nguồn data đang active hơn.

## Cấu trúc project

```
ak-base-optimizer/
├── backend/
│   ├── src/main/java/ak/base/
│   │   ├── Json.java        # JSON parser/serializer viết tay (không cần internet để build)
│   │   ├── DataStore.java   # Load operators.json + combos.json
│   │   ├── Analyzer.java    # Logic match combo, ước tính ROI, xếp priority
│   │   └── Server.java      # HTTP server (com.sun.net.httpserver), phục vụ API + static frontend
│   ├── data/
│   │   ├── operators.json   # Database operator base skill (192 operator, auto-generated)
│   │   └── combos.json      # Định nghĩa các combo (map theo combo_tags)
│   └── tools/
│       └── generate_operators.py  # Script fetch + generate operators.json từ data thật
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
