# Cổng API trợ lý — trang `am`

> Tài liệu này là **cầu nối giữa hai giai đoạn**. Khi mở một phiên Claude Code
> mới để viết app Android, phiên đó không biết gì về những gì đã làm ở đây —
> file này là thứ duy nhất nó đọc được. Xem mục cuối: "Ghi chú cho phiên làm app
> Android".

Yêu cầu gốc: `docs/yeu-cau-cong-api-tro-ly.md`
Quyết định áp dụng cho `am`: `docs/plan.md`, mục "Cổng API trợ lý"

---

## Tóm tắt trong một đoạn

Trang `am` mở ra sáu endpoint dưới `/api/v1/tro-ly/`. Năm cái đầu là chuẩn chung
mà cả ba trang (`am`, `tiendo`, `phaply`) đều phải có, cái thứ sáu là riêng của
`am`. Mọi endpoint đều cần header `Authorization: Bearer <token>`. Câu trả lời
luôn theo một khung JSON cố định, tên trường bằng tiếng Việt không dấu.

---

## Địa chỉ máy chủ

| Môi trường | Địa chỉ |
|---|---|
| Chạy trên máy | `http://localhost:3000` |
| Triển khai thật | `https://am.scigroup.vn` *(chưa triển khai)* |

---

## Token — cách lấy và cách dùng

Token nằm trong biến môi trường `TOKEN_TRO_LY` ở file `.env`. Nhiều token cách
nhau dấu phẩy, **mỗi thiết bị một token** để lộ cái nào thu hồi cái đó.

Sinh một token mới:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Rồi thêm vào `.env`:

```
TOKEN_TRO_LY="token_dien_thoai,token_may_tinh"
```

Dùng trong mọi lời gọi:

```
Authorization: Bearer token_dien_thoai
```

**Giới hạn tần suất**: 60 lần gọi mỗi phút cho mỗi token. Vượt thì trả `429` với
mã lỗi `goi_qua_nhieu`. Bộ đếm nằm trong bộ nhớ máy chủ nên khởi động lại là
reset — đủ để chặn app lỗi vòng lặp làm cháy hoá đơn Claude, không phải để chống
tấn công.

---

## Khung câu trả lời chuẩn

### Danh sách kết quả

```json
{
  "ketQua": [
    {
      "id": "clx1a2b3c...",
      "tieuDe": "Bàn về ý thức và trải nghiệm chủ quan",
      "loai": "video",
      "tomTat": "Buổi vấn đáp về...",
      "ngay": "2026-08-10",
      "duongDan": "https://youtube.com/watch?v=...",
      "doLienQuan": 0.87,
      "duLieuRieng": {
        "chuyenMuc": "triet_hoc",
        "loaiGoc": "video",
        "nguon": "Tên kênh",
        "thoiLuongGiay": 3600,
        "luotXem": 12000,
        "diemChatLuong": 8.7,
        "truongPhaiTriet": "phat_giao_nguyen_thuy"
      }
    }
  ],
  "tongSo": 24
}
```

`loai` nhận một trong: `video`, `baiViet`, `duAn`, `vanBanLuat`, `hoSo`. Trang
`am` chỉ sinh ra hai loại đầu — ba loại còn lại thuộc `tiendo` và `phaply`,
liệt kê đủ ở đây để app điện thoại chỉ phải học một danh sách.

`duLieuRieng` là chỗ mỗi trang nhét thông tin đặc thù. Khung ngoài giống hệt
nhau giữa ba trang, thông tin riêng không mất.

### Lỗi

```json
{ "loi": { "ma": "token_sai", "thongDiep": "Token không hợp lệ." } }
```

| Mã lỗi | HTTP | Nghĩa |
|---|---|---|
| `thieu_token` | 401 | Không có header Authorization |
| `token_sai` | 401 | Token không nằm trong danh sách |
| `goi_qua_nhieu` | 429 | Vượt 60 lần/phút |
| `tham_so_sai` | 400 | Thiếu hoặc sai tham số đầu vào |
| `khong_tim_thay` | 404 | Không có mục với id đó |
| `loi_he_thong` | 500 | Lỗi phía máy chủ |

