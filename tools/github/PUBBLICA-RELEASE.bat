@echo off
rem Professore Digitale - pubblica la Release su GitHub senza passare dal sito (vale per ogni versione).
rem Va nella cartella rilascio-X.Y.Z: la versione si legge dal nome di NOTE-X.Y.Z.md.
rem Autore: Danilo D'Auria - Licenza MIT
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set REPO=__REPO__
set VER=
for %%N in (NOTE-*.md) do set NOTE=%%N
if not defined NOTE (echo  Manca il file NOTE-X.Y.Z.md in questa cartella. & pause & exit /b 1)
set VER=%NOTE:~5,-3%
set TAG=v%VER%
title Professore Digitale %VER% - pubblico la Release su GitHub
echo.
echo  === Pubblico la Release %TAG% di %REPO% ===
echo.

rem --- 1. Trovo il programma "gh" (GitHub CLI) ---
set GH=gh
call gh --version >nul 2>nul
if not errorlevel 1 goto ghok
set GH="%ProgramFiles%\GitHub CLI\gh.exe"
if exist %GH% goto ghok
echo  Manca il programma "GitHub CLI". Lo installo adesso da Microsoft (winget)...
winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
if exist %GH% goto ghok
echo.
echo  Non sono riuscito a installarlo. Chiudete questa finestra, riprovate tra poco
echo  oppure scaricatelo da https://cli.github.com e rilanciate questo file.
pause
exit /b 1
:ghok

rem --- 2. Accesso a GitHub (solo la prima volta: si apre il browser) ---
call %GH% auth status >nul 2>nul
if not errorlevel 1 goto authok
echo.
echo  Primo accesso: rispondete con INVIO alle domande (GitHub.com, HTTPS, Login with a web browser).
echo  Copiate il codice che compare, poi incollatelo nella pagina che si apre e premete Authorize.
echo.
call %GH% auth login --hostname github.com --git-protocol https --web
if errorlevel 1 goto errore
:authok

rem --- 3. Riunisco le parti (se ci sono) e controllo le impronte ---
set ERRUNI=
for %%P in (*.00.parte) do call :unisci "%%~nP"
if defined ERRUNI goto errore
set FILES=
for %%F in (*.exe *.deb *.zip) do call :aggiungi "%%F"
if not defined FILES (echo  Non trovo i file da caricare: .exe, .deb, .zip & pause & exit /b 1)
if not exist SHA256SUMS goto senzasomme
echo  Controllo le impronte SHA-256...
powershell -NoProfile -Command "$ok=$true; foreach($r in Get-Content SHA256SUMS){ $p=$r -split '\s+',2; $n=$p[1].Trim('*',' '); $h=(Get-FileHash $n -Algorithm SHA256).Hash.ToLower(); if($h -ne $p[0]){ Write-Host ('  ERRORE: '+$n); $ok=$false } else { Write-Host ('  OK  '+$n) } }; if(-not $ok){ exit 1 }" || goto errore
goto sommeok
:senzasomme
echo  Impronte SHA-256 dei file (GitHub le mostra uguali accanto a ogni file):
powershell -NoProfile -Command "Get-FileHash *.exe,*.deb,*.zip -Algorithm SHA256 | %% { '  ' + $_.Hash.ToLower() + '  ' + (Split-Path $_.Path -Leaf) }"
:sommeok

rem --- 4. Il Push della versione deve essere gia' su GitHub ---
set SUGIT=
for /f "delims=" %%V in ('call %GH% api -H "Accept: application/vnd.github.raw" repos/%REPO%/contents/VERSION 2^>nul') do set SUGIT=%%V
if not "%SUGIT%"=="%VER%" (echo. & echo  Su GitHub la versione e' ancora: %SUGIT% & echo  Fate prima Commit e Push in GitHub Desktop, poi rilanciate questo file. & pause & exit /b 1)
echo  Su GitHub c'e' la versione %VER%: bene.

rem --- 5. Creo la Release (o completo quella gia' iniziata dal sito) ---
echo.
echo  Carico i file: ci vuole qualche minuto, non chiudete la finestra.
call %GH% release view %TAG% -R %REPO% >nul 2>nul
if not errorlevel 1 goto esiste
call %GH% release create %TAG% %FILES% -R %REPO% --target main --title "Professore Digitale %VER%" --notes-file %NOTE% --latest
if errorlevel 1 goto errore
goto fatto
:esiste
echo  La Release %TAG% esiste gia' (forse iniziata dal sito): aggiungo i file mancanti.
call %GH% release upload %TAG% %FILES% -R %REPO% --clobber
if errorlevel 1 goto errore
call %GH% release edit %TAG% -R %REPO% --title "Professore Digitale %VER%" --notes-file %NOTE% --draft=false --latest
if errorlevel 1 goto errore

:fatto
echo.
echo  FATTO! Release pubblicata: https://github.com/%REPO%/releases/tag/%TAG%
echo  Tra qualche minuto il workflow "Pubblica il sito" mette online la %VER%
echo  (controllate la scheda Actions: https://github.com/%REPO%/actions).
echo.
pause
exit /b 0

:aggiungi
set FILES=%FILES% %1
exit /b 0

:unisci
rem %1 = "nome.estensione.00": tolgo ".00" e riunisco le parti, se il file non c'e' gia'
if exist "%~n1" exit /b 0
echo  Riunisco %~n1 ...
copy /b "%~n1.*.parte" "%~n1" >nul
if not exist "%~n1" set ERRUNI=1
exit /b 0

:errore
echo.
echo  Qualcosa non e' andato. Fate una foto a questa finestra e mandatela a Claude.
pause
exit /b 1
