/**
 * Thành viên playlist trên Am — sửa tự do, không cần duyệt.
 *
 * Nguyên tắc chốt 2026-08-17: Am giữ **ý Am muốn** (`PlaylistItem`) tách hẳn
 * khỏi **thứ đã thật trên YouTube** (`YouTubePlaylist.lastSyncedVideoIds`).
 * Sửa ý muốn — thêm/xoá/đổi tên/xoá thư mục — không đụng gì tới thế giới
 * thật, nên làm ngay, không cần duyệt, kể cả khi AI là người sửa.
 *
 * Chỉ khi so hai bên mà LỆCH thì mới có việc phải làm thật (`soSanhVaSinhDeXuat`
 * bên dưới), và việc đó luôn dừng lại ở một đề xuất chờ duyệt — chỗ ghi thật
 * nằm ở `apDung.ts`, file này không gọi YouTube.
 */

import { prisma } from "@/lib/db/prisma";

export interface KetQua {
  ok: boolean;
  thongDiep: string;
}

/** Lấy mã video YouTube từ đường dẫn — dùng để so với `lastSyncedVideoIds`. */
export function maVideoTuUrl(url: string | null): string | null {
  if (!url) return null;
  return /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
}

/**
 * Tạo một thư mục mới, CHƯA có thật trên YouTube.
 *
 * `youtubePlaylistId` để trống — đúng nghĩa "đang chờ". Chỉ khi có đề xuất
 * `create_playlist`/`new_save` được duyệt và ghi thật thì cột đó mới được
 * điền, xem `apDung.ts`.
 */
export async function taoThuMucMoi(ten: string): Promise<{ id: string }> {
  const sach = ten.trim().slice(0, 150) || "Thư mục mới";
  return prisma.youTubePlaylist.create({
    data: { title: sach },
    select: { id: true },
  });
}

/**
 * Đổi tên thư mục trên Am ngay lập tức.
 *
 * Nếu thư mục đã có thật trên YouTube (`youtubePlaylistId` khác rỗng), việc
 * đổi tên thật cần ghi — sinh một đề xuất `rename_playlist` chờ duyệt. Thư
 * mục còn đang chờ tạo thì đổi tên tại đây là đủ, chưa có gì thật để sinh đề
 * xuất, tên mới tự động dùng khi đề xuất tạo playlist được ghi.
 */
export async function doiTenThuMuc(
  playlistId: string,
  tenMoi: string,
  tuSoSanh = true,
): Promise<KetQua> {
  const sach = tenMoi.trim().slice(0, 150);
  if (!sach) return { ok: false, thongDiep: "Tên không được để trống." };

  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: { youtubePlaylistId: true, title: true },
  });
  if (!pl) return { ok: false, thongDiep: "Không tìm thấy thư mục này." };
  if (pl.title === sach) return { ok: true, thongDiep: "Tên không đổi." };

  await prisma.youTubePlaylist.update({
    where: { id: playlistId },
    data: { title: sach },
  });

  // `tuSoSanh = false` khi bên gọi tự ghi tên mới lên YouTube ngay sau đó —
  // lúc ấy chẳng có gì lệch để mà xin duyệt.
  if (tuSoSanh && pl.youtubePlaylistId) {
    await prisma.playlistOrganizationSuggestion.create({
      data: {
        suggestedPlaylistId: playlistId,
        currentPlaylistTitle: pl.title,
        newPlaylistTitle: sach,
        reason: `Bạn đổi tên thư mục từ "${pl.title}" thành "${sach}" trên Am.`,
        type: "rename_playlist",
        status: "pending",
      },
    });
  }

  return { ok: true, thongDiep: "Đã đổi tên." };
}

/**
 * Yêu cầu xoá một thư mục — CHƯA xoá gì cả.
 *
 * Chỉ đặt `deletionRequestedAt` để ẩn khỏi danh sách bình thường, và sinh một
 * đề xuất `delete_playlist` chờ duyệt. Xoá thật diễn ra ở `apDung.ts`, và chỉ
 * khi đề xuất đó được duyệt rồi bấm ghi. Playlist chưa từng có thật trên
 * YouTube thì xoá thẳng, không có gì để đề xuất.
 */
