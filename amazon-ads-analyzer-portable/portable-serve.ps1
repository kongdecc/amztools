$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Join-Path $here "dist"
if (-not (Test-Path -LiteralPath $root)) {
  throw "dist folder not found: $root. Make sure you extracted the full package."
}

$port = $null
$listener = $null
foreach ($p in 8787..8797) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p)
    $listener.Start()
    $port = $p
    break
  } catch {
    $listener = $null
  }
}

if (-not $listener) {
  throw "Cannot listen on ports 8787-8797 (in use or blocked)."
}

$url = "http://127.0.0.1:$port/"
Write-Host "Server started: $url"
try { Start-Process $url | Out-Null } catch { }
Write-Host "Press Ctrl+C to stop"

function Get-ContentType([string]$path) {
  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  switch ($ext) {
    ".html" { "text/html; charset=utf-8" }
    ".js" { "text/javascript; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".svg" { "image/svg+xml" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".gif" { "image/gif" }
    ".webp" { "image/webp" }
    ".ico" { "image/x-icon" }
    ".txt" { "text/plain; charset=utf-8" }
    ".map" { "application/json; charset=utf-8" }
    ".woff" { "font/woff" }
    ".woff2" { "font/woff2" }
    ".ttf" { "font/ttf" }
    default { "application/octet-stream" }
  }
}

function Write-Response {
  param(
    [System.IO.Stream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType
  )

  $headers = @(
    "HTTP/1.1 $StatusCode $StatusText",
    "Content-Type: $ContentType",
    "Content-Length: $($Body.Length)",
    "Cache-Control: no-cache",
    "Connection: close",
    "",
    ""
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
      $requestLine = $reader.ReadLine()
      if (-not $requestLine) { continue }

      $parts = $requestLine.Split(" ")
      $method = $parts[0]
      $rawTarget = if ($parts.Length -ge 2) { $parts[1] } else { "/" }

      while ($true) {
        $line = $reader.ReadLine()
        if ($line -eq $null -or $line -eq "") { break }
      }

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
        Write-Response -Stream $stream -StatusCode 405 -StatusText "Method Not Allowed" -Body $body -ContentType "text/plain; charset=utf-8"
        continue
      }

      $target = $rawTarget.Split("?")[0]
      $target = [System.Uri]::UnescapeDataString($target)
      if ($target -eq "" -or $target -eq "/") { $target = "/index.html" }
      if ($target.EndsWith("/")) { $target = "$target" + "index.html" }

      $relative = $target.TrimStart("/")
      $relative = $relative -replace "/", "\"
      $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
      $rootFull = [System.IO.Path]::GetFullPath($root)
      if (-not $fullPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Bad Request")
        Write-Response -Stream $stream -StatusCode 400 -StatusText "Bad Request" -Body $body -ContentType "text/plain; charset=utf-8"
        continue
      }

      if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $fullPath = Join-Path $root "index.html"
      }

      $contentType = Get-ContentType $fullPath
      $bytes = [System.IO.File]::ReadAllBytes($fullPath)
      if ($method -eq "HEAD") { $bytes = @() }
      Write-Response -Stream $stream -StatusCode 200 -StatusText "OK" -Body $bytes -ContentType $contentType
    } catch {
      try {
        $stream = $client.GetStream()
        $body = [System.Text.Encoding]::UTF8.GetBytes("Internal Server Error")
        Write-Response -Stream $stream -StatusCode 500 -StatusText "Internal Server Error" -Body $body -ContentType "text/plain; charset=utf-8"
      } catch {
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  if ($listener) { $listener.Stop() }
}

