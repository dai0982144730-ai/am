# YÊU CẦU BỔ SUNG — XÂY "CỔNG API TRỢ LÝ" CHO HỆ THỐNG 3 TRANG
## Chuẩn bị từ bây giờ để app Android ghép vào không phải sửa lại

> Tài liệu gốc do chủ dự án cung cấp ngày 2026-08-14, lưu nguyên văn tại đây để
> mọi phiên Claude Code sau này (ở `am`, `tiendo`, `phaply`, hoặc phiên viết app
> Android) đều đọc được cùng một bản — xem ghi chú áp dụng riêng cho `am` trong
> `docs/plan.md` mục "Cổng API trợ lý".

---

## 1. BỐI CẢNH — ĐỌC KỸ TRƯỚC KHI CODE

Hệ thống của tôi gồm **ba trang web riêng biệt**, mỗi trang có kho dữ liệu riêng và có trợ lý AI riêng bên trong:

| Trang | Nội dung | Vai trò |
|---|---|---|
| **am.scigroup.vn** | Tổng hợp YouTube, blog về AI, triết học, âm nhạc... | Kiến thức, giải trí cá nhân |
| **tiendo.scigroup.vn** | Quản lý tiến độ các dự án | Công việc — điều hành |
| **phaply.scigroup.vn** | Văn bản pháp luật, hồ sơ pháp lý công ty | Công việc — pháp chế |

**Giai đoạn 2 (sau khi web xong):** xây một **ứng dụng Android (APK)** cài trên Xiaomi 14 Ultra, đăng ký làm **Trợ lý kỹ thuật số mặc định** (gọi ra bằng cách giữ nút nguồn), nhận diện giọng nói tiếng Việt và đọc câu trả lời bằng giọng tiếng Việt, dùng **Claude API**.

App đó phải hỏi được **cả ba trang**, và **tự biết** câu hỏi nào thì hỏi trang nào. Ví dụ:

- *"Dự án Hướng Việt đang chậm ở hạng mục nào?"* → tiendo
- *"Nghị định nào quy định về giấy phép xây dựng công trình điện gió?"* → phaply
- *"Tuần này có video nào hay về ý thức không?"* → am
- *"Tôi cần chuẩn bị gì cho cuộc họp tiến độ tuần sau, có vướng pháp lý gì không?"* → hỏi **cả** tiendo **và** phaply rồi tổng hợp

**Vì vậy: đừng chỉ code chức năng web. Hãy code theo cách để app điện thoại sau này cắm vào là chạy, không phải đập đi làm lại.**

---

## 2. NGUYÊN TẮC KIẾN TRÚC BAO TRÙM

### 2.1. Ba trang, MỘT chuẩn giao tiếp chung

Đây là điểm quan trọng nhất của toàn bộ tài liệu này.

Ba trang có dữ liệu hoàn toàn khác nhau (video/bài viết — tiến độ dự án — văn bản luật). Nhưng đối với app điện thoại, chúng phải trông **giống hệt nhau**: cùng đường dẫn API, cùng cách xác thực, cùng cấu trúc câu trả lời.

Nếu mỗi trang tự nghĩ ra một kiểu API riêng, app điện thoại sẽ phải viết ba đoạn code xử lý khác nhau, và mỗi lần sửa một trang là phải cài lại app. Nếu ba trang cùng một chuẩn, app chỉ cần một đoạn code duy nhất, chạy vòng lặp qua ba địa chỉ.

**Cách hình dung**: giống như ba nhà kho khác nhau về hàng hoá bên trong, nhưng cửa, ổ khoá, và mẫu phiếu xuất kho thì làm giống hệt nhau — người đến lấy hàng chỉ cần học một lần.

### 2.2. API-first

Mọi chức năng đọc dữ liệu và mọi chức năng AI phải nằm ở tầng dùng chung. Giao diện web chỉ là **một** người tiêu thụ; app điện thoại là người thứ hai.

Cấu trúc mong muốn **ở cả ba trang**:

```
lib/nghiepVu/          <- logic thuần, không biết gì về web hay điện thoại
app/api/v1/tro-ly/...  <- lớp vỏ HTTP: nhận request -> gọi lib -> trả JSON
app/(web)/...          <- giao diện web, gọi vào lib/nghiepVu
```

### 2.3. Quy ước đặt tên

Giữ quy ước đang dùng ở trang pháp lý: **tên biến, tên hàm bằng tiếng Việt không dấu, camelCase** (`timKiemNoiDung`, `xacThucTokenTroLy`). Đường dẫn API và tên trường JSON cũng dùng tiếng Việt không dấu.

Áp dụng thống nhất cho cả ba trang.

---

## 3. CHUẨN API CHUNG — BA TRANG ĐỀU PHẢI CÓ ĐỦ

