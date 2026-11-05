package vn.scigroup.am.assistant

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionSession

/** Hệ thống mở phiên này khi người dùng giữ nút nguồn; ta mở màn trợ lý của Am. */
class AmVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {
    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        startAssistantActivity(Intent(context, TroLyActivity::class.java))
    }
}
