param(
  [string]$DesktopRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\apps\desktop')).Path
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$buildDir = Join-Path $DesktopRoot 'build'
$rendererAssetsDir = Join-Path $DesktopRoot 'src\renderer\src\assets'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
New-Item -ItemType Directory -Force -Path $rendererAssetsDir | Out-Null

$svg = @"
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="140" y1="84" x2="884" y2="940" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#28E0C8"/>
      <stop offset="0.45" stop-color="#089B9A"/>
      <stop offset="1" stop-color="#045B78"/>
    </linearGradient>
    <linearGradient id="shield" x1="273" y1="219" x2="749" y2="816" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF" stop-opacity="0.98"/>
      <stop offset="1" stop-color="#DDFCF7" stop-opacity="0.92"/>
    </linearGradient>
    <filter id="shadow" x="55" y="67" width="914" height="914" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="34" stdDeviation="52" flood-color="#053B4A" flood-opacity="0.28"/>
    </filter>
    <filter id="inner" x="157" y="144" width="710" height="730" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#027C7D" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" rx="228" fill="url(#bg)"/>
  <path d="M150 288C258 187 383 139 512 139C641 139 766 187 874 288C845 575 723 773 512 893C301 773 179 575 150 288Z" fill="#FFFFFF" fill-opacity="0.16"/>
  <path d="M201 305C293 224 397 185 512 185C627 185 731 224 823 305C790 542 686 706 512 813C338 706 234 542 201 305Z" fill="#FFFFFF" fill-opacity="0.16"/>
  <g filter="url(#shadow)">
    <path d="M241 319C321 249 413 216 512 216C611 216 703 249 783 319C753 520 666 657 512 746C358 657 271 520 241 319Z" fill="url(#shield)"/>
  </g>
  <g filter="url(#inner)">
    <ellipse cx="512" cy="542" rx="139" ry="117" fill="#078C8D"/>
    <ellipse cx="374" cy="439" rx="64" ry="82" transform="rotate(-24 374 439)" fill="#0BA7A2"/>
    <ellipse cx="650" cy="439" rx="64" ry="82" transform="rotate(24 650 439)" fill="#0BA7A2"/>
    <ellipse cx="455" cy="343" rx="61" ry="82" transform="rotate(-8 455 343)" fill="#11BDB1"/>
    <ellipse cx="569" cy="343" rx="61" ry="82" transform="rotate(8 569 343)" fill="#11BDB1"/>
    <path d="M512 646C486 604 427 579 409 533C392 489 425 447 471 456C491 460 505 472 512 487C519 472 533 460 553 456C599 447 632 489 615 533C597 579 538 604 512 646Z" fill="#FFFFFF"/>
    <path d="M470 552H506V516H538V552H574V584H538V620H506V584H470V552Z" fill="#0A9794"/>
  </g>
  <path d="M244 264C294 215 370 181 447 168" stroke="#FFFFFF" stroke-opacity="0.62" stroke-width="26" stroke-linecap="round"/>
  <circle cx="772" cy="263" r="31" fill="#FFFFFF" fill-opacity="0.34"/>
  <circle cx="812" cy="318" r="15" fill="#FFFFFF" fill-opacity="0.28"/>
</svg>
"@

$iconSvgPath = Join-Path $buildDir 'icon.svg'
$rendererSvgPath = Join-Path $rendererAssetsDir 'vetcare-logo.svg'
[System.IO.File]::WriteAllText($iconSvgPath, $svg, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($rendererSvgPath, $svg, [System.Text.UTF8Encoding]::new($false))

function New-RoundedRectPath {
  param([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius)

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-ShieldPath {
  param([float]$Offset)

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.StartFigure()
  $path.AddBezier(241, 319 + $Offset, 321, 249 + $Offset, 413, 216 + $Offset, 512, 216 + $Offset)
  $path.AddBezier(512, 216 + $Offset, 611, 216 + $Offset, 703, 249 + $Offset, 783, 319 + $Offset)
  $path.AddBezier(783, 319 + $Offset, 753, 520 + $Offset, 666, 657 + $Offset, 512, 746 + $Offset)
  $path.AddBezier(512, 746 + $Offset, 358, 657 + $Offset, 271, 520 + $Offset, 241, 319 + $Offset)
  $path.CloseFigure()
  return $path
}

function Fill-RotatedEllipse {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [float]$Cx,
    [float]$Cy,
    [float]$Rx,
    [float]$Ry,
    [float]$Angle
  )

  $state = $Graphics.Save()
  $Graphics.TranslateTransform($Cx, $Cy)
  $Graphics.RotateTransform($Angle)
  $Graphics.FillEllipse($Brush, -$Rx, -$Ry, $Rx * 2, $Ry * 2)
  $Graphics.Restore($state)
}

function New-HeartPath {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.StartFigure()
  $path.AddBezier(512, 646, 486, 604, 427, 579, 409, 533)
  $path.AddBezier(392, 489, 409, 451, 447, 451, 471, 456)
  $path.AddBezier(491, 460, 505, 472, 509, 480, 512, 487)
  $path.AddBezier(515, 480, 519, 472, 533, 460, 553, 456)
  $path.AddBezier(599, 447, 632, 489, 615, 533, 615, 533)
  $path.AddBezier(597, 579, 538, 604, 512, 646, 512, 646)
  $path.CloseFigure()
  return $path
}

function New-LogoBitmap {
  param([int]$Size)

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.ScaleTransform($Size / 1024, $Size / 1024)

  $backgroundPath = New-RoundedRectPath 0 0 1024 1024 228
  $backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.RectangleF]::new(0, 0, 1024, 1024),
    [System.Drawing.Color]::FromArgb(255, 40, 224, 200),
    [System.Drawing.Color]::FromArgb(255, 4, 91, 120),
    135
  )
  $backgroundBlend = [System.Drawing.Drawing2D.ColorBlend]::new()
  $backgroundBlend.Positions = [single[]](0, 0.48, 1)
  $backgroundBlend.Colors = [System.Drawing.Color[]]@(
    [System.Drawing.Color]::FromArgb(255, 40, 224, 200),
    [System.Drawing.Color]::FromArgb(255, 8, 155, 154),
    [System.Drawing.Color]::FromArgb(255, 4, 91, 120)
  )
  $backgroundBrush.InterpolationColors = $backgroundBlend
  $graphics.FillPath($backgroundBrush, $backgroundPath)

  $softShield = New-ShieldPath 0
  $graphics.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(42, 255, 255, 255)), $softShield)

  $shieldPath = New-ShieldPath 0
  $shieldBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.RectangleF]::new(241, 216, 542, 530),
    [System.Drawing.Color]::FromArgb(252, 255, 255, 255),
    [System.Drawing.Color]::FromArgb(235, 221, 252, 247),
    65
  )
  $graphics.FillPath($shieldBrush, $shieldPath)

  $pawDark = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 7, 140, 141))
  $pawMid = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 10, 167, 162))
  $pawLight = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 17, 189, 177))
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $teal = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 10, 151, 148))

  $graphics.FillEllipse($pawDark, 373, 425, 278, 234)
  Fill-RotatedEllipse $graphics $pawMid 374 439 64 82 -24
  Fill-RotatedEllipse $graphics $pawMid 650 439 64 82 24
  Fill-RotatedEllipse $graphics $pawLight 455 343 61 82 -8
  Fill-RotatedEllipse $graphics $pawLight 569 343 61 82 8

  $heartPath = New-HeartPath
  $graphics.FillPath($white, $heartPath)
  $graphics.FillRectangle($teal, 470, 552, 104, 32)
  $graphics.FillRectangle($teal, 506, 516, 32, 104)

  $highlightPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(155, 255, 255, 255), 26)
  $highlightPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $highlightPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawBezier($highlightPen, 244, 264, 294, 215, 370, 181, 447, 168)
  $graphics.FillEllipse([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(84, 255, 255, 255)), 741, 232, 62, 62)
  $graphics.FillEllipse([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(72, 255, 255, 255)), 797, 303, 30, 30)

  $graphics.Dispose()
  return $bitmap
}

