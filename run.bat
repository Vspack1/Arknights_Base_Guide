@echo off
cd /d "%~dp0backend"

if not exist out (
  echo [build] Compiling Java backend...
  mkdir out
  javac -d out src\main\java\ak\base\*.java
)

set PORT=%1
if "%PORT%"=="" set PORT=8080

echo [run] Starting server on http://localhost:%PORT%
java -cp out ak.base.Server %PORT%
