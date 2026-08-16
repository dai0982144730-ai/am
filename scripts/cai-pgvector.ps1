# Dựng và cài pgvector vào bản PostgreSQL đang chạy ở máy này.
#
# ## Vì sao phải tự dựng
#
# pgvector KHÔNG phát hành file cài sẵn cho Windows — trang phát hành trên
# GitHub không kèm file nào, và catalog StackBuilder của EDB cũng không có nó
# (đã kiểm 2026-08-16: có PostGIS, có pgAgent, không có vector). Cách chính thức
# duy nhất trên Windows là dựng từ mã nguồn bằng bộ biên dịch của Microsoft.
#
# ## Cần cài trước MỘT LẦN
#
#   winget install Microsoft.VisualStudio.2022.BuildTools ``
#     --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
#
# Khoảng 3–6 GB. Cài xong thì chạy file này, không cần cài lại lần sau.
#
# ## Chạy
#
#   powershell -ExecutionPolicy Bypass -File scripts\cai-pgvector.ps1
#
# Xong thì bật extension trong database:
#
#   npx tsx scripts/bat-pgvector.ts

$ErrorActionPreference = "Stop"

$PGROOT  = "C:\Users\Admin\pgsql-goc\pgsql"
$PHIENBAN = "v0.8.6"
$THUMUC  = Join-Path $env:TEMP "pgvector-build"

Write-Host "PostgreSQL: $PGROOT"
if (-not (Test-Path (Join-Path $PGROOT "lib\postgres.lib"))) {
  throw "Khong thay $PGROOT\lib\postgres.lib — sai duong dan PostgreSQL."
}

# --- Tìm bộ biên dịch của Microsoft ---
$vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) {
  throw @"
Chua cai Visual Studio Build Tools. Chay lenh nay truoc (mot lan duy nhat):

  winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
"@
}

$vsPath = & $vswhere -latest -products * `
  -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  -property installationPath
if (-not $vsPath) {
  throw "Da cai Build Tools nhung thieu phan C++ (workload VCTools). Cai lai kem --add Microsoft.VisualStudio.Workload.VCTools"
}
Write-Host "Build Tools: $vsPath"

# --- Lấy mã nguồn từ kho chính thức ---
if (Test-Path $THUMUC) { Remove-Item -Recurse -Force $THUMUC }
git clone --quiet --branch $PHIENBAN --depth 1 https://github.com/pgvector/pgvector.git $THUMUC
Write-Host "Da tai ma nguon pgvector $PHIENBAN"

# --- Dựng và cài ---
#
# `nmake` chi chay dung trong moi truong da nap bien cua VC, nen phai goi qua
# vcvars64.bat roi moi chay lenh trong cung mot phien cmd.
$vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
$lenh = "call `"$vcvars`" && cd /d `"$THUMUC`" && set `"PGROOT=$PGROOT`" && nmake /F Makefile.win && nmake /F Makefile.win install"

Write-Host "Dang dung..."
cmd.exe /c $lenh
if ($LASTEXITCODE -ne 0) { throw "Dung pgvector that bai, xem loi ben tren." }

# --- Kiểm ---
$duoi = Join-Path $PGROOT "lib\vector.dll"
$khai = Join-Path $PGROOT "share\extension\vector.control"
if ((Test-Path $duoi) -and (Test-Path $khai)) {
  Write-Host ""
  Write-Host "XONG. Da chep:"
  Write-Host "  $duoi"
  Write-Host "  $khai"
  Write-Host ""
  Write-Host "Buoc cuoi: npx tsx scripts/bat-pgvector.ts"
} else {
  throw "Dung xong nhung khong thay vector.dll hoac vector.control trong $PGROOT."
}
