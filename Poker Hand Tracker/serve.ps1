param([int]$Port = 4321, [string]$Root = $PSScriptRoot)
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "PHT server running on http://localhost:$Port"
$mime = @{
  '.html' = 'text/html;charset=utf-8'
  '.css'  = 'text/css'
  '.js'   = 'application/javascript'
  '.json' = 'application/json'
  '.ico'  = 'image/x-icon'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
  '.woff2'= 'font/woff2'
}
try {
  while ($listener.IsListening) {
    $ctx = $null
    try { $ctx = $listener.GetContext() } catch { break }
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $localPath = $req.Url.LocalPath
      if ($localPath -eq '/' -or $localPath -eq '') { $localPath = '/index.html' }
      $relative = $localPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $file = [System.IO.Path]::Combine($Root, $relative)
      if ([System.IO.File]::Exists($file)) {
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $res.SendChunked = $true
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        $res.SendChunked = $true
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch {
      Write-Host "Request error: $_"
    } finally {
      try { $res.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
