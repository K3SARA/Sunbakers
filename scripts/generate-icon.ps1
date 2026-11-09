Add-Type -AssemblyName System.Drawing
$srcPath = "C:\Users\Naveen\.gemini\antigravity\brain\427a156b-6113-4697-bc90-d2f918ead6cc\.user_uploaded\media_1793966198537_9aea6670.png"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# The circle emblem is centered horizontally (x from ~18 to ~705, width ~687) and top vertically (y from ~68 to ~755, height ~687)
# Let's crop the emblem area exactly
$cropX = 18
$cropY = 68
$cropSize = 687

$cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)
$cropped = $src.Clone($cropRect, $src.PixelFormat)

# Resize to standard 512x512
$target = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($target)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.DrawImage($cropped, 0, 0, 512, 512)

# Save as PNG
$target.Save("build\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$target.Save("public\samantha-logo.png", [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$target.Dispose()
$cropped.Dispose()
$src.Dispose()
Write-Output "Successfully generated 512x512 PNG icon!"

