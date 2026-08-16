"use client";

/**
 * Khối giữ hộ giá trị cho hai thanh trượt của trang Vận hành.
 *
 * ## Vì sao phải có
 *
 * Cường độ quét và suất từng chuyên mục **là một phép nhân, không phải hai con
 * số rời**. Máy chạy đêm tính `suất × hệ số cường độ` (xem `chiaSuatPhanLoai`),
 * nên kéo cường độ lên 200% là mỗi mục 20 bài và tổng 120 bài.
 *
 * Bản đầu để mỗi component tự giữ state của mình, và màn hình nói dối: thanh
 * trên ghi 120 bài, ngay dưới nó tổng sáu mục vẫn ghi 60. Chủ dự án chỉ ra
 * 2026-08-16. Hai component anh em không thấy state của nhau nên không có cách
 * nào sửa tại chỗ — giá trị phải nằm ở đây, chỗ duy nhất thấy được cả hai.
 *
 * ## Vẫn hai lần ghi riêng
 *
 * Cường độ và suất là hai cột khác nhau trong database, hai server action khác
 * nhau. Khối này chỉ gom **giá trị**, còn việc ghi vẫn do từng component lo —
 * kéo thanh cường độ không đụng gì tới suất và ngược lại.
 */

import { useState } from "react";

import { ThanhCuongDoQuet } from "@/components/ThanhCuongDoQuet";
import { ThanhSuatPhanLoai, type HangCon } from "@/components/ThanhSuatPhanLoai";
import {
  suatSauCuongDo,
  tongSuat,
  type CaiDatSuat,
  type MaChuyenMuc,
  type MaNhomNguon,
} from "@/lib/vanHanh/mucSuat";

export function KhoiCuongDoVaSuat({
  cuongDoBanDau,
  suatBanDau,
  hangCon,
  choPhepSua,
}: {
  cuongDoBanDau: number;
  suatBanDau: CaiDatSuat;
  hangCon: HangCon;
  choPhepSua: boolean;
}) {
  const [cuongDo, setCuongDo] = useState(cuongDoBanDau);
  const [muc, setMuc] = useState(suatBanDau.chuyenMuc);
  const [tyLe, setTyLe] = useState(suatBanDau.tyLeNguon);

  const heSo = cuongDo / 100;

  function doiMuc(m: MaChuyenMuc, x: number) {
    const moi = { ...muc, [m]: x };
    setMuc(moi);
    return moi;
  }

  /**
   * Kéo YouTube hoặc Podcast thì ô Blog tự tính lại.
   *
   * Kéo YouTube lên quá cao thì Podcast bị đẩy xuống trước, Blog giữ 0 — chứ
   * không để Blog âm.
   */
  function doiTyLe(n: MaNhomNguon, x: number) {
    let youtube = tyLe.youtube;
    let nghe = tyLe.nghe;
    if (n === "youtube") {
      youtube = Math.min(100, x);
      nghe = Math.min(nghe, 100 - youtube);
    } else {
      nghe = Math.min(x, 100 - youtube);
    }
    const moi = { youtube, nghe, viet: 100 - youtube - nghe };
    setTyLe(moi);
    return moi;
  }

  return (
    <>
      {/* Khách vẫn thấy mức đang đặt — minh bạch thì tốt hơn giấu đi, cùng lý
          do với bảng trọng số chấm điểm trong Cài đặt */}
      <ThanhCuongDoQuet
        giaTri={cuongDo}
        banDau={cuongDoBanDau}
        soBaiMoc100={tongSuat(muc)}
        soBai={tongSuat(suatSauCuongDo(muc, heSo))}
        choPhepSua={choPhepSua}
        onDoi={setCuongDo}
      />
      <ThanhSuatPhanLoai
        muc={muc}
        tyLe={tyLe}
        heSo={heSo}
        hangCon={hangCon}
        choPhepSua={choPhepSua}
        onDoiMuc={doiMuc}
        onDoiTyLe={doiTyLe}
      />
    </>
  );
}