---

## Các endpoint

### 1. `GET /api/v1/tro-ly/suc-khoe`

Kiểm tra trang có sống không. Dùng để app báo "trang này đang mất kết nối" một
cách rõ ràng thay vì treo im.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/tro-ly/suc-khoe
```

```json
{
  "trang": "am",
  "phienBanApi": "v1",
  "database": "ok",
  "soBanGhi": { "noiDung": 0, "nguon": 0, "banTin": 0 },
  "thoiGianPhanHoiMs": 42
}
```

Khi database hỏng, `database` là `"loi"` và có thêm trường `loi` mô tả nguyên
nhân — endpoint này **vẫn trả 200**, vì "trang không khoẻ, vì lý do này" cũng là
một câu trả lời hợp lệ.

---

### 2. `GET /api/v1/tro-ly/cong-cu` ⭐ quan trọng nhất

Trả về danh sách công cụ mà trang này cung cấp, viết đúng định dạng `tools` của
Claude API.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/tro-ly/cong-cu
```

```json
{
  "trang": "am",
  "phienBanApi": "v1",
  "congCu": [
    {
      "name": "am_timKiem",
      "description": "Tìm video YouTube, bài blog... trong kho kiến thức cá nhân...",
      "input_schema": { "type": "object", "properties": { }, "required": ["tuKhoa"] }
    }
  ]
}
```

**Vì sao endpoint này quan trọng nhất**: app Android gọi `/cong-cu` của cả ba
trang lúc khởi động, gom thành một danh sách, đưa cho Claude kèm câu hỏi. Claude
tự đọc mô tả và tự chọn gọi công cụ của trang nào. Hệ quả: **thêm chức năng mới
ở bất kỳ trang nào, app tự biết, không phải cài lại app**.

**Quy ước bắt buộc — tên công cụ phải khác nhau giữa ba trang.** App gom cả ba
danh sách vào một, trùng tên là Claude không biết gọi cái nào. Nên mọi tên đều
mở đầu bằng tên trang:

```
am_timKiem        tiendo_timKiem        phaply_timKiem
am_layNoiDung     tiendo_layNoiDung     phaply_layNoiDung
am_hoi            tiendo_hoi            phaply_hoi
am_tomTatHomNay   tiendo_canhBao        phaply_vanBanMoi
```

---

### 3. `POST /api/v1/tro-ly/tim-kiem`

Tìm dữ liệu thô.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tuKhoa":"ý thức","chuyenMuc":"triet_hoc","soLuong":5}' \
  http://localhost:3000/api/v1/tro-ly/tim-kiem
```

| Tham số | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `tuKhoa` | string | ✅ | Nội dung cần tìm |
| `chuyenMuc` | string | | `ai` · `triet_hoc` · `truyen` · `music` · `new_search` · `other` |
| `tuNgay` | string | | Chỉ lấy từ ngày này, dạng `yyyy-mm-dd` |
| `soLuong` | int | | Mặc định 10, tối đa 50 |
| `kemNoiDung` | bool | | `true` để lấy cả lời thoại / toàn văn |

Trả về khung `{ ketQua, tongSo }` ở trên. Với `kemNoiDung: true`, mỗi mục có
thêm trường `noiDung`.

**Cách xếp hạng**: điểm chất lượng (`compositeScore`) cao lên trước, chưa chấm
điểm thì xét theo độ mới. Nội dung chưa chấm điểm nhận `doLienQuan = 0.5` chứ
không phải 0 — chưa chấm không có nghĩa là dở.

---

### 4. `GET /api/v1/tro-ly/noi-dung/{id}`

Lấy toàn văn một mục.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/tro-ly/noi-dung/clx1a2b3c
```

Trả về một `MucKetQua` duy nhất, luôn kèm `noiDung` nếu có. Ưu tiên bản thuật
lại tiếng Việt (với bài blog nước ngoài), không thì lấy lời thoại gốc. Nhạc thì
không có `noiDung` — đúng nguyên tắc "Music đi nhánh riêng, không transcript".

