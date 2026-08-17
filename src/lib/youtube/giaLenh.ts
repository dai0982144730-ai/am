/**
 * Bảng giá các lệnh của YouTube Data API, tính bằng đơn vị hạn mức.
 *
 * Để riêng một file **không nạp gì cả** vì hai lý do: giao diện phía trình
 * duyệt cần đọc bảng giá để hiện chi phí cho người dùng, mà file `hanMuc.ts`
 * thì nạp prisma — kéo cả tầng database vào gói tải về của trình duyệt.
 *
 * Con số đáng nhớ: **tìm kiếm đắt gấp 100 lần mọi lệnh khác**. Cả ngày chỉ có
 * 10.000 đơn vị, nên một lần tìm ăn 1% ngân sách ngày, còn lấy chi tiết 50
 * video chỉ tốn 1 đơn vị. Mọi quyết định thiết kế quanh hạn mức đều bắt nguồn
 * từ chênh lệch này.
 */

export const GIA_LENH = {
  "search.list": 100,
  "videos.list": 1,
  "channels.list": 1,
  "playlists.list": 1,
  "playlistItems.list": 1,
  "subscriptions.list": 1,
  "commentThreads.list": 1,

  // Lệnh ghi — đắt gấp 50 lần lệnh đọc. Đây là một lý do nữa để mọi thao tác
  // ghi phải qua duyệt: bấm bừa mười cái là mất 500 đơn vị, bằng năm lần tìm
  // kiếm, trong khi kết quả lại là thay đổi thật trên tài khoản YouTube.
  "playlists.insert": 50,
  "playlistItems.insert": 50,
  "playlistItems.delete": 50,
  "playlistItems.update": 50,
  "playlists.delete": 50,
  "playlists.update": 50,
} as const;

export type TenLenh = keyof typeof GIA_LENH;
