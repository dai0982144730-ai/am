-- Đánh dấu tác giả chủ nhà đã xem và bác, thay vì xoá bản ghi.
-- Xoá thì lượt phân loại sau rút lại đúng cái tên đó và dựng lại y nguyên.
ALTER TABLE "Author"
  ADD COLUMN "biTuChoi" BOOLEAN NOT NULL DEFAULT false;