export async function xoaThuMuc(playlistId: string): Promise<KetQua> {
  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: { youtubePlaylistId: true, title: true },
  });
  if (!pl) return { ok: false, thongDiep: "Không tìm thấy thư mục này." };

  if (!pl.youtubePlaylistId) {
    await prisma.youTubePlaylist.delete({ where: { id: playlistId } });
    return { ok: true, thongDiep: `Đã xoá "${pl.title}" — chưa từng có thật trên YouTube.` };
  }

  await prisma.youTubePlaylist.update({
    where: { id: playlistId },
    data: { deletionRequestedAt: new Date() },
  });

  // Xoá cả thư mục thì mọi đề xuất thêm/bớt riêng lẻ của nó không còn nghĩa gì
  await prisma.playlistOrganizationSuggestion.updateMany({
    where: { suggestedPlaylistId: playlistId, status: "pending" },
    data: { status: "rejected", decidedAt: new Date() },
  });

  await prisma.playlistOrganizationSuggestion.create({
    data: {
      suggestedPlaylistId: playlistId,
      currentPlaylistTitle: pl.title,
      reason: `Bạn yêu cầu xoá hẳn thư mục "${pl.title}" — việc DUY NHẤT không cứu lại được, cân nhắc kỹ trước khi duyệt.`,
      type: "delete_playlist",
      status: "pending",
    },
  });

  return {
    ok: true,
    thongDiep: `Đã ẩn "${pl.title}" và tạo đề xuất xoá thật — chờ bạn duyệt ở trang Playlist.`,
  };
}

/** Huỷ yêu cầu xoá — thư mục hiện lại bình thường. */
export async function huyXoaThuMuc(playlistId: string): Promise<KetQua> {
  await prisma.youTubePlaylist.update({
    where: { id: playlistId },
    data: { deletionRequestedAt: null },
  });
  await prisma.playlistOrganizationSuggestion.updateMany({
    where: { suggestedPlaylistId: playlistId, type: "delete_playlist", status: "pending" },
    data: { status: "rejected", decidedAt: new Date() },
  });
  return { ok: true, thongDiep: "Đã huỷ yêu cầu xoá." };
}

/**
 * Thêm một nội dung vào thư mục — ngay lập tức trên Am.
 *
 * @param nguoiThem "user" khi chính chủ nhà bấm; "ai" khi trợ lý tự quyết —
 *   cả hai đều được phép sửa tự do, chỉ khác ở chỗ ghi lại ai làm.
 */
export async function themVaoThuMuc(
  contentItemId: string,
  playlistId: string,
  nguoiThem: "user" | "ai" = "user",
  tuSoSanh = true,
): Promise<KetQua> {
  const [pl, noiDung] = await Promise.all([
    prisma.youTubePlaylist.findUnique({
      where: { id: playlistId },
      select: { id: true, title: true, items: { select: { position: true } } },
    }),
    prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: { id: true, title: true },
    }),
  ]);
  if (!pl) return { ok: false, thongDiep: "Không tìm thấy thư mục này." };
  if (!noiDung) return { ok: false, thongDiep: "Không tìm thấy nội dung này." };

  const viTriKe = pl.items.reduce((max, i) => Math.max(max, i.position), -1) + 1;

  await prisma.playlistItem.upsert({
    where: { playlistId_contentItemId: { playlistId, contentItemId } },
    create: { playlistId, contentItemId, position: viTriKe, addedBy: nguoiThem },
    update: {},
  });

  if (tuSoSanh) await soSanhVaSinhDeXuat(playlistId);

  return { ok: true, thongDiep: `Đã thêm vào "${pl.title}".` };
}

/**
 * Bỏ một nội dung khỏi thư mục — ngay lập tức trên Am.
 *
 * `tuSoSanh = false` khi bên gọi sẽ tự ghi thẳng lên YouTube ngay sau đó. Đã
 * vấp thật 2026-08-18: bộ so sánh chạy TRƯỚC lúc ghi nên nó thấy Am và YouTube
 * lệch nhau, đẻ ra một đề xuất chờ duyệt — rồi ghi xong, đề xuất ấy vẫn nằm
 * lại, bắt chủ nhà duyệt đúng cái việc chính mình vừa tự tay làm.
 */
