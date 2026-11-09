@echo off
rem Reached through the PATH entry the installer can add (ADR 0162): hands over to the launcher one folder up,
rem so only this folder is on the PATH and not the whole app folder. Without "call" control does not
rem come back, so the launcher's exit code is the one the caller sees.
"%~dp0..\chd.cmd" %*
