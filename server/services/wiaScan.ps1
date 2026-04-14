param(
    [string]$OutputPath
)
try {
    $scanner = New-Object -ComObject WIA.DeviceManager
    $deviceInfo = $scanner.DeviceInfos | Where-Object { $_.Type -eq 1 } | Select-Object -First 1
    if (-not $deviceInfo) {
        Write-Output "No scanner found"
        exit 1
    }
    Write-Output "Connecting to scanner: $($deviceInfo.Properties['Name'].Value)"
    $device = $deviceInfo.Connect()
    $item = $device.Items[1]
    
    Write-Output "Scanning..."
    # Always transfer as BMP natively to prevent EPSON driver coercion
    $image = $item.Transfer("{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}")
    
    Write-Output "Converting to JPEG internally via WIA..."
    $imageProcess = New-Object -ComObject WIA.ImageProcess
    $convertFilter = $imageProcess.FilterInfos.Item("Convert").FilterID
    $imageProcess.Filters.Add($convertFilter)
    
    # 0x0000F81E == WIA_FORMAT_JPEG
    $imageProcess.Filters.Item(1).Properties.Item("FormatID").Value = "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}"
    $imageProcess.Filters.Item(1).Properties.Item("Quality").Value = 90
    
    $jpegImage = $imageProcess.Apply($image)

    if (Test-Path $OutputPath) {
        Remove-Item $OutputPath -Force
    }
    
    $jpegImage.SaveFile($OutputPath)
    Write-Output "Success"
    exit 0
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
}