Không có id đó → `404` + mã `khong_tim_thay`.

---

### 5. `POST /api/v1/tro-ly/hoi`

Hỏi trợ lý AI của chính trang này. Đây là endpoint duy nhất gọi Claude API.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cauHoi":"Tuần này có video nào hay về ý thức không?","cheDoGiongNoi":true}' \
  http://localhost:3000/api/v1/tro-ly/hoi
```

```json
{
  "traLoiNgan": "Trong kho có ba video về ý thức tuần này. Đáng chú ý nhất là buổi vấn đáp dài một tiếng về trải nghiệm chủ quan. Xem chi tiết trên màn hình.",
  "traLoiDay": "## Video về ý thức tuần này\n\n- **Bàn về ý thức...**\n  https://...",
  "nguonThamKhao": [
    { "id": "clx1a2b3c", "tieuDe": "Bàn về ý thức...", "duongDan": "https://..." }
  ],
  "trang": "am"
}
```

**Hai bản trả lời — đây là điểm mấu chốt của cả thiết kế:**

- `traLoiDay` — đầy đủ, có markdown, bảng, link. Để **hiện lên màn hình**.
- `traLoiNgan` — tối đa 3–4 câu, khoảng 400 ký tự, **không markdown, không URL,
  không ký hiệu**. Để **đọc thành tiếng**.

Nghe máy đọc một bảng dài 400 chữ là trải nghiệm rất tệ. Nghe ba câu tóm ý rồi
nhìn màn hình xem chi tiết mới dùng được.

Trần độ dài được ghi **trong prompt gửi Claude**, không chỉ cắt bằng code — cắt
bằng code sẽ chặt đứt giữa câu. Hàm `chuanHoaDeDoc` chạy sau đó chỉ là lưới an
toàn cuối cùng, và nó cắt ở ranh giới câu.

Model dùng: `claude-opus-5`. Kho rỗng thì trả lời thẳng, không tốn một lượt gọi
Claude chỉ để nói "không có gì".

---

### 6. `GET /api/v1/tro-ly/tom-tat-hom-nay` *(riêng của `am`)*

Bản tin nội dung mới, nhóm theo chủ đề, kèm sẵn `traLoiNgan`.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/tro-ly/tom-tat-hom-nay?soNgay=3"
```

```json
{
  "trang": "am",
  "tuNgay": "2026-08-11",
  "tongSo": 12,
  "nhom": [
    { "chuyenMuc": "ai", "tenHienThi": "AI", "soLuong": 7, "noiDung": [ ] }
  ],
  "traLoiNgan": "Trong ba ngày qua có mười hai nội dung mới: bảy mục ây ai, ba mục triết học...",
  "traLoiDay": "## Nội dung mới trong 3 ngày qua\n\n### AI (7)\n\n- ...",
  "tuBanTinDaSoan": false
}
```

`soNgay` mặc định 1, tối đa 30.

`tuBanTinDaSoan` cho biết dữ liệu đến từ đâu: `true` = bản tin Claude đã chắt lọc
từ lần quét tối qua (`AssistantBriefing`), `false` = tự gom nội dung mới nhất.
Nhờ đường thứ hai mà endpoint này **dùng được ngay bây giờ**, không phải chờ
Phase 10 làm xong.

---

## Cấu trúc code

