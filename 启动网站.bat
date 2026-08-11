@echo off
cd /d "%~dp0src\teachingTools"
echo 正在启动服务器，请不要关闭这个黑色窗口...
echo 启动后请在浏览器打开 http://localhost:3000
npm start
pause
