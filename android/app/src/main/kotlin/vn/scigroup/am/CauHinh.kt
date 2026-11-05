package vn.scigroup.am

import android.content.Context

/**
 * Cài đặt lưu trên máy: địa chỉ máy chủ, token, có tự đọc câu trả lời không.
 * Lưu trong thư mục riêng của app (không ai khác đọc được). Chưa mã hoá thêm.
 */
class CauHinh(context: Context) {
    private val kho = context.applicationContext.getSharedPreferences("am", Context.MODE_PRIVATE)

    var diaChi: String
        get() = kho.getString("diaChi", "") ?: ""
        set(v) = kho.edit().putString("diaChi", v.trim()).apply()

    var token: String
        get() = kho.getString("token", "") ?: ""
        set(v) = kho.edit().putString("token", v.trim()).apply()

    /**
     * Thẻ thiết bị do máy chủ cấp khi ghép app bằng mã (trang Vận hành của web).
     * Có thẻ thì app dùng thẻ thay cho token nhập tay, và dùng được mục Tài khoản Claude.
     */
    var the: String
        get() = kho.getString("the", "") ?: ""
        set(v) = kho.edit().putString("the", v.trim()).apply()

    var docTo: Boolean
        get() = kho.getBoolean("docTo", true)
        set(v) = kho.edit().putBoolean("docTo", v).apply()
}
