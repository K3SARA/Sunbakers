; sunbakers Distributor - NSIS Setup Installer Script
Unicode True

!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "sunbakers Distributor"
OutFile "..\release\sunbakers Distributor Setup 1.0.0.exe"
InstallDir "$LOCALAPPDATA\Programs\sunbakers Distributor"
InstallDirRegKey HKCU "Software\sunbakersDistributor" "InstallDir"
RequestExecutionLevel user

; Icons
!define MUI_ICON "..\release\.icon-ico\icon.ico"
!define MUI_UNICON "..\release\.icon-ico\icon.ico"

; Modern UI Settings
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to sunbakers Distributor Setup"
!define MUI_WELCOMEPAGE_TEXT "This will install sunbakers Distributor Management on your computer.$\r$\n$\r$\nIt is recommended that you close all other applications before continuing.$\r$\n$\r$\nClick Next to continue."
!define MUI_FINISHPAGE_RUN "$INSTDIR\sunbakers Distributor.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch sunbakers Distributor"

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
VIAddVersionKey "ProductName" "sunbakers Distributor"
VIAddVersionKey "CompanyName" "sunbakers & Co."
VIAddVersionKey "LegalCopyright" "Copyright © 2026 sunbakers & Co."
VIAddVersionKey "FileDescription" "sunbakers Distributor Management Offline Setup"
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
    WriteRegStr HKCU "Software\sunbakersDistributor" "InstallDir" "$INSTDIR"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall sunbakers Distributor.exe"
    
    ; Shortcuts in Start Menu
    CreateDirectory "$SMPROGRAMS\sunbakers Distributor"
    CreateShortcut "$SMPROGRAMS\sunbakers Distributor\sunbakers Distributor.lnk" "$INSTDIR\sunbakers Distributor.exe" "" "$INSTDIR\sunbakers Distributor.exe" 0
    CreateShortcut "$SMPROGRAMS\sunbakers Distributor\Uninstall sunbakers Distributor.lnk" "$INSTDIR\Uninstall sunbakers Distributor.exe" "" "$INSTDIR\Uninstall sunbakers Distributor.exe" 0
    
    ; Shortcut on Desktop
    CreateShortcut "$DESKTOP\sunbakers Distributor.lnk" "$INSTDIR\sunbakers Distributor.exe" "" "$INSTDIR\sunbakers Distributor.exe" 0
    
    ; Add/Remove Programs Registry Entries
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sunbakersDistributor" "DisplayName" "sunbakers Distributor"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sunbakersDistributor" "DisplayVersion" "1.0.0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sunbakersDistributor" "Publisher" "sunbakers & Co."
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sunbakersDistributor" "DisplayIcon" "$INSTDIR\sunbakers Distributor.exe,0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sunbakersDistributor" "UninstallString" '"$INSTDIR\Uninstall sunbakers Distributor.exe"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sunbakersDistributor" "QuietUninstallString" '"$INSTDIR\Uninstall sunbakers Distributor.exe" /S'
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sunbakersDistributor" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sunbakersDistributor" "NoRepair" 1
SectionEnd

Section "Uninstall"
    ; Remove desktop shortcut
    Delete "$DESKTOP\sunbakers Distributor.lnk"
    
    ; Remove Start Menu shortcuts
    Delete "$SMPROGRAMS\sunbakers Distributor\sunbakers Distributor.lnk"
    Delete "$SMPROGRAMS\sunbakers Distributor\Uninstall sunbakers Distributor.lnk"
    RMDir "$SMPROGRAMS\sunbakers Distributor"
    
    ; Remove registry keys
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\sunbakersDistributor"
    DeleteRegKey HKCU "Software\sunbakersDistributor"
    
    ; Remove installed files and folder
    RMDir /r "$INSTDIR"
SectionEnd

