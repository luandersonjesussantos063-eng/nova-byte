@echo off
cd /d "%LOCALAPPDATA%\NPlay\TV-PC"
docker compose -p nplay-tv-pc down
pause
