/**
 * Service worker — làm Am mở được lúc mất mạng.
 *
 * ## Chỉ nhận ba việc, không hơn
 *
 * Service worker là thứ dễ gây hại nhất trong một web app: nó nằm giữa trang và
 * mạng, sống lâu hơn cả tab, và một lỗi lưu đệm sai sẽ khiến người dùng nhìn
 * mãi bản cũ mà xoá cache trình duyệt cũng không hết. Nên ở đây nó chỉ làm ba
 * việc, mỗi việc có lý do rõ ràng:
 *
 *   1. **Trang HTML: hỏi mạng trước.** Nội dung Am đổi mỗi đêm, lấy bản đệm
 *      trước là mở ra thấy bản tin hôm qua. Chỉ khi mạng hỏng mới lôi bản đệm
 *      ra, và nếu chưa có gì thì hiện trang báo mất mạng bằng tiếng Việt thay
 *      cho con khủng long của Chrome.
 *
 *   2. **File mp3: lấy bản đệm trước.** Bản đọc tiếng Việt và bản tin sáng
 *      không bao giờ đổi nội dung — tên file gắn với id bản ghi. Nghe lại lần
 *      hai thì không tải lại, và nghe được cả lúc đi đường mất sóng.
 *
 *   3. **Không đụng gì tới `/api`.** Dữ liệu cá nhân và lời gọi ghi thì lưu đệm
 *      là sai hoàn toàn.
 *
 * ## Vì sao đổi `PHIEN_BAN` là dọn sạch
 *
 * Mỗi lần đổi số này, `activate` xoá mọi kho đệm tên khác — đó là nút thoát
 * hiểm khi lỡ lưu nhầm thứ gì. Cứ tăng số lên rồi tải lại hai lần là sạch.
 */

const PHIEN_BAN = "am-v1";
const KHO_TRANG = `${PHIEN_BAN}-trang`;
const KHO_AM_THANH = `${PHIEN_BAN}-am-thanh`;

/** Trang hiện ra khi mất mạng mà chưa có bản đệm nào. */
const TRANG_MAT_MANG = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Am — mất mạng</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;
    background:#171717;color:#e5e5e5;
    font-family:system-ui,-apple-system,sans-serif;padding:24px}
  div{max-width:22rem;text-align:center}
  h1{font-size:1.1rem;margin:0 0 .6rem}
  p{font-size:.9rem;line-height:1.6;color:#a3a3a3;margin:0}
  b{color:#dd6b20}
</style></head>
<body><div>
  <h1>Đang mất mạng</h1>
  <p>Am cần mạng để lấy nội dung mới. Những bản đọc <b>đã nghe rồi</b> vẫn nghe
  lại được — mở lại lúc có sóng là mọi thứ trở lại bình thường.</p>
</div></body></html>`;

self.addEventListener("install", (su) => {
  // Nhận việc ngay, không đợi tab cũ đóng hết. Với app một người dùng thì
  // không có cảnh nhiều tab chạy hai phiên bản khác nhau để phải lo.
  self.skipWaiting();
  su.waitUntil(
    caches.open(KHO_TRANG).then((kho) =>
      kho.put(
        "/__mat-mang",
        new Response(TRANG_MAT_MANG, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
      ),
    ),
  );
});

self.addEventListener("activate", (su) => {
  su.waitUntil(
    (async () => {
      const ten = await caches.keys();
      await Promise.all(
        ten
          .filter((t) => !t.startsWith(PHIEN_BAN))
          .map((t) => caches.delete(t)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (su) => {
  const yeuCau = su.request;

  // Chỉ đụng tới GET cùng nguồn. Lời gọi ghi và tài nguyên bên ngoài để nguyên
  if (yeuCau.method !== "GET") return;

  const dia = new URL(yeuCau.url);
  if (dia.origin !== self.location.origin) return;

  // API để nguyên — dữ liệu cá nhân, không lưu đệm
  if (dia.pathname.startsWith("/api/")) return;

  // --- File mp3: bản đệm trước ---
  if (dia.pathname.startsWith("/am-thanh/")) {
    su.respondWith(
      (async () => {
        const kho = await caches.open(KHO_AM_THANH);
        const daCo = await kho.match(yeuCau);
        if (daCo) return daCo;

        const traLoi = await fetch(yeuCau);
        // Chỉ lưu bản trả lời đầy đủ. Trình phát hay xin từng khúc (206) để
        // tua; lưu một khúc rồi lần sau trả nguyên khúc đó là file hỏng.
        if (traLoi.ok && traLoi.status === 200) {
          kho.put(yeuCau, traLoi.clone());
        }
        return traLoi;
      })(),
    );
    return;
  }

  // --- Trang HTML: hỏi mạng trước ---
  if (yeuCau.mode === "navigate") {
    su.respondWith(
      (async () => {
        try {
          const traLoi = await fetch(yeuCau);
          const kho = await caches.open(KHO_TRANG);
          kho.put(yeuCau, traLoi.clone());
          return traLoi;
        } catch {
          const kho = await caches.open(KHO_TRANG);
          return (
            (await kho.match(yeuCau)) ??
            (await kho.match("/__mat-mang")) ??
            new Response("Mất mạng", { status: 503 })
          );
        }
      })(),
    );
  }
});
