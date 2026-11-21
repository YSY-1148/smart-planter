@echo off
cd /d "%~dp0"
python launch.py --study
if errorlevel 1 pause
