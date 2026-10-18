@echo off
rem chd launcher (ADR 0106): runs the bundled CLI with the app's own executable as plain Node.
rem Same pattern as VS Code's code.cmd: the GUI exe itself prints nothing to a console.
set ELECTRON_RUN_AS_NODE=1
"%~dp0context-heavy-diagrams.exe" "%~dp0resources\app.asar.unpacked\resources\cli\chd.mjs" %*
exit /b %ERRORLEVEL%
