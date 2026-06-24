@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Application de PAIE (maides)
echo ============================================================
echo    Application de PAIE - maides
echo ============================================================
echo.

REM 1) Verifier que Node.js est installe
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js n'est pas installe sur cet ordinateur.
  echo     Installez Node.js 20 ou plus depuis https://nodejs.org
  echo     puis double-cliquez de nouveau sur ce fichier.
  echo.
  pause
  exit /b 1
)

REM 2) Installer les composants au tout premier lancement
if not exist "node_modules" (
  echo Premiere utilisation : installation des composants...
  echo Une connexion Internet est necessaire UNE SEULE FOIS.
  echo Les lignes jaunes "WARN" ou "vulnerabilities" sont normales : ignorez-les.
  echo (cela peut prendre une a deux minutes)
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] L'installation des composants a echoue.
    echo     Verifiez que cet ordinateur est connecte a Internet
    echo     -- ou demandez a votre informaticien si un proxy bloque l'acces --
    echo     puis double-cliquez de nouveau sur ce fichier.
    echo.
    pause
    exit /b 1
  )
  echo.
)

REM 3) Ouvrir le navigateur (apres un court delai) puis demarrer le serveur
echo Ouverture du navigateur sur http://localhost:3000 ...
echo Identifiants : admin / admin
echo.
echo  ^>^>^> LAISSEZ CETTE FENETRE OUVERTE pendant l'utilisation. ^<^<^<
echo      Pour arreter l'application : fermez cette fenetre.
echo.
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3000'"
call npm run start:paie -w @maides/server

echo.
echo Le serveur s'est arrete. Vous pouvez fermer cette fenetre.
pause
