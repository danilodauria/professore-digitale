; ==============================================================================
;  PROFESSORE DIGITALE - installatore per Windows (da XP SP3 a Windows 11, 32 e 64 bit)
;  Ideato e sviluppato da Danilo D'Auria - Codice MIT, contenuti CC BY-NC-SA 4.0
;
;  Si compila da Linux con windows/build-windows.sh (makensis). Opzioni da riga di comando:
;    ProfessoreDigitale-Setup-X.Y.Z.exe /S                 installazione silenziosa
;    ProfessoreDigitale-Setup-X.Y.Z.exe /S /AllUsers       per tutti gli utenti (aule: serve amministratore)
;    ProfessoreDigitale-Setup-X.Y.Z.exe /S /CurrentUser    solo per l'utente attuale (senza password)
;  Progressi e impostazioni degli allievi NON vengono mai toccati dagli aggiornamenti.
; ==============================================================================
Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 32
ManifestDPIAware true
ManifestSupportedOS all

!define NOME "Professore Digitale"
!define EDITORE "Danilo D'Auria"
!define CHIAVE "ProfessoreDigitale"
!define ESEGUIBILE "ProfessoreDigitale.exe"

Name "${NOME} ${VERSIONE}"
OutFile "${USCITA}"
!ifdef FIRMA
  ; firma digitale dell'installatore e del programma di disinstallazione (windows/firma.sh)
  !uninstfinalize '"${FIRMA}" "%1"' = 0
  !finalize '"${FIRMA}" "%1"' = 0
!endif
BrandingText "${NOME} ${VERSIONE} · Danilo D'Auria · MIT e CC BY-NC-SA 4.0"
VIProductVersion "${V1}.${V2}.${V3}.0"
VIAddVersionKey /LANG=1040 "ProductName" "${NOME}"
VIAddVersionKey /LANG=1040 "CompanyName" "${EDITORE}"
VIAddVersionKey /LANG=1040 "FileDescription" "Installazione del Professore Digitale"
VIAddVersionKey /LANG=1040 "FileVersion" "${VERSIONE}"
VIAddVersionKey /LANG=1040 "ProductVersion" "${VERSIONE}"
VIAddVersionKey /LANG=1040 "LegalCopyright" "© 2026 Danilo D'Auria - Codice MIT, contenuti CC BY-NC-SA 4.0"

; ---- per tutti gli utenti (Program Files) oppure solo per me (senza password) ----
!define MULTIUSER_EXECUTIONLEVEL Highest
!define MULTIUSER_MUI
!define MULTIUSER_INSTALLMODE_COMMANDLINE
!define MULTIUSER_INSTALLMODE_INSTDIR "${CHIAVE}"
!define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_KEY "Software\${CHIAVE}"
!define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_VALUENAME "ModoInstallazione"
!define MULTIUSER_INSTALLMODE_INSTDIR_REGISTRY_KEY "Software\${CHIAVE}"
!define MULTIUSER_INSTALLMODE_INSTDIR_REGISTRY_VALUENAME "Cartella"
!include MultiUser.nsh
!include MUI2.nsh
!include LogicLib.nsh
!include x64.nsh
!include WinVer.nsh
!include FileFunc.nsh

!define MUI_ICON "${ICONA}"
!define MUI_UNICON "${ICONA}"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${RISORSE}/welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${RISORSE}/welcome.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "${RISORSE}/header.bmp"
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Volete davvero interrompere l'installazione del Professore Digitale?"

!define MUI_WELCOMEPAGE_TITLE "Benvenuti nel Professore Digitale"
!define MUI_WELCOMEPAGE_TEXT "Il Professore Digitale è un insegnante paziente che vive nel computer: lezioni guidate, risposte a voce, schemi alla lavagna ed esercizi di mouse e tastiera.$\r$\n$\r$\nFunziona SENZA Internet e non invia nessun dato.$\r$\n$\r$\nAl termine potrete attivare, se volete, l'intelligenza artificiale locale e il microfono: il programma controllerà il computer e sceglierà da solo il modello più adatto.$\r$\n$\r$\nPremete Avanti per continuare."
!insertmacro MUI_PAGE_WELCOME
!define MUI_LICENSEPAGE_TEXT_TOP "Codice: licenza MIT. Contenuti: licenza Creative Commons BY-NC-SA 4.0."
!define MUI_LICENSEPAGE_BUTTON "Avanti >"
!define MUI_LICENSEPAGE_TEXT_BOTTOM "È gratuito: potete copiarlo e regalarlo citando l'autore, senza usi commerciali. Premete Avanti per continuare."
!insertmacro MUI_PAGE_LICENSE "${SORGENTE}\LICENZE.txt"
!insertmacro MULTIUSER_PAGE_INSTALLMODE
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "Il Professore Digitale è pronto"
!define MUI_FINISHPAGE_TEXT "L'installazione è terminata.$\r$\n$\r$\nTrovate il Professore sul desktop e nel menu Start. Quando è aperto, la sua icona compare accanto all'orologio."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Apri il Professore Digitale"
!define MUI_FINISHPAGE_RUN_FUNCTION ApriProfessore
!define MUI_FINISHPAGE_SHOWREADME
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Configura subito IA e voce (consigliato, serve Internet)"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION ApriConfigurazione
!define MUI_FINISHPAGE_LINK "Leggi il vademecum (PDF)"
!define MUI_FINISHPAGE_LINK_LOCATION "$INSTDIR\Vademecum_Professore_Digitale_Windows.pdf"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Italian"

