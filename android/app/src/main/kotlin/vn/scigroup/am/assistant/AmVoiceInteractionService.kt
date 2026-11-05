package vn.scigroup.am.assistant

import android.service.voice.VoiceInteractionService

/**
 * Điều kiện để Am xuất hiện trong danh sách "Ứng dụng trợ lý số" của máy. Việc thật
 * nằm ở [AmVoiceInteractionSession]: hệ thống gọi nó khi người dùng giữ nút nguồn.
 */
class AmVoiceInteractionService : VoiceInteractionService()
