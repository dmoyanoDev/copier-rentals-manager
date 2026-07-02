# Firestore Email Queue Polling Service for CopyRent
Write-Output "Iniciando servicio de cola de correos Firestore..."

$pwd = Get-Location
$pidFile = Join-Path $pwd "server_poll.pid"
[System.IO.File]::WriteAllText($pidFile, $pid.ToString())

while ($true) {
    try {
        # 1. Query pending emails
        $query = @{
            structuredQuery = @{
                from = @( @{ collectionId = "email_queue" } )
                where = @{
                    fieldFilter = @{
                        field = @{ fieldPath = "status" }
                        op = "EQUAL"
                        value = @{ stringValue = "pending" }
                    }
                }
            }
        }
        $body = $query | ConvertTo-Json -Depth 10
        $res = Invoke-RestMethod -Uri "https://firestore.googleapis.com/v1/projects/ms-digital-5fd76/databases/(default)/documents:runQuery" -Method POST -Body $body -ContentType "application/json" -ErrorAction SilentlyContinue

        # 2. Iterate pending documents
        foreach ($item in $res) {
            if ($item.document) {
                $docPath = $item.document.name
                $docId = $docPath.Split('/')[-1]
                $fields = $item.document.fields
                
                $to = $fields.to.stringValue
                $subject = $fields.subject.stringValue
                $bodyText = $fields.body.stringValue
                
                $attachmentBase64 = $null
                if ($fields.attachmentBase64) {
                    $attachmentBase64 = $fields.attachmentBase64.stringValue
                }

                Write-Output "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Procesando correo para $to..."

                # 3. Read SMTP settings from Firestore settings/generalSettings
                $settings = Invoke-RestMethod -Uri "https://firestore.googleapis.com/v1/projects/ms-digital-5fd76/databases/(default)/documents/settings/generalSettings" -ErrorAction SilentlyContinue
                $smtp = $settings.fields.smtp.mapValue.fields
                
                if ($smtp.enabled.booleanValue -and $to) {
                    $hostName = $smtp.host.stringValue
                    $smtpPort = [int]$smtp.port.stringValue
                    $user = $smtp.user.stringValue
                    $pass = $smtp.pass.stringValue
                    $fromEmail = $smtp.fromEmail.stringValue
                    
                    $fromName = ""
                    if ($smtp.fromName) {
                        $fromName = $smtp.fromName.stringValue
                    }

                    # Send Email via SMTP
                    try {
                        $smtpClient = New-Object System.Net.Mail.SmtpClient($hostName, $smtpPort)
                        $smtpClient.EnableSsl = $true
                        $smtpClient.Credentials = New-Object System.Net.NetworkCredential($user, $pass)

                        $mail = New-Object System.Net.Mail.MailMessage
                        if ($fromName) {
                            $mail.From = New-Object System.Net.Mail.MailAddress($fromEmail, $fromName)
                        } else {
                            $mail.From = $fromEmail
                        }
                        $mail.To.Add($to)
                        $mail.Subject = $subject
                        $mail.Body = $bodyText.Replace("\n", "<br>")
                        $mail.IsBodyHtml = $true

                        # Handle attachment if base64 is present
                        $tempFile = $null
                        if ($attachmentBase64) {
                            $base64Data = $attachmentBase64
                            if ($base64Data.Contains(",")) {
                                $base64Data = $base64Data.Split(",")[1]
                            }
                            $bytes = [System.Convert]::FromBase64String($base64Data)
                            $tempFile = [System.IO.Path]::GetTempFileName() + ".pdf"
                            [System.IO.File]::WriteAllBytes($tempFile, $bytes)
                            
                            $att = New-Object System.Net.Mail.Attachment($tempFile)
                            $mail.Attachments.Add($att)
                        }

                        $smtpClient.Send($mail)

                        if ($mail.Attachments.Count -gt 0) {
                            foreach ($att in $mail.Attachments) { $att.Dispose() }
                        }
                        $mail.Dispose()
                        $smtpClient.Dispose()

                        if ($tempFile -and (Test-Path $tempFile)) { Remove-Item $tempFile -Force }

                        # Update Firestore status to 'sent'
                        $updateBody = @{ fields = @{ 
                            status = @{ stringValue = "sent" }
                            to = @{ stringValue = $to }
                            subject = @{ stringValue = $subject }
                            body = @{ stringValue = $bodyText }
                        } } | ConvertTo-Json -Depth 10
                        $updateUrl = "https://firestore.googleapis.com/v1/$docPath`?updateMask.fieldPaths=status"
                        Invoke-RestMethod -Uri $updateUrl -Method PATCH -Body $updateBody -ContentType "application/json" -ErrorAction SilentlyContinue
                        
                        Write-Output "  Correo enviado con éxito."
                    } catch {
                        $errMsg = $_.Exception.Message
                        Write-Output "  Error enviando: $errMsg"
                        
                        # Update Firestore status to 'error' and save error message
                        $updateBody = @{ fields = @{ 
                            status = @{ stringValue = "error" }
                            errorMsg = @{ stringValue = $errMsg }
                            to = @{ stringValue = $to }
                            subject = @{ stringValue = $subject }
                            body = @{ stringValue = $bodyText }
                        } } | ConvertTo-Json -Depth 10
                        $updateUrl = "https://firestore.googleapis.com/v1/$docPath`?updateMask.fieldPaths=status&updateMask.fieldPaths=errorMsg"
                        Invoke-RestMethod -Uri $updateUrl -Method PATCH -Body $updateBody -ContentType "application/json" -ErrorAction SilentlyContinue
                    }
                } else {
                    Write-Output "  SMTP no habilitado en Firestore o destinatario vacío."
                }
            }
        }
    } catch {
        Write-Output "  Error general en el ciclo de cola: $_"
    }
    Start-Sleep -Seconds 5
}