; ------------------------------------------------------------------------------
Function un.onInit
  !insertmacro MULTIUSER_UNINIT
FunctionEnd

; alla chiusura dell'installatore si apre UNA sola finestra: la configurazione se richiesta, altrimenti il Professore
Var Apri
Var Configura
Function ApriProfessore
  StrCpy $Apri 1
FunctionEnd
Function ApriConfigurazione
  StrCpy $Configura 1
FunctionEnd
Function .onGUIEnd
  ${If} $Configura == 1
    Exec '"$INSTDIR\${ESEGUIBILE}" --configura'
  ${ElseIf} $Apri == 1
    Exec '"$INSTDIR\${ESEGUIBILE}"'
  ${EndIf}
FunctionEnd

; chiude un Professore gia' aperto (aggiornamento): i dati restano dove sono
!macro ChiudiProfessore
  ${If} ${FileExists} "$INSTDIR\${ESEGUIBILE}"
    DetailPrint "Chiudo il Professore Digitale se è aperto…"
    nsExec::Exec '"$INSTDIR\${ESEGUIBILE}" --stop'
    Pop $0
    Sleep 1500
  ${EndIf}
!macroend

; ------------------------------------------------------------------------------
Section "Professore Digitale (programma, lezioni, quiz, guida, voce)" SEC_APP
  SectionIn RO
  !insertmacro ChiudiProfessore
  SetOutPath "$INSTDIR"
  ; l'interfaccia si sostituisce per intero (niente file vecchi); i dati degli allievi sono altrove
  RMDir /r "$INSTDIR\web"
  RMDir /r "$INSTDIR\contenuti"
  File "${SORGENTE}\${ESEGUIBILE}"
  File "${SORGENTE}\VERSION"
  File "${SORGENTE}\distribuzione.json"
  File "${SORGENTE}\catalogo-ia.json"
  File "${SORGENTE}\LICENZE.txt"
  File "${SORGENTE}\LEGGIMI.txt"
  File "${SORGENTE}\professore.ico"
  File /nonfatal "${SORGENTE}\Vademecum_Professore_Digitale_Windows.pdf"
  File /r "${SORGENTE}\web"
  File /r "${SORGENTE}\contenuti"

  ; menu Start
  CreateDirectory "$SMPROGRAMS\${NOME}"
  CreateShortCut "$SMPROGRAMS\${NOME}\${NOME}.lnk" "$INSTDIR\${ESEGUIBILE}" "" "$INSTDIR\professore.ico" 0 SW_SHOWNORMAL "" "Cattedra digitale offline"
  CreateShortCut "$SMPROGRAMS\${NOME}\Configura IA e voce.lnk" "$INSTDIR\${ESEGUIBILE}" "--configura" "$INSTDIR\professore.ico" 0 SW_SHOWNORMAL "" "Intelligenza artificiale, microfono e voce"
  CreateShortCut "$SMPROGRAMS\${NOME}\Vademecum (PDF).lnk" "$INSTDIR\Vademecum_Professore_Digitale_Windows.pdf"
  CreateShortCut "$SMPROGRAMS\${NOME}\Disinstalla ${NOME}.lnk" "$INSTDIR\Disinstalla.exe"

  ; pannello "Programmi e funzionalità"
  WriteUninstaller "$INSTDIR\Disinstalla.exe"
  WriteRegStr SHCTX "Software\${CHIAVE}" "Cartella" "$INSTDIR"
  WriteRegStr SHCTX "Software\${CHIAVE}" "ModoInstallazione" "$MultiUser.InstallMode"
  WriteRegStr SHCTX "Software\${CHIAVE}" "Versione" "${VERSIONE}"
  !define UNINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\${CHIAVE}"
  WriteRegStr SHCTX "${UNINST}" "DisplayName" "${NOME}"
  WriteRegStr SHCTX "${UNINST}" "DisplayVersion" "${VERSIONE}"
  WriteRegStr SHCTX "${UNINST}" "Publisher" "${EDITORE}"
  WriteRegStr SHCTX "${UNINST}" "DisplayIcon" "$INSTDIR\${ESEGUIBILE},0"
  WriteRegStr SHCTX "${UNINST}" "InstallLocation" "$INSTDIR"
  WriteRegStr SHCTX "${UNINST}" "UninstallString" '"$INSTDIR\Disinstalla.exe" /$MultiUser.InstallMode'
  WriteRegStr SHCTX "${UNINST}" "QuietUninstallString" '"$INSTDIR\Disinstalla.exe" /$MultiUser.InstallMode /S'
  WriteRegStr SHCTX "${UNINST}" "URLInfoAbout" "https://github.com/danilodauria/professore-digitale"
  WriteRegStr SHCTX "${UNINST}" "Comments" "Cattedra digitale offline per l'alfabetizzazione informatica"
  WriteRegDWORD SHCTX "${UNINST}" "NoModify" 1
  WriteRegDWORD SHCTX "${UNINST}" "NoRepair" 1
