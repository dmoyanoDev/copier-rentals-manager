# Servidor HTTP CopyRent nativo de Windows (PowerShell)
$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    # Si el puerto 8000 está en uso, usar el 8080
    $port = 8080
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
}

Write-Output "Servidor CopyRent activo en: http://localhost:$port/index.html"
Write-Output "Presiona Ctrl+C para detener."

# Bucle para manejar peticiones
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $url = $request.Url.LocalPath
        # Redirigir la raíz a index.html
        if ($url -eq "/") { $url = "/index.html" }

        if ($url -eq "/api/send-email") {
            try {
                # Read the POST request body
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()

                # Parse JSON body
                $data = $body | ConvertFrom-Json

                $hostName = $data.Host
                $smtpPort = [int]$data.Port
                $user = $data.Username
                $pass = $data.Password
                $to = $data.To
                $from = $data.From
                $subject = $data.Subject
                $htmlBody = $data.Body

                $smtp = New-Object System.Net.Mail.SmtpClient($hostName, $smtpPort)
                $smtp.EnableSsl = $true
                $smtp.Credentials = New-Object System.Net.NetworkCredential($user, $pass)

                $mail = New-Object System.Net.Mail.MailMessage
                $mail.From = $from
                $mail.To.Add($to)
                $mail.Subject = $subject
                $mail.Body = $htmlBody
                $mail.IsBodyHtml = $true

                $attachmentPath = $data.Attachment
                if ($attachmentPath) {
                    $cleanAttachment = $attachmentPath.TrimStart('/')
                    $fullAttachmentPath = Join-Path $pwd $cleanAttachment
                    if (Test-Path $fullAttachmentPath -PathType Leaf) {
                        $att = New-Object System.Net.Mail.Attachment($fullAttachmentPath)
                        $mail.Attachments.Add($att)
                    }
                }

                $smtp.Send($mail)
                if ($mail.Attachments.Count -gt 0) {
                    foreach ($att in $mail.Attachments) { $att.Dispose() }
                }
                $mail.Dispose()
                $smtp.Dispose()

                $response.StatusCode = 200
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes("OK")
                $response.ContentType = "text/plain; charset=utf-8"
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            } catch {
                $response.StatusCode = 500
                $errMsg = $_.Exception.Message
                if (!$errMsg) { $errMsg = $_.ToString() }
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Error: $errMsg")
                $response.ContentType = "text/plain; charset=utf-8"
                $response.ContentLength64 = $errBytes.Length
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
            $response.Close()
            continue
        }

        if ($url -eq "/api/upload-pdf") {
            try {
                $filename = $request.QueryString["filename"]
                if (!$filename) { $filename = "upload_" + (Get-Date -Format "yyyyMMddHHmmss") + ".pdf" }
                $filename = [System.IO.Path]::GetFileName($filename)
                
                $targetDir = Join-Path $pwd "fichas"
                if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
                $targetPath = Join-Path $targetDir $filename

                $inputStream = $request.InputStream
                $fileStream = New-Object System.IO.FileStream($targetPath, [System.IO.FileMode]::Create)
                $inputStream.CopyTo($fileStream)
                $fileStream.Close()

                $relativeUrl = "/fichas/" + $filename

                $response.StatusCode = 200
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes($relativeUrl)
                $response.ContentType = "text/plain; charset=utf-8"
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            } catch {
                $response.StatusCode = 500
                $errMsg = $_.Exception.Message
                if (!$errMsg) { $errMsg = $_.ToString() }
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Error: $errMsg")
                $response.ContentType = "text/plain; charset=utf-8"
                $response.ContentLength64 = $errBytes.Length
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
            $response.Close()
            continue
        }

        # Limpiar caracteres inválidos y unir path
        $cleanUrl = $url.TrimStart('/')
        $localPath = Join-Path $pwd $cleanUrl

        if (Test-Path $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            
            # Content types
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $mime = "application/octet-stream"
            if ($ext -eq ".html") { $mime = "text/html; charset=utf-8" }
            elseif ($ext -eq ".css") { $mime = "text/css; charset=utf-8" }
            elseif ($ext -eq ".js") { $mime = "text/javascript; charset=utf-8" }
            elseif ($ext -eq ".json") { $mime = "application/json; charset=utf-8" }
            elseif ($ext -eq ".svg") { $mime = "image/svg+xml" }
            elseif ($ext -eq ".pdf") { $mime = "application/pdf" }

            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("<h1>404 Archivo No Encontrado</h1>")
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    } catch {
        # Ignorar errores de conexión abortada por el navegador y continuar
    }
}
