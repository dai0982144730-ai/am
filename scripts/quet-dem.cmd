@echo off
REM ==========================================================================
REM  Quét đêm — file này để Task Scheduler của Windows gọi lúc 21:00 mỗi tối.
REM
REM  Đặt lịch một lần bằng lệnh trong docs/tu-chay-hang-dem.md, sau đó máy tự
REM  chạy, không phải mở terminal gõ gì nữa.
REM
REM  Nhật ký mỗi đêm ghi vào thư mục logs/ để sáng dậy xem lại được.
REM ==========================================================================

cd /d "%~dp0.."

if not exist "logs" mkdir "logs"

REM Tên file nhật ký theo ngày, ví dụ logs/quet-dem-2026-08-14.txt
for /f "tokens=1-3 delims=/-. " %%a in ("%date%") do set NGAY=%%c-%%b-%%a

echo. >> "logs\quet-dem-%NGAY%.txt"
echo ===== %date% %time% ===== >> "logs\quet-dem-%NGAY%.txt"

call npx tsx scripts/quet-dem.ts >> "logs\quet-dem-%NGAY%.txt" 2>&1

echo Xong. Nhat ky: logs\quet-dem-%NGAY%.txt