export async function xoaKhoiThuMuc(
  contentItemId: string,
  playlistId: string,
  tuSoSanh = true,
): Promise<KetQua> {
  await prisma.playlistItem.deleteMany({ where: { playlistId, contentItemId } });
  if (tuSoSanh) await soSanhVaSinhDeXuat(playlistId);
  return { ok: true, thongDiep: "Đã bỏ khỏi thư mục." };
}

/**
 * Đổi chỗ một nội dung với nội dung đứng ngay trước/sau nó trong thư mục —
 * ngay lập tức trên Am, không đụng gì tới YouTube.
 *
 * Chỉ ĐỔI CHỖ (swap) hai `position` liền kề, không viết lại toàn bộ danh sách
 * — rẻ, và đúng nghĩa "nhích lên một bậc" người dùng bấm.
 *
 * Việc GHI THẬT thứ tự mới lên YouTube không nằm ở đây: `soSanhVaSinhDeXuat`
 * tự phát hiện thứ tự lệch và sinh đề xuất `reorder_items` chờ duyệt, đúng
 * nguyên tắc mọi lần ghi thật đều phải qua duyệt.
 */
export async function doiThuTu(
  playlistId: string,
  contentItemId: string,
  huong: "len" | "xuong",
): Promise<KetQua> {
  const cac = await prisma.playlistItem.findMany({
    where: { playlistId },
    orderBy: { position: "asc" },
    select: { id: true, contentItemId: true, position: true },
  });

  const viTri = cac.findIndex((m) => m.contentItemId === contentItemId);
  if (viTri === -1) return { ok: false, thongDiep: "Không tìm thấy trong thư mục này." };

  const viTriKe = huong === "len" ? viTri - 1 : viTri + 1;
  if (viTriKe < 0 || viTriKe >= cac.length) {
    return { ok: false, thongDiep: huong === "len" ? "Đã ở đầu danh sách." : "Đã ở cuối danh sách." };
  }

  const a = cac[viTri];
  const b = cac[viTriKe];

  await prisma.$transaction([
    prisma.playlistItem.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.playlistItem.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);

  await soSanhVaSinhDeXuat(playlistId);
  return { ok: true, thongDiep: "Đã đổi chỗ." };
}

/**
 * Ghi lại toàn bộ thứ tự sau khi kéo-thả — nhận nguyên danh sách id đã sắp
 * lại (kiểu YouTube), khác `doiThuTu` chỉ đổi chỗ hai cái liền kề.
 *
 * Cũng chỉ sửa trên Am, chưa đụng YouTube — `soSanhVaSinhDeXuat` phát hiện
 * chỗ lệch rồi tự sinh đề xuất `reorder_items` chờ duyệt như cũ.
 */
export async function datLaiThuTu(
  playlistId: string,
  thuTuMoi: string[],
  tuSoSanh = true,
): Promise<KetQua> {
  const cac = await prisma.playlistItem.findMany({
    where: { playlistId },
    select: { id: true, contentItemId: true },
  });

  if (
    cac.length !== thuTuMoi.length ||
    new Set(thuTuMoi).size !== thuTuMoi.length
  ) {
    return {
      ok: false,
      thongDiep: "Danh sách không khớp — tải lại trang rồi thử lại.",
    };
  }

  const idTheoNoiDung = new Map(cac.map((m) => [m.contentItemId, m.id]));
  const capNhat: { id: string; position: number }[] = [];
  for (let i = 0; i < thuTuMoi.length; i++) {
    const id = idTheoNoiDung.get(thuTuMoi[i]);
    if (!id) {
      return {
        ok: false,
        thongDiep: "Danh sách không khớp — tải lại trang rồi thử lại.",
      };
    }
    capNhat.push({ id, position: i });
  }

  await prisma.$transaction(
    capNhat.map((m) =>
      prisma.playlistItem.update({ where: { id: m.id }, data: { position: m.position } }),
    ),
  );

  if (tuSoSanh) await soSanhVaSinhDeXuat(playlistId);
  return { ok: true, thongDiep: "Đã lưu thứ tự mới." };
}

/**
 * So sánh ý Am muốn (`PlaylistItem`) với thật trên YouTube
 * (`lastSyncedVideoIds`), rồi tự dọn đề xuất cho khớp.
 *
 * BA VIỆC, đúng nguyên tắc đã chốt:
 *
 *   1. Thiếu trên YouTube mà Am muốn có → đề xuất `new_save` nếu chưa có.
 *   2. Có trên YouTube mà Am không muốn nữa → đề xuất `remove_item` nếu chưa có.
 *   3. Đề xuất cũ đã hết lý do tồn tại (thêm cái đã có sẵn rồi, hoặc bớt cái
 *      đã tự mất rồi) → tự đóng, KHÔNG bắt duyệt một việc đã xong hoặc vô nghĩa.
 *
 * CHỈ so phần video YouTube thật — nội dung nguồn khác (podcast, blog…) chỉ
 * sống trên Am, YouTube không nhận được nên không có gì để so.
 */
export async function soSanhVaSinhDeXuat(playlistId: string): Promise<void> {
  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: {
      id: true,
      lastSyncedVideoIds: true,
      deletionRequestedAt: true,
      items: {
        orderBy: { position: "asc" },
        select: {
          contentItem: { select: { id: true, url: true, source: { select: { type: true } } } },
        },
      },
    },
  });
  // Thư mục đang chờ xoá thì thôi, không sinh thêm đề xuất thêm/bớt nữa
  if (!pl || pl.deletionRequestedAt) return;

  const muonCo = new Map<string, string>(); // videoId -> contentItemId
  for (const it of pl.items) {
    if (it.contentItem.source.type !== "youtube_channel") continue;
    const ma = maVideoTuUrl(it.contentItem.url);
    if (ma) muonCo.set(ma, it.contentItem.id);
  }
  const thatCo = new Set(pl.lastSyncedVideoIds);

  const canThem = [...muonCo.entries()].filter(([ma]) => !thatCo.has(ma));
  const canBot = [...thatCo].filter((ma) => !muonCo.has(ma));

  const deXuatDangCho = await prisma.playlistOrganizationSuggestion.findMany({
    where: {
      suggestedPlaylistId: playlistId,
      status: { in: ["pending", "approved"] },
      type: { in: ["new_save", "remove_item"] },
    },
    select: {
      id: true,
      type: true,
      contentItemId: true,
      contentItem: { select: { url: true } },
    },
  });

  // Đóng MỌI đề xuất new_save/remove_item mà thực tế đã trùng với thật rồi
  // (video đã có/đã mất trên YouTube từ trước) HOẶC đã hết ý nghĩa (chủ nhà
  // đổi ý trên Am trước khi kịp duyệt) — dựa đúng một câu hỏi: "ý Am muốn bây
  // giờ có khớp thật không?" Khớp rồi thì đề xuất thêm/bớt không còn lý do tồn
  // tại, dù nó khớp theo hướng nào.
  const coRoi = new Set<string>();
  for (const dx of deXuatDangCho) {
    if (!dx.contentItemId) continue;
    coRoi.add(dx.contentItemId);

    const ma = maVideoTuUrl(dx.contentItem?.url ?? null);
    const trongYMuon = muonCo.has(ma ?? "");
    const trongThat = ma ? thatCo.has(ma) : false;

    if (trongYMuon === trongThat) {
      await prisma.playlistOrganizationSuggestion.update({
        where: { id: dx.id },
        data: {
          status: "rejected",
          decidedAt: new Date(),
          reason: trongThat
            ? "Đã có sẵn trên YouTube rồi, không cần ghi nữa."
            : "Bạn đã đổi ý hoặc video đã tự mất khỏi YouTube — không còn gì để ghi.",
        },
      });
      coRoi.delete(dx.contentItemId);
    }
  }

  for (const [, contentItemId] of canThem) {
    if (coRoi.has(contentItemId)) continue;
    await prisma.playlistOrganizationSuggestion.create({
      data: {
        contentItemId,
        suggestedPlaylistId: playlistId,
        reason: "Bạn đã thêm trên Am, chờ ghi thật lên YouTube.",
        type: "new_save",
        status: "pending",
      },
    });
  }

  for (const ma of canBot) {
    const idThat = await prisma.contentItem.findFirst({
      where: { url: { contains: ma } },
      select: { id: true },
    });
    if (!idThat || coRoi.has(idThat.id)) continue;
    await prisma.playlistOrganizationSuggestion.create({
      data: {
        contentItemId: idThat.id,
        suggestedPlaylistId: playlistId,
        reason: "Bạn đã bỏ khỏi thư mục trên Am, chờ xoá thật khỏi YouTube.",
        type: "remove_item",
        status: "pending",
      },
    });
  }

  // --- Việc 4: thứ tự — chỉ xét khi thành viên đã khớp hệt nhau. So thứ tự
  // lúc còn thiếu/thừa video thì vô nghĩa, đợi add/remove xong đã.
  if (canThem.length === 0 && canBot.length === 0) {
    await xetLechThuTu(playlistId, pl.items, pl.lastSyncedVideoIds);
  }
}

