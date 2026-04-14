param(
    [string]$OutputPath
)

try {
    # Initialize WIA Device Manager
    $deviceManager = New-Object -ComObject WIA.DeviceManager

    # Check if any scanner is connected
    if ($deviceManager.DeviceInfos.Count -eq 0) {
        Write-Error "No WIA compatible scanner detected."
        exit 1
    }

    # Select the first available scanner (usually Item 1)
    $scanner = $null
    foreach ($info in $deviceManager.DeviceInfos) {
        if ($info.Type -eq 1) { # 1 = ScannerDeviceType
            $scanner = $info.Connect()
            break
        }
    }

    if ($scanner -eq $null) {
        Write-Error "No compatible scanner device found among connected WIA devices."
        exit 1
    }

    # In WIA, the Item[1] represents the flatbed scanner area
    $scanItem = $scanner.Items.Item(1)

    # Trigger the scan (Transfer)
    $image = $scanItem.Transfer()

    # Save the scanned image
    # Note: By default WIA saves in BMP or generic format. We will save it as JPG.
    $image.SaveFile($OutputPath)

    Write-Host "Success: $OutputPath"
    exit 0

} catch {
    Write-Error $_.Exception.Message
    exit 1
}
