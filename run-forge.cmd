@echo off
setlocal
cd /d "%~dp0"
call npm.cmd run dev
if errorlevel 1 (
  echo.
  echo Forge Engine failed to start. Check the error above.
  pause
)
endlocal