function Get-PngBytes {
  param([int]$Size)

  $bitmap = New-LogoBitmap $Size
  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  return $stream.ToArray()
}

$pngPath = Join-Path $buildDir 'icon.png'
$bitmap1024 = New-LogoBitmap 1024
$bitmap1024.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap1024.Dispose()

$png256Path = Join-Path $buildDir 'icon-256.png'
$bitmap256 = New-LogoBitmap 256
$bitmap256.Save($png256Path, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap256.Dispose()

$icoPath = Join-Path $buildDir 'icon.ico'
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$entries = foreach ($size in $sizes) {
  [pscustomobject]@{
    Size = $size
    Bytes = Get-PngBytes $size
  }
}

$file = [System.IO.File]::Create($icoPath)
try {
  $writer = [System.IO.BinaryWriter]::new($file)
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$entries.Count)

  $offset = 6 + (16 * $entries.Count)
  foreach ($entry in $entries) {
    $iconSize = if ($entry.Size -ge 256) { 0 } else { $entry.Size }
    $writer.Write([byte]$iconSize)
    $writer.Write([byte]$iconSize)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$entry.Bytes.Length)
    $writer.Write([UInt32]$offset)
    $offset += $entry.Bytes.Length
  }

  foreach ($entry in $entries) {
    $writer.Write([byte[]]$entry.Bytes)
  }
} finally {
  if ($writer) { $writer.Dispose() }
  $file.Dispose()
}

Write-Host "Generated brand assets:"
Write-Host "- $iconSvgPath"
Write-Host "- $pngPath"
Write-Host "- $png256Path"
Write-Host "- $icoPath"
Write-Host "- $rendererSvgPath"
