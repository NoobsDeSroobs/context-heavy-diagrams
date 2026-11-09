; Adds and removes one folder in the user's PATH (ADR 0162). Included by installer.nsh and by the
; test script (scripts/installerPath.test.mjs), which points CHD_ENV_KEY at a scratch key.
;
; The PATH is HKCU\Environment\Path, a REG_EXPAND_SZ: it is rewritten with WriteRegExpandStr so a
; %USERPROFILE% entry stays one. A value longer than NSIS_MAX_STRLEN (8192 in electron-builder's
; build) is not read as a cut string but as an empty one with the error flag set, which looks like
; a missing PATH and would be overwritten. So ChdPathRead tells the two apart, and a PATH that is
; there but cannot be read, or is near the limit, is left alone.

!include LogicLib.nsh
!include WinMessages.nsh

!ifndef CHD_ENV_ROOT
  !define CHD_ENV_ROOT HKCU
  !define CHD_ENV_KEY "Environment"
!endif
!define CHD_PATH_LIMIT 7000

; Reads the PATH into $R1. $R7 is 1 when it exists but could not be read (too long). Uses $R8, $R9.
!macro ChdPathRead
  ClearErrors
  ReadRegStr $R1 ${CHD_ENV_ROOT} "${CHD_ENV_KEY}" "Path"
  StrCpy $R7 0
  ${If} ${Errors}
    StrCpy $R8 0
    ${Do}
      ClearErrors
      EnumRegValue $R9 ${CHD_ENV_ROOT} "${CHD_ENV_KEY}" $R8
      ${If} ${Errors}
        ${ExitDo}
      ${EndIf}
      ${If} $R9 == "Path"
        StrCpy $R7 1
        ${ExitDo}
      ${EndIf}
      IntOp $R8 $R8 + 1
    ${Loop}
  ${EndIf}
!macroend

; Takes the folder from the stack. Removes every entry equal to it (Windows paths compare without
; regard to case) and writes the PATH only if one was found; an emptied PATH is deleted.
!macro ChdPathRemove un
  Function ${un}ChdPathRemove
    Exch $R0
    Push $R1
    Push $R2
    Push $R3
    Push $R4
    Push $R5
    Push $R6
    Push $R7
    Push $R8
    Push $R9

    !insertmacro ChdPathRead
    StrLen $R2 $R1
    ${If} $R7 == 0
    ${AndIf} $R2 > 0
    ${AndIf} $R2 < ${CHD_PATH_LIMIT}
      ; $R2: position, $R3: the character there, $R4: the entry being read, $R5: what is kept
      ; (every entry followed by ";"), $R6: 1 once an entry was dropped.
      StrCpy $R2 0
      StrCpy $R4 ""
      StrCpy $R5 ""
      StrCpy $R6 0
      ${Do}
        StrCpy $R3 $R1 1 $R2
        ${If} $R3 == ""
        ${OrIf} $R3 == ";"
          ${If} $R4 == $R0
            StrCpy $R6 1
          ${Else}
            StrCpy $R5 "$R5$R4;"
          ${EndIf}
          StrCpy $R4 ""
          ${If} $R3 == ""
            ${ExitDo}
          ${EndIf}
        ${Else}
          StrCpy $R4 "$R4$R3"
        ${EndIf}
        IntOp $R2 $R2 + 1
      ${Loop}
      ${If} $R6 == 1
        StrLen $R2 $R5
        ${If} $R2 > 1
          IntOp $R2 $R2 - 1
          StrCpy $R5 $R5 $R2
          WriteRegExpandStr ${CHD_ENV_ROOT} "${CHD_ENV_KEY}" "Path" $R5
        ${Else}
          DeleteRegValue ${CHD_ENV_ROOT} "${CHD_ENV_KEY}" "Path"
        ${EndIf}
        SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
      ${EndIf}
    ${EndIf}

    Pop $R9
    Pop $R8
    Pop $R7
    Pop $R6
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Pop $R1
    Pop $R0
  FunctionEnd
!macroend

; Takes the folder from the stack and puts it at the end of the PATH, once.
!macro ChdPathAdd
  Function ChdPathAdd
    Exch $R0
    Push $R1
    Push $R2
    Push $R7
    Push $R8
    Push $R9

    Push $R0
    Call ChdPathRemove
    !insertmacro ChdPathRead
    StrLen $R2 $R1
    ${If} $R7 == 0
    ${AndIf} $R2 < ${CHD_PATH_LIMIT}
      ${If} $R1 == ""
        StrCpy $R1 $R0
      ${Else}
        StrCpy $R2 $R1 1 -1
        ${If} $R2 == ";"
          StrCpy $R1 "$R1$R0"
        ${Else}
          StrCpy $R1 "$R1;$R0"
        ${EndIf}
      ${EndIf}
      WriteRegExpandStr ${CHD_ENV_ROOT} "${CHD_ENV_KEY}" "Path" $R1
      SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
    ${EndIf}

    Pop $R9
    Pop $R8
    Pop $R7
    Pop $R2
    Pop $R1
    Pop $R0
  FunctionEnd
!macroend
