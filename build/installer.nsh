; Custom NSIS pieces for the Windows installer (ADR 0108), pulled in through
; `nsis.include` in electron-builder.yml. The installer is the assisted (wizard)
; form so it can ask two questions on one options page:
;   1. Associate .chd files with this app (double-click to open).
;   2. Enable AI features (seeds the aiFeaturesEnabled preference).
; Both default to ticked. Both are first-run choices: an update (--updated)
; skips the page and leaves everything as the user last left it.
;
; The file association is written here, by hand, instead of through
; electron-builder's global `fileAssociations`, because that registers
; unconditionally. Everything goes under SHELL_CONTEXT (HKCU for the default
; per-user install, so no elevation). Windows' own "default app" choice still
; wins over this, so the first double-click may show an "open with" chooser.

!include nsDialogs.nsh
!include LogicLib.nsh

!define CHD_PROGID "ContextHeavyDiagramTool.Diagram"
!define CHD_BACKUP_VALUE "ContextHeavyDiagramTool.backup"

; electron-builder runs this file twice (installer, then the uninstaller build);
; NSIS warnings are errors here, so variables only the installer uses are not
; declared in the uninstaller pass.
!ifndef BUILD_UNINSTALLER
  Var ChdAssocWanted
  Var ChdAiWanted
  Var ChdAssocBox
  Var ChdAiBox
!endif

; Silent installs never show the page, so the defaults have to be set up front.
!macro customInit
  StrCpy $ChdAssocWanted ${BST_CHECKED}
  StrCpy $ChdAiWanted ${BST_CHECKED}
!macroend

!macro customPageAfterChangeDir
  Function ChdOptionsPageCreate
    ${If} ${isUpdated}
      Abort
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "Setup options" "Choose how ${PRODUCT_NAME} fits in with your system."
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 8u 100% 12u "Open .chd diagram files with this app (double-click to open)"
    Pop $ChdAssocBox
    ${NSD_SetState} $ChdAssocBox $ChdAssocWanted
    ${NSD_CreateLabel} 12u 22u 94% 24u "Untick this if another program, for example an emulator, should keep opening .chd files. You can still open diagrams from File > Open or by dragging them onto the window."
    Pop $0

    ${NSD_CreateCheckbox} 0 58u 100% 12u "Enable AI features (adds an AI menu)"
    Pop $ChdAiBox
    ${NSD_SetState} $ChdAiBox $ChdAiWanted
    ${NSD_CreateLabel} 12u 72u 94% 24u "You can turn this on or off later in Preferences."
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function ChdOptionsPageLeave
    ${NSD_GetState} $ChdAssocBox $ChdAssocWanted
    ${NSD_GetState} $ChdAiBox $ChdAiWanted
  FunctionEnd

  Page custom ChdOptionsPageCreate ChdOptionsPageLeave
!macroend

!macro customInstall
  ${ifNot} ${isUpdated}
    ; Read once by the app on its first run, then ignored (src/main/appPreferences.ts).
    ${If} $ChdAiWanted == ${BST_CHECKED}
      StrCpy $0 "true"
    ${Else}
      StrCpy $0 "false"
    ${EndIf}
    FileOpen $1 "$INSTDIR\install-options.json" w
    FileWrite $1 '{ "aiFeaturesEnabled": $0 }$\r$\n'
    FileClose $1

    ${If} $ChdAssocWanted == ${BST_CHECKED}
      ; Remember whoever owned .chd before us so uninstalling can hand it back.
      ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.chd" ""
      ${If} $0 != ""
      ${AndIf} $0 != "${CHD_PROGID}"
        WriteRegStr SHELL_CONTEXT "Software\Classes\.chd" "${CHD_BACKUP_VALUE}" $0
      ${EndIf}
      WriteRegStr SHELL_CONTEXT "Software\Classes\.chd" "" "${CHD_PROGID}"
      WriteRegNone SHELL_CONTEXT "Software\Classes\.chd\OpenWithProgids" "${CHD_PROGID}"
      WriteRegStr SHELL_CONTEXT "Software\Classes\${CHD_PROGID}" "" "Context-Heavy Diagram"
      WriteRegStr SHELL_CONTEXT "Software\Classes\${CHD_PROGID}\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
      WriteRegStr SHELL_CONTEXT "Software\Classes\${CHD_PROGID}\shell" "" "open"
      WriteRegStr SHELL_CONTEXT "Software\Classes\${CHD_PROGID}\shell\open" "" "Open"
      WriteRegStr SHELL_CONTEXT "Software\Classes\${CHD_PROGID}\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
      ; SHCNE_ASSOCCHANGED: tell Explorer to refresh icons and handlers now.
      System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
    ${EndIf}
  ${endIf}
!macroend

; Removes only what customInstall wrote, and only the .chd default if it still
; points at us. Skipped on an update: the old version's uninstaller runs first
; and must not undo a choice the (skipped) options page cannot re-ask.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.chd" ""
    ${If} $0 == "${CHD_PROGID}"
      ReadRegStr $1 SHELL_CONTEXT "Software\Classes\.chd" "${CHD_BACKUP_VALUE}"
      ${If} $1 != ""
        WriteRegStr SHELL_CONTEXT "Software\Classes\.chd" "" $1
        DeleteRegValue SHELL_CONTEXT "Software\Classes\.chd" "${CHD_BACKUP_VALUE}"
      ${Else}
        DeleteRegValue SHELL_CONTEXT "Software\Classes\.chd" ""
      ${EndIf}
    ${EndIf}
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.chd\OpenWithProgids" "${CHD_PROGID}"
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.chd\OpenWithProgids"
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.chd"
    DeleteRegKey SHELL_CONTEXT "Software\Classes\${CHD_PROGID}"
    Delete "$INSTDIR\install-options.json"
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${endIf}
!macroend
