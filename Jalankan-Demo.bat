@echo off
cd /d "%~dp0"
echo Membuka demo InventarisKu IMM x UMKT di http://localhost:8080
start "InventarisKu" http://localhost:8080
py -m http.server 8080
if errorlevel 1 python -m http.server 8080
pause
