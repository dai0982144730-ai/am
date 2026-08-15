@echo off
REM ===========================================================================
REM  Khoi dong PostgreSQL dang tren may nay.
REM
REM  VI SAO CAN CHAY TAY: ban Postgres nay la ban ROI (giai nen, khong cai dat),
REM  co chu dich — khong dung toi quyen admin, khong dong vao he thong, muon go
REM  thi xoa thu muc la xong. Doi lai, no khong tu chay khi bat may nhu mot dich
REM  vu Windows.
REM
REM  Cach dung:
REM     scripts\chay-database.cmd          bat may chu
REM     scripts\chay-database.cmd dung     tat may chu
REM     scripts\chay-database.cmd xem      xem dang chay hay khong
REM ===========================================================================

set PG=C:\Users\Admin\pgsql-goc\pgsql\bin
set DATA=C:\Users\Admin\am-database

if /i "%1"=="dung" goto DUNG
if /i "%1"=="xem"  goto XEM

echo Dang khoi dong PostgreSQL...
"%PG%\pg_ctl.exe" -D "%DATA%" -l "%DATA%\nhat-ky.log" -o "-p 5432" start
timeout /t 3 /nobreak >nul
"%PG%\pg_isready.exe" -h localhost -p 5432
goto END

:DUNG
"%PG%\pg_ctl.exe" -D "%DATA%" stop
goto END

:XEM
"%PG%\pg_isready.exe" -h localhost -p 5432

:END