Tất cả đặt dưới `/api/v1/tro-ly/`. Đánh số `v1` ngay từ đầu để sau này nâng cấp không làm hỏng app đã cài.

### 3.1. `GET /suc-khoe` *(bắt buộc — cả 3 trang)*
Trả về: tên trang, phiên bản API, trạng thái cơ sở dữ liệu, số bản ghi, thời gian phản hồi. App dùng để báo "trang tiến độ đang mất kết nối" một cách rõ ràng thay vì treo im.

### 3.2. `GET /cong-cu` *(bắt buộc — cả 3 trang)* ⭐ QUAN TRỌNG NHẤT

Endpoint **tự mô tả chính nó**: trả về danh sách các công cụ mà trang này cung cấp, viết đúng định dạng `tools` của Claude API — gồm tên công cụ, mô tả bằng tiếng Việt, và JSON schema của tham số.

Cách hoạt động khi có app điện thoại:
1. App khởi động → gọi `/cong-cu` của cả ba trang → gom lại thành một danh sách chung
2. Đưa toàn bộ danh sách đó cho Claude API kèm câu hỏi của tôi
3. Claude tự đọc mô tả, tự chọn công cụ của trang nào phù hợp, tự gọi
4. App nhận kết quả, đưa lại cho Claude tổng hợp thành câu trả lời

**Hệ quả: sau này thêm chức năng mới ở bất kỳ trang nào, app điện thoại tự động biết mà không cần cập nhật app.** Đây là lý do phải làm endpoint này ngay từ đầu, đừng bỏ.

Mô tả công cụ phải viết **rõ và phân biệt được**, vì Claude chọn dựa vào chính lời mô tả này. Ví dụ:
- am: *"Tìm video YouTube và bài blog về AI, triết học, âm nhạc đã được lưu trong kho kiến thức cá nhân"*
- tiendo: *"Tra cứu tiến độ, mốc thời gian, hạng mục chậm và khối lượng thực hiện của các dự án đang triển khai"*
- phaply: *"Tra cứu văn bản pháp luật Việt Nam và hồ sơ pháp lý nội bộ của công ty"*

### 3.3. `POST /tim-kiem` *(bắt buộc — cả 3 trang)*
Tìm dữ liệu thô. Tham số đầu vào khác nhau tuỳ trang, nhưng **khung câu trả lời phải giống nhau**:

```json
{
  "ketQua": [
    {
      "id": "...",
      "tieuDe": "...",
      "loai": "video | baiViet | duAn | vanBanLuat | hoSo",
      "tomTat": "...",
      "ngay": "2026-08-10",
      "duongDan": "https://...",
      "doLienQuan": 0.87,
      "duLieuRieng": { }
    }
  ],
  "tongSo": 24
}
```

Trường `duLieuRieng` là chỗ mỗi trang nhét thêm thông tin đặc thù của mình (ví dụ tiendo bỏ vào `phanTramHoanThanh`, `hanChot`; phaply bỏ vào `soHieuVanBan`, `conHieuLuc`). Nhờ vậy khung ngoài vẫn thống nhất mà không mất thông tin riêng.

Phải hỗ trợ tham số `kemNoiDung: true` để trả về cả nội dung đầy đủ — trợ lý cần đọc nội dung thật để trả lời chính xác, không đoán.

### 3.4. `GET /noi-dung/{id}` *(bắt buộc — cả 3 trang)*
Lấy toàn văn một mục.

### 3.5. `POST /hoi` *(bắt buộc — cả 3 trang)*
Hỏi trợ lý AI có sẵn của chính trang đó.

Đầu ra — **điểm mấu chốt, đọc kỹ**:
```json
{
  "traLoiNgan": "Dự án Hướng Việt đang chậm hai tuần ở phần móng trụ...",
  "traLoiDay": "## Tình hình dự án Hướng Việt\n\n- ...",
  "nguonThamKhao": [ { "id": "...", "tieuDe": "...", "duongDan": "..." } ],
  "trang": "tiendo"
}
```

- `traLoiDay`: bản đầy đủ, có markdown, bảng, link — để hiển thị trên màn hình.
- `traLoiNgan`: bản rút gọn **để đọc thành tiếng**, tối đa 3–4 câu, **không markdown, không URL, không ký hiệu đặc biệt**, viết như lời nói tự nhiên.

Lý do: nghe máy đọc một bảng tiến độ dài 400 chữ là trải nghiệm rất tệ. Nghe 3 câu tóm ý rồi nhìn màn hình xem chi tiết mới dùng được.

Bắt buộc sinh cả hai khi tham số `cheDoGiongNoi: true`.

### 3.6. Endpoint riêng của từng trang

Ngoài 5 cái chung ở trên, mỗi trang thêm một endpoint "hỏi nhanh thứ hay dùng nhất":

