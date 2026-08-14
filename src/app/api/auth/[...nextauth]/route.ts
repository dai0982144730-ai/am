/**
 * Cửa vào của Auth.js — Google chuyển hướng người dùng về đây sau khi cấp
 * quyền. Toàn bộ cấu hình nằm ở `src/auth.ts`.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