SectionEnd

Section "Icona sul desktop" SEC_DESK
  CreateShortCut "$DESKTOP\${NOME}.lnk" "$INSTDIR\${ESEGUIBILE}" "" "$INSTDIR\professore.ico" 0 SW_SHOWNORMAL "" "Cattedra digitale offline"
SectionEnd

Section "Microfono offline: motore Vosk (il modello italiano si scarica poi)" SEC_MIC
  ${If} ${RunningX64}
    SetOutPath "$INSTDIR\stt"
    File /r "${SORGENTE}\stt\*.*"
  ${EndIf}
SectionEnd

Section "Voci naturali italiane: Nicola e Giorgio (uomo), Sara, Serena e Paola (donna)" SEC_VOCI
  ${If} ${RunningX64}
    RMDir /r "$INSTDIR\piper"
    SetOutPath "$INSTDIR\piper"
    File /r "${SORGENTE}\piper\*.*"
    RMDir /r "$INSTDIR\kokoro"                               ; dalla 3.8: voce Kokoro (Nicola e Sara)
    SetOutPath "$INSTDIR\kokoro"
    File /r "${SORGENTE}\kokoro\*.*"
    SetOutPath "$INSTDIR\voci"
    Delete "$INSTDIR\voci\it_IT-riccardo-x_low.onnx"        ; dalla 3.3 sostituita da Giorgio
    Delete "$INSTDIR\voci\it_IT-riccardo-x_low.onnx.json"
    File /r "${SORGENTE}\voci\*.*"
    SetOutPath "$INSTDIR"
  ${EndIf}
SectionEnd

Section "-Firewall per l'aula"
  ; il quadro dell'aula riceve i PC degli allievi solo nella rete locale (porte 8766 TCP e 8767 UDP), e solo se attivato;
  ; i tablet dell'aula (3.4) si collegano alla porta TCP 8768, solo se si accende la condivisione
  StrCmp $MultiUser.InstallMode "AllUsers" 0 fw_fine
  ${If} ${AtLeastWinVista}
    nsExec::Exec 'netsh advfirewall firewall delete rule name="Professore Digitale (aula)"'
    Pop $0
    nsExec::Exec 'netsh advfirewall firewall add rule name="Professore Digitale (aula)" dir=in action=allow program="$INSTDIR\${ESEGUIBILE}" enable=yes profile=private,domain'
    Pop $0
    ; tablet dell'aula (3.4): porta TCP 8768, aperta dal programma solo se si accende la condivisione
    nsExec::Exec 'netsh advfirewall firewall delete rule name="Professore Digitale (tablet)"'
    Pop $0
    nsExec::Exec 'netsh advfirewall firewall add rule name="Professore Digitale (tablet)" dir=in action=allow protocol=TCP localport=8768 program="$INSTDIR\${ESEGUIBILE}" enable=yes profile=private,domain'
    Pop $0
  ${Else}
    nsExec::Exec 'netsh firewall add allowedprogram program="$INSTDIR\${ESEGUIBILE}" name="Professore Digitale (aula)" mode=ENABLE scope=SUBNET'
    Pop $0
    nsExec::Exec 'netsh firewall add portopening protocol=TCP port=8768 name="Professore Digitale (tablet)" mode=ENABLE scope=SUBNET'
    Pop $0
  ${EndIf}
  fw_fine:
SectionEnd

Section "-Dimensione"
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${CHIAVE}" "EstimatedSize" "$0"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_APP} "Lezioni, guida interna, lavagna, palestra e voce di Windows. Funziona senza Internet."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_DESK} "Un'icona sul desktop per aprire il Professore con un doppio clic."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_VOCI} "Voci italiane molto naturali, maschili e femminili, già pronte (circa 360 MB, nessun download). Richiedono Windows a 64 bit."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_MIC} "Permette di fare domande a voce. Il modello della lingua italiana (circa 50 MB) si scarica dalla configurazione guidata o dalla chiavetta."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ------------------------------------------------------------------------------
Section "Uninstall"
  ${If} ${FileExists} "$INSTDIR\${ESEGUIBILE}"
    nsExec::Exec '"$INSTDIR\${ESEGUIBILE}" --stop'
    Pop $0
    Sleep 1500
  ${EndIf}
  Delete "$DESKTOP\${NOME}.lnk"
  RMDir /r "$SMPROGRAMS\${NOME}"
  RMDir /r "$INSTDIR\web"
  RMDir /r "$INSTDIR\contenuti"
  RMDir /r "$INSTDIR\stt"
  RMDir /r "$INSTDIR\piper"
  RMDir /r "$INSTDIR\kokoro"
  RMDir /r "$INSTDIR\voci"
  StrCmp $MultiUser.InstallMode "AllUsers" 0 +9
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Professore Digitale (aula)"'
  Pop $0
  nsExec::Exec 'netsh firewall delete allowedprogram program="$INSTDIR\${ESEGUIBILE}"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Professore Digitale (tablet)"'
  Pop $0
  nsExec::Exec 'netsh firewall delete portopening protocol=TCP port=8768'
  Pop $0
  Delete "$INSTDIR\${ESEGUIBILE}"
  Delete "$INSTDIR\VERSION"
  Delete "$INSTDIR\distribuzione.json"
  Delete "$INSTDIR\catalogo-ia.json"
  Delete "$INSTDIR\LICENZE.txt"
  Delete "$INSTDIR\LEGGIMI.txt"
  Delete "$INSTDIR\professore.ico"
  Delete "$INSTDIR\Vademecum_Professore_Digitale_Windows.pdf"
  Delete "$INSTDIR\Disinstalla.exe"
  RMDir "$INSTDIR"
  DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${CHIAVE}"
  DeleteRegKey SHCTX "Software\${CHIAVE}"
  ; i dati personali si tolgono solo se l'utente lo chiede (es. prima di regalare il computer)
  IfSilent fine
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Volete cancellare anche i progressi, le impostazioni e i modelli di IA e voce scaricati da questo utente?$\r$\n$\r$\nScegliete «No» se pensate di reinstallare il Professore." IDNO fine
    SetShellVarContext current
    RMDir /r "$APPDATA\${CHIAVE}"
    RMDir /r "$LOCALAPPDATA\${CHIAVE}"
    MessageBox MB_ICONINFORMATION "Dati del Professore cancellati. Ollama, se installato, si rimuove da Impostazioni di Windows → App."
  fine:
SectionEnd

; ------------------------------------------------------------------------------
Function .onInit
  !insertmacro MULTIUSER_INIT
  ${IfNot} ${AtLeastWinXP}
    MessageBox MB_ICONSTOP "Il Professore Digitale richiede Windows XP (Service Pack 3) o successivo."
    Abort
  ${EndIf}
  ${If} ${IsWinXP}
  ${AndIfNot} ${AtLeastServicePack} 3
    MessageBox MB_ICONEXCLAMATION "Su Windows XP è consigliato il Service Pack 3. L'installazione continua comunque."
  ${EndIf}
  ; i componenti a 64 bit (microfono) solo dove possono funzionare
  ${IfNot} ${RunningX64}
    SectionSetFlags ${SEC_MIC} ${SF_RO}
    SectionSetText ${SEC_MIC} "Microfono (richiede Windows a 64 bit)"
    SectionSetFlags ${SEC_VOCI} ${SF_RO}
    SectionSetText ${SEC_VOCI} "Voci naturali (richiedono Windows a 64 bit)"
  ${EndIf}
FunctionEnd