- **am**: `GET /tom-tat-hom-nay` — nội dung mới thu thập, nhóm theo chủ đề, kèm sẵn `traLoiNgan`.
- **tiendo**: `GET /canh-bao` — các dự án/hạng mục **đang chậm hoặc sắp đến hạn**, kèm sẵn `traLoiNgan`. Đây sẽ là câu lệnh dùng nhiều nhất trên điện thoại.
- **phaply**: `GET /van-ban-moi` — văn bản pháp luật mới cập nhật hoặc mới hết hiệu lực, liên quan lĩnh vực của công ty.

---

## 4. XÁC THỰC VÀ BẢO MẬT

**Tuyệt đối không để Claude API key hay khoá bí mật nào trong app điện thoại.** File APK có thể bị mổ ra xem trong vài phút. Mọi lời gọi Claude API đều thực hiện ở phía máy chủ.

Cần làm **giống hệt nhau ở cả ba trang**:

1. Toàn bộ `/api/v1/tro-ly/*` yêu cầu header `Authorization: Bearer <token>`.
2. Token lưu trong biến môi trường `TOKEN_TRO_LY`. Cho phép nhiều token cách nhau dấu phẩy — mỗi thiết bị một token, lộ cái nào thu hồi cái đó.
3. Viết middleware `xacThucTokenTroLy` — **viết một lần, dùng chung cho cả ba trang** (xem mục 6 về gói dùng chung).
4. Giới hạn tần suất gọi theo token, tránh app lỗi vòng lặp làm cháy hoá đơn API.
5. Ghi log mọi lượt gọi: thời điểm, token, endpoint, số token AI tiêu thụ. Sau này cần để biết chi phí đến từ trang nào.

**Lưu ý riêng cho tiendo và phaply**: hai trang này chứa dữ liệu nội bộ công ty. Cân nhắc thêm giới hạn theo địa chỉ IP hoặc yêu cầu token riêng biệt, chặt hơn so với trang am.

---

## 5. YÊU CẦU RIÊNG PHỤC VỤ GIỌNG NÓI TIẾNG VIỆT

Làm ngay bây giờ thì rẻ; để đến lúc làm app mới sửa thì phải đụng vào rất nhiều chỗ.

1. **Hàm `chuanHoaDeDoc(vanBan)`** — dùng chung cả ba trang, xử lý:
   - Bỏ ký hiệu markdown (`**`, `#`, `-`, bảng, `[]()`).
   - Thay URL bằng cụm "xem đường dẫn trên màn hình".
   - Đọc đúng từ viết tắt: "LLM" → "eo eo em", "AI" → "ây ai", "EPC" → "e pê xê", "GPMB" → "giải phóng mặt bằng"...
   - **Đặc biệt quan trọng với phaply**: số hiệu văn bản kiểu `15/2021/NĐ-CP` phải đọc thành "mười lăm trên hai nghìn không trăm hai mươi mốt, Nờ Đờ, Xê Pê", không đọc thành chuỗi ký tự lộn xộn.
   - **Đặc biệt quan trọng với tiendo**: phần trăm, ngày tháng, số ngày chậm phải đọc tự nhiên ("chậm mười hai ngày", không phải "chậm 12 d").
   - Để danh sách từ viết tắt trong file cấu hình riêng, dễ bổ sung dần.

2. **Mọi endpoint sinh văn bản đều đi qua hàm này** trước khi điền `traLoiNgan`.

3. **Trần độ dài `traLoiNgan`**: khoảng 400 ký tự. Ghi rõ yêu cầu này **trong prompt gửi Claude**, đừng chỉ cắt bằng code.

4. **Chừa đường cho giọng nói cao cấp**: thiết kế sao cho sau này có thể thêm `POST /doc-thanh-tieng` trả về file âm thanh, phòng khi giọng đọc mặc định của Android không đạt. Chưa làm ngay, nhưng đừng thiết kế theo cách chặn đường này.

---

## 6. GÓI DÙNG CHUNG CHO BA TRANG

Vì ba trang phải giống hệt nhau ở tầng API, đừng chép code ba lần — sửa một chỗ quên hai chỗ là chuyện chắc chắn sẽ xảy ra.

Đề xuất: tạo một thư mục/gói dùng chung (`packages/tro-ly-chung/` nếu gộp monorepo, hoặc một package npm nội bộ, hoặc đơn giản nhất là một thư mục được đồng bộ giữa ba repo) chứa:

- Định nghĩa kiểu dữ liệu (TypeScript types) của toàn bộ khung câu trả lời chuẩn
- `xacThucTokenTroLy` — middleware xác thực
- `chuanHoaDeDoc` — chuẩn hoá văn bản để đọc
- Bộ khung xử lý lỗi và định dạng lỗi thống nhất
- Hàm dựng cấu trúc `/cong-cu` theo đúng định dạng Claude API

