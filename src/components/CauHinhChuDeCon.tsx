"use client";

/**
 * Màn hình cấu hình chủ đề con cho năm chuyên mục.
 *
 * ## Điều quan trọng nhất người dùng phải hiểu khi đứng ở đây
 *
 * Danh sách này KHÔNG chỉ là mấy cái nút lọc. Nó đi thẳng vào lời dặn lúc
 * Claude đọc và xếp nội dung, nên:
 *
 *   - Thêm một chủ đề → từ lượt quét đêm sau Claude bắt đầu xếp bài vào đó
 *   - Nội dung CŨ không tự xếp lại — muốn vậy phải cho đọc lại, mà việc đó tốn
 *     tiền nên không tự làm
 *   - Tắt một chủ đề → chỉ mất nút lọc; bài đã gắn vẫn giữ nguyên
 *
 * Ba điều đó viết thẳng lên màn hình, không giấu trong tài liệu — vì đoán sai
 * chúng thì người dùng thêm một chủ đề rồi ngồi chờ mãi không thấy bài nào.
 *
 * ## Vì sao tắt chứ không xoá
 *
 * Mã chủ đề đã nằm trong hàng trăm bản ghi nội dung đã phân loại. Xoá dòng cấu
 * hình đi thì mã ấy thành mồ côi: nội dung vẫn mang nó nhưng không còn tên nào
 * để hiện. Tắt thì giữ được cả hai — mất nút lọc mà không mất dữ liệu.
 */

import { useState, useTransition } from "react";

import {
  batTatChuDeCon,
  suaChuDeCon,
  themChuDeCon,
} from "@/app/cai-dat/actions";

export interface ChuDeConGon {
  id: string;
  ma: string;
  ten: string;
  moTa: string | null;
  bat: boolean;
}

export interface NhomChuDe {
  chuyenMuc: string;
  tenChuyenMuc: string;
  tenHang: string;
  cac: ChuDeConGon[];
}

