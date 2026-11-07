@echo off
REM Starts the U1 Doctor test kit. Double-click this file AFTER you tried u1-doctor.exe by hand (see LISEZ-MOI.txt).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-kit\u1-doctor-test.ps1"
