-- Tủ sách: theo dõi một tác giả xuyên nhiều kênh.
--
-- TÁCH HẲN KHỎI `approvedByUser`, dù nghe qua thì giống nhau:
--
--   approvedByUser — "tôi công nhận đây đúng là một tác giả có thật".
--     Ảnh hưởng tới điểm uy tín trong công thức chấm chất lượng.
--   theoDoi        — "tôi muốn biết khi người này có nội dung mới".
--     Chỉ ảnh hưởng tới Tủ sách.
--
-- Gộp làm một thì không diễn đạt được trường hợp thường gặp nhất: công nhận
-- một tác giả là có thật nhưng không muốn theo dõi họ.

ALTER TABLE "Author" ADD COLUMN "theoDoi" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Author_theoDoi_idx" ON "Author"("theoDoi");
