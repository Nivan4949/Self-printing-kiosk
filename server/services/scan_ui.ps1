Add-Type -AssemblyName System.Windows.Forms
$wiaDialog = New-Object -ComObject WIA.CommonDialog

try {
    # DeviceType: 0 (Unspecified), Intent: 0 (Unspecified), Bias: 131072 (MaximizeQuality), FormatID: JPEG
    $image = $wiaDialog.ShowAcquireImage(0, 0, 131072, "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}", $false, $true, $false)
    if ($image -and $image.FileData) {
        $outFile = $args[0]
        if (Test-Path $outFile) { Remove-Item $outFile }
        $image.SaveFile($outFile)
        Write-Output "SUCCESS"
    } else {
        Write-Output "CANCELLED"
    }
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