```
src/lib/troLyChung/     ← Bộ dùng chung, CHÉP NGUYÊN sang tiendo/phaply
  kieuDuLieu.ts           Khung câu trả lời chuẩn — hợp đồng với app Android
  xacThucTokenTroLy.ts    Kiểm tra Bearer token, giới hạn tần suất
  phanHoi.ts              Vỏ chung: xác thực → đo giờ → bắt lỗi → ghi nhật ký
  chuanHoaDeDoc.ts        Bỏ markdown, thay URL, đọc viết tắt và số thành lời
  vietTat.ts              Bảng viết tắt (mỗi trang một bảng riêng)
  docSo.ts                Đọc số thành chữ tiếng Việt

src/lib/nghiepVu/       ← Riêng của am, không biết gì về HTTP
  timKiemNoiDung.ts       Lớp dịch: ContentItem tiếng Anh → JSON tiếng Việt
  congCu.ts               Định nghĩa 4 công cụ của am
  sucKhoe.ts              Đếm bản ghi, kiểm tra database
  hoiTroLy.ts             Gọi Claude API, sinh hai bản trả lời
  tomTatHomNay.ts         Gom nội dung mới theo chuyên mục
  ghiNhatKy.ts            Ghi vào bảng AssistantApiLog

src/app/api/v1/tro-ly/  ← Vỏ HTTP mỏng, chỉ đọc tham số rồi gọi nghiệp vụ
```

**Vì sao chia ba tầng như vậy**: giao diện web và app điện thoại đều gọi vào
`lib/nghiepVu/`. Nếu để logic trong route thì web phải gọi vòng qua HTTP của
chính nó — vừa chậm vừa vô lý.

### Một điểm lệch cố ý so với yêu cầu gốc

Yêu cầu gốc bắt **toàn bộ** tên biến, hàm, route, trường JSON dùng tiếng Việt
không dấu. Ở đây có một ngoại lệ: **tên bảng và tên cột trong database vẫn giữ
tiếng Anh**.

Lý do: 36 bảng đó đã chạy migration thật trên Neon từ Phase 0. Đổi tên chúng là
việc rủi ro cao, tốn công, mà không mang lại lợi ích gì — app Android không bao
giờ nhìn thấy tên cột trong Postgres, nó chỉ thấy JSON trả ra từ API. Quy ước
tiếng Việt áp dụng đầy đủ ở tầng mới viết: đường dẫn route, tên hàm trong
`lib/nghiepVu/`, và tên trường JSON. `timKiemNoiDung.ts` chính là lớp dịch giữa
hai thế giới.

Hệ quả duy nhất cần nhớ: bảng nhật ký mới cũng đặt tên tiếng Anh
(`AssistantApiLog`) cho nhất quán với 36 bảng kia.

---

## Cài đặt và chạy thử

```bash
# 1. Thêm token vào .env
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
# rồi dán vào TOKEN_TRO_LY trong .env

# 2. Tạo bảng nhật ký (migration đã viết sẵn, chỉ thêm bảng mới)
npx prisma migrate deploy

# 3. Chạy
npm run dev

# 4. Thử
curl -H "Authorization: Bearer <token của bạn>" \
  http://localhost:3000/api/v1/tro-ly/suc-khoe
```

⚠️ **Đừng chạy `prisma migrate dev`** cho migration này. Lệnh đó sẽ sinh thêm
hai dòng `DROP INDEX ..._vector_idx` xoá mất chỉ mục HNSW của pgvector. Migration
`20260814030000_them_nhat_ky_api_tro_ly` đã viết tay và chỉ thêm một bảng mới,
nên `migrate deploy` là an toàn tuyệt đối. Xem `CLAUDE.md`, mục "Cạm bẫy đã gặp".

Test nhanh mọi endpoint: `docs/vi-du-goi-api.http`

---

## Tiêu chí nghiệm thu — tình trạng hiện tại

Bảy mục trong yêu cầu gốc (mục 9), tính riêng cho trang `am`:

| # | Mục | `am` |
|---|---|---|
| 1 | Kiểm tra sức khoẻ | ✅ xong |
| 2 | Lấy danh sách công cụ đúng định dạng Claude API | ✅ xong |
| 3 | Tìm kiếm, nhận cùng một khung JSON | ✅ xong (kho còn rỗng nên trả mảng rỗng) |
| 4 | Lấy toàn văn một mục | ✅ xong |
| 5 | Hỏi một câu, nhận cả `traLoiNgan` và `traLoiDay` | ✅ xong (cần `ANTHROPIC_API_KEY`) |
| 6 | Endpoint riêng `tom-tat-hom-nay` | ✅ xong |
| 7 | Gọi không token thì bị từ chối | ✅ xong |

