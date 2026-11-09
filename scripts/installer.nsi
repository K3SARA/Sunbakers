; Samantha Distributor - NSIS Setup Installer Script
Unicode True

!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "Samantha Distributor"
OutFile "..\release\Samantha Distributor Setup 1.0.0.exe"
InstallDir "$LOCALAPPDATA\Programs\Samantha Distributor"
InstallDirRegKey HKCU "Software\SamanthaDistributor" "InstallDir"
RequestExecutionLevel user

; Icons
!define MUI_ICON "..\release\.icon-ico\icon.ico"
!define MUI_UNICON "..\release\.icon-ico\icon.ico"

; Modern UI Settings
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to Samantha Distributor Setup"
!define MUI_WELCOMEPAGE_TEXT "This will install Samantha Distributor Management on your computer.$\r$\n$\r$\nIt is recommended that you close all other applications before continuing.$\r$\n$\r$\nClick Next to continue."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Samantha Distributor.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Samantha Distributor"

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
VIAddVersionKey "ProductName" "Samantha Distributor"
VIAddVersionKey "CompanyName" "Samantha & Co."
VIAddVersionKey "LegalCopyright" "Copyright © 2026 Samantha & Co."
VIAddVersionKey "FileDescription" "Samantha Distributor Management Offline Setup"
VIAddVersionKey "FileVersion" "1.0.0.0"
VIAddVersionKey "ProductVersion" "1.0.0.0"

Section "Install" SecInstall
    SetOutPath "$INSTDIR"
    
    ; Copy all packaged files
    File /r "..\release\win-unpacked\*.*"
    
    ; Write the installation path into the registry
    WriteRegStr HKCU "Software\SamanthaDistributor" "InstallDir" "$INSTDIR"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall Samantha Distributor.exe"
    
    ; Shortcuts in Start Menu
    CreateDirectory "$SMPROGRAMS\Samantha Distributor"
    CreateShortcut "$SMPROGRAMS\Samantha Distributor\Samantha Distributor.lnk" "$INSTDIR\Samantha Distributor.exe" "" "$INSTDIR\Samantha Distributor.exe" 0
    CreateShortcut "$SMPROGRAMS\Samantha Distributor\Uninstall Samantha Distributor.lnk" "$INSTDIR\Uninstall Samantha Distributor.exe" "" "$INSTDIR\Uninstall Samantha Distributor.exe" 0
    
    ; Shortcut on Desktop
    CreateShortcut "$DESKTOP\Samantha Distributor.lnk" "$INSTDIR\Samantha Distributor.exe" "" "$INSTDIR\Samantha Distributor.exe" 0
    
    ; Add/Remove Programs Registry Entries
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "DisplayName" "Samantha Distributor"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "DisplayVersion" "1.0.0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "Publisher" "Samantha & Co."
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "DisplayIcon" "$INSTDIR\Samantha Distributor.exe,0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "UninstallString" '"$INSTDIR\Uninstall Samantha Distributor.exe"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "QuietUninstallString" '"$INSTDIR\Uninstall Samantha Distributor.exe" /S'
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor" "NoRepair" 1
SectionEnd

Section "Uninstall"
    ; Remove desktop shortcut
    Delete "$DESKTOP\Samantha Distributor.lnk"
    
    ; Remove Start Menu shortcuts
    Delete "$SMPROGRAMS\Samantha Distributor\Samantha Distributor.lnk"
    Delete "$SMPROGRAMS\Samantha Distributor\Uninstall Samantha Distributor.lnk"
    RMDir "$SMPROGRAMS\Samantha Distributor"
    
    ; Remove registry keys
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SamanthaDistributor"
    DeleteRegKey HKCU "Software\SamanthaDistributor"
    
    ; Remove installed files and folder
    RMDir /r "$INSTDIR"
SectionEnd