**Hãy tự đề xuất cách làm phù hợp nhất với tình trạng hiện tại của ba repo, và giải thích cho tôi vì sao chọn cách đó** — tôi không rành phần này, cần bạn tư vấn chứ đừng hỏi tôi chọn.

---

## 7. TÀI LIỆU HOÁ — BẮT BUỘC

Tạo file **`docs/API-TRO-LY.md`** ở **mỗi trang**, cộng thêm **một file tổng** mô tả toàn hệ thống ba trang.

Nội dung cần có:
- Từng endpoint: đường dẫn, phương thức, đầu vào, đầu ra, ví dụ thật
- Cách lấy và dùng token
- Địa chỉ máy chủ thật khi triển khai
- Toàn bộ danh sách công cụ (mục 3.2) của cả ba trang, gộp lại một chỗ
- Mục **"Ghi chú cho phiên làm app Android"** — những gì người viết app cần biết

**Lý do phải làm nghiêm túc**: khi tôi mở phiên Claude Code mới để viết app APK, phiên đó **không biết gì** về những gì đã làm ở đây. File này là cầu nối duy nhất giữa hai giai đoạn. Thiếu nó, giai đoạn 2 phải mò lại từ đầu API mà chính tôi vừa xây.

Kèm theo `docs/vi-du-goi-api.http` (hoặc script curl) để test nhanh mọi endpoint của cả ba trang.

---

## 8. NHỮNG GÌ **KHÔNG** LÀM TRONG GIAI ĐOẠN NÀY

- **Không** viết dòng code Android nào. Giai đoạn này chỉ làm web + API.
- **Không** làm API ghi/sửa dữ liệu ở v1 — kể cả với tiendo (cập nhật tiến độ bằng giọng nói nghe rất hấp dẫn nhưng để sau). **Chỉ đọc.** Lý do: nhận diện giọng nói tiếng Việt còn sai, để nó sửa dữ liệu dự án thật là rủi ro không đáng có ở bước đầu.
- **Không** xây hệ thống đăng nhập người dùng phức tạp cho API. Hệ thống cá nhân, token tĩnh là đủ.
- **Không** làm streaming (trả lời nhỏ giọt) ở v1.
- **Không** tối ưu sớm hay thêm cache phức tạp — nhưng **có** đo và ghi lại thời gian phản hồi mỗi endpoint.

---

## 9. TIÊU CHÍ NGHIỆM THU

Coi như xong khi tôi có thể, **từ một máy khác, chỉ dùng curl và token**, làm được tất cả những việc sau mà không mở trình duyệt:

1. Kiểm tra sức khoẻ **cả ba** trang.
2. Lấy được danh sách công cụ của cả ba trang, đúng định dạng Claude API, gộp lại không bị trùng tên.
3. Tìm kiếm ở mỗi trang, nhận về **cùng một khung JSON** dù dữ liệu khác nhau.
4. Lấy toàn văn một mục ở mỗi trang.
5. Hỏi một câu ở mỗi trang, nhận **cả hai** dạng `traLoiNgan` và `traLoiDay`; đọc `traLoiNgan` lên nghe tự nhiên, không lẫn ký hiệu.
6. Gọi được ba endpoint riêng: `tom-tat-hom-nay`, `canh-bao`, `van-ban-moi`.
7. Gọi mà không có token thì bị từ chối ở **cả ba** trang.

Khi đủ 7 mục, giai đoạn 2 chỉ còn là viết phần vỏ trên điện thoại.

---

## 10. VIỆC ĐẦU TIÊN — TRẢ LỜI TÔI TRƯỚC KHI CODE

Hãy khảo sát cả ba dự án và trả lời:

1. Ba trang hiện đang ở mức độ hoàn thiện nào? Trang nào đã sẵn sàng làm API, trang nào còn dở?
2. Logic truy vấn dữ liệu ở mỗi trang đang nằm ở đâu — tách ra `lib/nghiepVu/` được không, hay phải tái cấu trúc nhiều?
3. LLM trong mỗi trang đang được gọi ở tầng nào? Ba trang có gọi giống nhau không?
4. Đề xuất cách tổ chức gói dùng chung ở mục 6, kèm lý do.
5. Đề xuất **thứ tự thực hiện**: nên làm trang nào trước? (Gợi ý của tôi: làm xong hoàn chỉnh **một** trang làm mẫu, chốt chuẩn, rồi mới nhân bản sang hai trang còn lại — nhưng bạn cứ phản biện nếu thấy có cách tốt hơn.)

Sau khi thống nhất, cập nhật `docs/PROGRESS.md` của từng trang, thêm hạng mục "Cổng API trợ lý", rồi bắt đầu.
