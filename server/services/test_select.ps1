Add-Type -AssemblyName System.Windows.Forms
$wiaDialog = New-Object -ComObject WIA.CommonDialog
try {
    # 0 for unspecified device type
    $device = $wiaDialog.ShowSelectDevice(0, $false, $false)
    if ($device) {
        Write-Output "DEVICE SELECTED"
    } else {
        Write-Output "CANCELLED"
    }
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
