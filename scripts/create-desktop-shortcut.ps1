$exe = 'D:\MY_PROJECT\RecallSoro\src-tauri\target\x86_64-pc-windows-msvc\release\recallsoro.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "executable not found: $exe" }

$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$linkPath = Join-Path $desktop 'RecallSoro.lnk'
$shortcut = $shell.CreateShortcut($linkPath)
$shortcut.TargetPath = $exe
$shortcut.WorkingDirectory = 'D:\MY_PROJECT\RecallSoro'
$shortcut.Description = 'RecallSoro - 个人电子经历总台账'
$shortcut.IconLocation = "$exe,0"
$shortcut.Save()

Write-Output "created: $linkPath"
Get-Item -LiteralPath $linkPath | Select-Object FullName, Length, LastWriteTime | Format-List