/**
 * So thứ tự Am muốn với thứ tự thật trên YouTube, tự sinh/tự đóng đề xuất
 * `reorder_items`. Mỗi playlist tối đa MỘT đề xuất thứ tự đang chờ — đổi ý
 * nhiều lần trước khi ghi thì chỉ cập nhật `desiredOrder`, không đẻ thêm đề
 * xuất mới.
 */
async function xetLechThuTu(
  playlistId: string,
  items: { contentItem: { id: string; url: string | null; source: { type: string } } }[],
  lastSyncedVideoIds: string[],
): Promise<void> {
  const thuTuVideoYouTube = items
    .filter((it) => it.contentItem.source.type === "youtube_channel")
    .map((it) => maVideoTuUrl(it.contentItem.url))
    .filter((ma): ma is string => ma !== null);

  const khopThuTu =
    thuTuVideoYouTube.length === lastSyncedVideoIds.length &&
    thuTuVideoYouTube.every((ma, i) => ma === lastSyncedVideoIds[i]);

  const dangCho = await prisma.playlistOrganizationSuggestion.findFirst({
    where: { suggestedPlaylistId: playlistId, status: { in: ["pending", "approved"] }, type: "reorder_items" },
    select: { id: true },
  });

  if (khopThuTu) {
    if (dangCho) {
      await prisma.playlistOrganizationSuggestion.update({
        where: { id: dangCho.id },
        data: {
          status: "rejected",
          decidedAt: new Date(),
          reason: "Thứ tự đã khớp thật trên YouTube, không cần ghi nữa.",
        },
      });
    }
    return;
  }

  // Chỉ có nghĩa khi có từ hai video YouTube trở lên — một video thì không
  // có "thứ tự" nào để lệch.
  if (thuTuVideoYouTube.length < 2) return;

  const thuTuMongMuon = items.map((it) => it.contentItem.id);
  const lyDo =
    `Thứ tự trên Am khác thứ tự thật trên YouTube (${thuTuVideoYouTube.length} video). ` +
    `Ghi lại tốn tối đa ${thuTuVideoYouTube.length * 50} đơn vị hạn mức — mỗi video lệch chỗ ` +
    `tốn 50 đơn vị (playlistItems.update), video nào đã đúng chỗ thì bỏ qua.`;

  if (dangCho) {
    await prisma.playlistOrganizationSuggestion.update({
      where: { id: dangCho.id },
      data: { desiredOrder: thuTuMongMuon, reason: lyDo },
    });
  } else {
    await prisma.playlistOrganizationSuggestion.create({
      data: {
        suggestedPlaylistId: playlistId,
        type: "reorder_items",
        status: "pending",
        desiredOrder: thuTuMongMuon,
        reason: lyDo,
      },
    });
  }
}