function MotChuDe({ muc }: { muc: ChuDeConGon }) {
  const [sua, setSua] = useState(false);
  const [ten, setTen] = useState(muc.ten);
  const [moTa, setMoTa] = useState(muc.moTa ?? "");
  const [bat, setBat] = useState(muc.bat);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  if (sua) {
    return (
      <li className="rounded-lg border border-cam-500 p-2.5">
        <input
          value={ten}
          onChange={(e) => setTen(e.target.value)}
          placeholder="Tên hiện trên nút lọc"
          className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none dark:border-neutral-700"
        />
        <textarea
          value={moTa}
          onChange={(e) => setMoTa(e.target.value)}
          rows={2}
          placeholder="Ranh giới của chủ đề — nói cho Claude biết cái gì thuộc vào đây"
          className="mt-1.5 w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs outline-none dark:border-neutral-700"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={dangChay}
            onClick={() =>
              batDau(async () => {
                const kq = await suaChuDeCon(muc.id, ten, moTa);
                setThongDiep(kq.thongDiep);
                if (kq.ok) setSua(false);
              })
            }
            className="rounded-lg bg-cam-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-cam-500"
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={() => {
              setTen(muc.ten);
              setMoTa(muc.moTa ?? "");
              setSua(false);
            }}
            className="rounded-lg border border-neutral-300 px-3 py-1 text-xs text-neutral-500 dark:border-neutral-700"
          >
            Thôi
          </button>
          {thongDiep ? (
            <span className="self-center text-xs text-neutral-500">{thongDiep}</span>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <li
      className={`rounded-lg border p-2.5 ${
        bat
          ? "border-neutral-200 dark:border-neutral-800"
          : "border-dashed border-neutral-300 opacity-60 dark:border-neutral-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {ten}
            {!bat ? (
              <span className="ml-1.5 text-[10px] font-normal text-neutral-400">
                đang tắt
              </span>
            ) : null}
          </p>
          {moTa ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
              {moTa}
            </p>
          ) : null}
          <p className="mt-0.5 font-mono text-[10px] text-neutral-400">{muc.ma}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setSua(true)}
            className="rounded-md border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Sửa
          </button>
          <button
            type="button"
            disabled={dangChay}
            title={
              bat
                ? "Tắt: mất nút lọc, nhưng bài đã gắn vẫn giữ nguyên"
                : "Bật lại: Claude dùng từ lượt quét sau"
            }
            onClick={() => {
              const moi = !bat;
              setBat(moi);
              batDau(async () => {
                const kq = await batTatChuDeCon(muc.id, moi);
                if (!kq.ok) setBat(!moi);
                setThongDiep(kq.thongDiep);
              });
            }}
            className="rounded-md border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {bat ? "Tắt" : "Bật"}
          </button>
        </div>
      </div>
      {thongDiep ? (
        <p className="mt-1.5 text-xs text-neutral-500">{thongDiep}</p>
      ) : null}
    </li>
  );
}

function ThemChuDe({ chuyenMuc }: { chuyenMuc: string }) {
  const [ten, setTen] = useState("");
  const [moTa, setMoTa] = useState("");
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  return (
    <form
      className="mt-2 rounded-lg border border-dashed border-neutral-300 p-2.5 dark:border-neutral-700"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ten.trim()) return;
        batDau(async () => {
          const kq = await themChuDeCon(chuyenMuc, ten, moTa);
          setThongDiep(kq.thongDiep);
          if (kq.ok) {
            setTen("");
            setMoTa("");
          }
        });
      }}
    >
      <input
        value={ten}
        onChange={(e) => setTen(e.target.value)}
        placeholder="+ Chủ đề mới"
        className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-cam-500 dark:border-neutral-700"
      />
      {ten.trim() ? (
        <textarea
          value={moTa}
          onChange={(e) => setMoTa(e.target.value)}
          rows={2}
          placeholder="Ranh giới của chủ đề — càng rõ, Claude xếp càng đúng"
          className="mt-1.5 w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs outline-none dark:border-neutral-700"
        />
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={dangChay || !ten.trim()}
          className="rounded-lg bg-cam-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-cam-500"
        >
          Thêm
        </button>
        {thongDiep ? (
          <span className="text-xs text-neutral-500">{thongDiep}</span>
        ) : null}
      </div>
    </form>
  );
}

export function CauHinhChuDeCon({ cacNhom }: { cacNhom: NhomChuDe[] }) {
  return (
    <div>
      <p className="max-w-3xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        Đây vừa là <strong>nút lọc</strong> ở trang Khám phá, vừa là{" "}
        <strong>lời dặn cho Claude</strong> lúc nó đọc và xếp nội dung. Thêm một
        chủ đề thì từ lượt quét đêm sau Claude bắt đầu xếp bài vào đó — nhưng
        bài cũ không tự xếp lại. Tắt một chủ đề thì chỉ mất nút lọc, bài đã gắn
        vẫn giữ nguyên.
      </p>
      <p className="mt-1.5 max-w-3xl text-xs text-neutral-400 dark:text-neutral-500">
        Phần mô tả không phải ghi chú cho vui: nó đi thẳng vào lời dặn. Viết
        &ldquo;Tin Claude&rdquo; mà không nói rõ ranh giới thì Claude xếp cả tin
        OpenAI vào đó.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {cacNhom.map((n) => (
          <section key={n.chuyenMuc}>
            <h3 className="text-sm font-semibold">
              {n.tenChuyenMuc}
              <span className="ml-2 font-normal text-neutral-400">
                {n.tenHang}
              </span>
            </h3>
            <ul className="mt-2 space-y-2">
              {n.cac.map((c) => (
                <MotChuDe key={c.id} muc={c} />
              ))}
            </ul>
            <ThemChuDe chuyenMuc={n.chuyenMuc} />
          </section>
        ))}
      </div>

      {/* Nhạc BPM tách riêng — nói rõ vì sao nó không nằm trong danh sách trên */}
      <p className="mt-6 max-w-3xl rounded-lg border border-neutral-200 p-3 text-xs leading-relaxed text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <strong>Nhạc chạy bộ theo nhịp vẫn cấu hình riêng.</strong> Nhóm đó
        không xếp bằng cách Claude đọc hiểu, mà đo bằng luật: dải nhịp cụ thể và
        độ dài đủ lớn. Nên nó nằm ngoài danh sách này, giữ nguyên như cũ.
      </p>
    </div>
  );
}
