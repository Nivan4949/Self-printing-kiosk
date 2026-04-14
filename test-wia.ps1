$scanner = New-Object -ComObject WIA.DeviceManager
$deviceInfo = $scanner.DeviceInfos | Where-Object { $_.Type -eq 1 } | Select-Object -First 1
if (-not $deviceInfo) {
    Write-Output "No scanner found"
    exit 1
}
Write-Output "Found scanner: $($deviceInfo.Properties['Name'].Value)"
$device = $deviceInfo.Connect()
$item = $device.Items[1]
$image = $item.Transfer("{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}")
$image.SaveFile("test_wia.jpg")
Write-Output "Scan saved to test_wia.jpg"
