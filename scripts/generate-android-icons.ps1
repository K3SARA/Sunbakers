Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\Naveen\.gemini\antigravity\brain\574a707d-4522-4d25-a544-43a3ecb40dcc\.user_uploaded\media_1794916192531_cb52d170.jpg"
$baseDir = "android\app\src\main\res"

$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# Clean source: remove top 8 black pixels, draw on clean 720x720 white canvas
$clean = New-Object System.Drawing.Bitmap 720, 720
$gClean = [System.Drawing.Graphics]::FromImage($clean)
$gClean.Clear([System.Drawing.Color]::White)
$gClean.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gClean.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gClean.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$srcRect = New-Object System.Drawing.Rectangle 0, 8, 720, 704
$dstRect = New-Object System.Drawing.Rectangle 0, 8, 720, 704
$gClean.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$gClean.Dispose()

$densities = @(
    @{ name = "mdpi";    launcher = 48;  fg = 108 },
    @{ name = "hdpi";    launcher = 72;  fg = 162 },
    @{ name = "xhdpi";   launcher = 96;  fg = 216 },
    @{ name = "xxhdpi";  launcher = 144; fg = 324 },
    @{ name = "xxxhdpi"; launcher = 192; fg = 432 }
)

foreach ($item in $densities) {
    $d = $item.name
    $lSize = $item.launcher
    $fgSize = $item.fg
    $targetDir = Join-Path $baseDir "mipmap-$d"

    # 1. ic_launcher.png (square with white bg)
    $bmpLauncher = New-Object System.Drawing.Bitmap $lSize, $lSize
    $g = [System.Drawing.Graphics]::FromImage($bmpLauncher)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($clean, 0, 0, $lSize, $lSize)
    $g.Dispose()
    $bmpLauncher.Save((Join-Path $targetDir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpLauncher.Dispose()

    # 2. ic_launcher_round.png (circular crop with transparent outside)
    $bmpRound = New-Object System.Drawing.Bitmap $lSize, $lSize
    $g = [System.Drawing.Graphics]::FromImage($bmpRound)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $lSize, $lSize)
    $g.SetClip($path)
    $g.DrawImage($clean, 0, 0, $lSize, $lSize)
    $g.Dispose()
    $bmpRound.Save((Join-Path $targetDir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpRound.Dispose()

    # 3. ic_launcher_foreground.png (logo in 72dp center safe zone of 108dp canvas)
    $bmpFg = New-Object System.Drawing.Bitmap $fgSize, $fgSize
    $g = [System.Drawing.Graphics]::FromImage($bmpFg)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Scale to ~68% of fgSize for perfect safe zone fitting
    $logoSize = [int]($fgSize * 0.68)
    $offset = [int](($fgSize - $logoSize) / 2)
    $g.DrawImage($clean, $offset, $offset, $logoSize, $logoSize)
    $g.Dispose()
    $bmpFg.Save((Join-Path $targetDir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpFg.Dispose()

    Write-Host "Generated icons for mipmap-$d ($lSize x $lSize, fg $fgSize x $fgSize)"
}

$clean.Dispose()
$src.Dispose()
Write-Host "All Android icons generated successfully!"