**Chưa kiểm chứng được bằng dữ liệu thật**: Phase 1 (quét YouTube) chưa chạy nên
kho còn rỗng. Cấu trúc câu trả lời đúng, nhưng `ketQua` sẽ là mảng rỗng cho tới
khi có nội dung được quét về.

Còn thiếu để đủ cả hệ thống ba trang: `tiendo` và `phaply` chưa có repo.

---

## Ghi chú cho phiên làm app Android

Phần này viết riêng cho phiên Claude Code sẽ viết app APK sau này.

### Kiến trúc app cần biết

App **không** gọi Claude API trực tiếp bằng khoá riêng của nó. Mọi lời gọi Claude
đều nằm ở phía máy chủ (endpoint `/hoi`). File APK có thể bị mổ ra xem trong vài
phút, nên trong app **tuyệt đối không có** khoá Claude API — chỉ có token trợ lý,
mà token đó lộ thì xoá khỏi `.env` là xong.

### Luồng chuẩn khi người dùng hỏi một câu

```
1. Lúc khởi động: gọi GET /cong-cu của cả ba trang
   → gom "congCu" của ba trang thành một mảng (tên đã khác nhau sẵn nhờ tiền tố)

2. Người dùng nói một câu → nhận diện giọng nói → chuỗi tiếng Việt

3. Gọi Claude API (khoá nằm ở đâu thì tuỳ kiến trúc app, xem lưu ý dưới)
   với tools = mảng gom ở bước 1, và câu hỏi của người dùng

4. Claude trả về tool_use → app gọi endpoint tương ứng của đúng trang
   (tên công cụ có tiền tố nên biết ngay gọi trang nào)

5. Đưa kết quả lại cho Claude → Claude tổng hợp thành câu trả lời

6. Đọc "traLoiNgan" thành tiếng, hiện "traLoiDay" lên màn hình
```

**Lưu ý về bước 3**: chỗ này cần một quyết định kiến trúc chưa chốt. Hai lựa chọn:

- App giữ khoá Claude → đơn giản nhưng khoá nằm trong APK, trái nguyên tắc trên.
- Dựng thêm một endpoint trung gian ở một trong ba trang để app gọi qua → an
  toàn hơn nhưng phải viết thêm.

Nên bàn với chủ dự án trước khi code phần này.

### Ba thứ đã chuẩn bị sẵn cho app

1. **`/cong-cu` tự mô tả** — thêm chức năng mới ở máy chủ, app tự biết, không
   phải cài lại app. Đừng hardcode danh sách công cụ vào app.
2. **`traLoiNgan` đã chuẩn hoá sẵn** — đưa thẳng cho TTS Android là đọc được,
   không còn markdown, URL hay viết tắt lạ. Đừng tự xử lý lại chuỗi này.
3. **`/suc-khoe`** — gọi lúc khởi động để biết trang nào đang chết, báo cho người
   dùng rõ ràng thay vì để app treo.

### Chừa đường cho giọng đọc cao cấp

Nếu giọng TTS mặc định của Android không đạt, có thể thêm
`POST /api/v1/tro-ly/doc-thanh-tieng` trả về file âm thanh. Thiết kế hiện tại
không chặn đường này: `traLoiNgan` đã là chuỗi sạch, chỉ cần đẩy qua dịch vụ TTS
và trả file về. **Chưa làm** — chỉ khi cần mới làm.

### Những gì cố ý KHÔNG có ở v1

- **Không có API ghi/sửa dữ liệu.** Chỉ đọc. Nhận diện giọng nói tiếng Việt còn
  sai nhiều, để nó sửa dữ liệu thật là rủi ro không đáng có ở bước đầu.
- **Không có streaming** (trả lời nhỏ giọt). Chờ trọn câu trả lời rồi đọc.
- **Không có đăng nhập người dùng.** Token tĩnh là đủ cho hệ thống một người.
