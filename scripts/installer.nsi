; Sun Bakers & Confectionary - NSIS Setup Installer Script
Unicode True

!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "Sun Bakers & Confectionary"
OutFile "..\release\Sun Bakers & Confectionary Setup 1.0.0.exe"
InstallDir "$LOCALAPPDATA\Programs\Sun Bakers & Confectionary"
InstallDirRegKey HKCU "Software\SamanthaDistributor" "InstallDir"
RequestExecutionLevel user

; Icons
!define MUI_ICON "..\release\.icon-ico\icon.ico"
!define MUI_UNICON "..\release\.icon-ico\icon.ico"

; Modern UI Settings
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to Sun Bakers & Confectionary Setup"
!define MUI_WELCOMEPAGE_TEXT "This will install Sun Bakers & Confectionary Management on your computer.$\r$\n$\r$\nIt is recommended that you close all other applications before continuing.$\r$\n$\r$\nClick Next to continue."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Sun Bakers & Confectionary.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Sun Bakers & Confectionary"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

; Version Info
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "Sun Bakers & Confectionary"
VIAddVersionKey "CompanyName" "Samantha & Co."
VIAddVersionKey "LegalCopyright" "Copyright © 2026 Samantha & Co."
VIAddVersionKey "FileDescription" "Sun Bakers & Confectionary Management Offline Setup"
VIAddVersionKey "FileVersion" "1.0.0.0"
VIAddVersionKey "ProductVersion" "1.0.0.0"

Section "Install" SecInstall
    SetOutPath "$INSTDIR"
    
    ; Copy all packaged files
    File /r "..\release\win-unpacked\*.*"
    
    ; Ensure .prisma hidden folder is explicitly included
    SetOutPath "$INSTDIR\resources\node_modules\.prisma"
    File /r "..\release\win-unpacked\resources\node_modules\.prisma\*.*"
    SetOutPath "$INSTDIR"
    
    ; Write the installation path into the registry
    WriteRegStr HKCU "Software\SamanthaDistributor" "InstallDir" "$INSTDIR"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall Sun Bakers & Confectionary.exe"
    
    ; Shortcuts in Start Menu
    CreateDirectory "$SMPROGRAMS\Sun Bakers & Confectionary"
    CreateShortcut "$SMPROGRAMS\Sun Bakers & Confectionary\Sun Bakers & Confectionary.lnk" "$INSTDIR\Sun Bakers & Confectionary.exe" "" "$INSTDIR\Sun Bakers & Confectionary.exe" 0
    CreateShortcut "$SMPROGRAMS\Sun Bakers & Confectionary\Uninstall Sun Bakers & Confectionary.lnk" "$INSTDIR\Uninstall Sun Bakers & Confectionary.exe" "" "$INSTDIR\Uninstall Sun Bakers & Confectionary.exe" 0
    
    ; Shortcut on Desktop
    CreateShortcut "$DESKTOP\Sun Bakers & Confectionary.lnk" "$INSTDIR\Sun Bakers & Confectionary.exe" "" "$INSTDIR\Sun Bakers & Confectionary.exe" 0
    
    ; Add/Remove Programs Registry Entries
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "DisplayName" "Sun Bakers & Confectionary"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "DisplayVersion" "1.0.0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "Publisher" "Samantha & Co."
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "DisplayIcon" "$INSTDIR\Sun Bakers & Confectionary.exe,0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "UninstallString" '"$INSTDIR\Uninstall Sun Bakers & Confectionary.exe"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "QuietUninstallString" '"$INSTDIR\Uninstall Sun Bakers & Confectionary.exe" /S'
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "NoRepair" 1
SectionEnd

Section "Uninstall"
    ; Remove desktop shortcut
    Delete "$DESKTOP\Sun Bakers & Confectionary.lnk"
    
    ; Remove Start Menu shortcuts
    Delete "$SMPROGRAMS\Sun Bakers & Confectionary\Sun Bakers & Confectionary.lnk"
    Delete "$SMPROGRAMS\Sun Bakers & Confectionary\Uninstall Sun Bakers & Confectionary.lnk"
    RMDir "$SMPROGRAMS\Sun Bakers & Confectionary"
    
    ; Remove registry keys
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor"
    DeleteRegKey HKCU "Software\SamanthaDistributor"
    
    ; Remove installed files and folder
    RMDir /r "$INSTDIR"
SectionEnd

