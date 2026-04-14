# Kiosk Deployment Guide

This guide details how to deploy the Self-Service Printing Kiosk in a real-world environment.

## 1. Physical Hardware Setup

### Printer Connection

The kiosk system relies on the operating system's printer drivers.

#### Windows (Recommended for easy driver support)

1.  **Connect the Printer**: USB or Network.
2.  **Install Drivers**: Ensure the printer is installed and visible in `Control Panel > Devices and Printers`.
3.  **Set as Default**: Right-click the printer and select "Set as default printer".
4.  **Test**: Print a test page from Windows to confirm it works.
5.  **Note**: The application uses the default printer automatically unless specified otherwise.

#### Linux (Raspberry Pi / Ubuntu)

1.  **Install CUPS**: `sudo apt install cups`
2.  **Add User to Admin Group**: `sudo usermod -a -G lpadmin pi`
3.  **Add Printer**:
    - Open browser: `http://localhost:631`
    - Go to Administration > Add Printer.
    - Follow the steps to add your USB or Network printer.
4.  **Test**: Run `lp -d <printer_name> test.txt` in terminal.

## 2. Software Installation

1.  **Install Node.js**: Download and install Node.js (v18+ recommended) from [nodejs.org](https://nodejs.org/).
2.  **Clone/Copy Source Code**: Place the application folder in a permanent location (e.g., `C:\KioskApp`).
3.  **Install Dependencies**:
    Open a terminal in the folder and run:
    ```bash
    npm install
    ```
4.  **Verify Printer Module**:
    - Windows: The app uses `pdf-to-printer`. Ensure Adobe Reader or SumatraPDF is NOT required (it's bundled).
    - Linux: Ensure `lp` command is available.

## 3. Real-World User Flow (No Password)

The system is designed so users **do not need a password**.

1.  **Kiosk Screen**: Displays a QR Code.
2.  **User Action**: Scans QR code with their phone.
3.  **Authentication**: The QR code contains a unique, encrypted session token (e.g., `http://kiosk.com/upload?session=xyz`).
4.  **Upload**: User uploads a file on their phone.
5.  **Auto-Login**: The Kiosk detects the upload for that session token and automatically logs them in _on the screen_.
6.  **Print**: User clicks print.

**Note**: The "Admin" login (`/admin`) is ONLY for you (the owner) to manage settings. Regular users never see a login screen.

## 4. Running in Kiosk Mode (Full Screen)

To prevent users from closing the app:

### Windows

1.  Create a shortcut to Chrome.
2.  Right-click > Properties > Target.
3.  Append these flags:
    ```
    --kiosk --incognito --disable-pinch --no-user-gesture-required http://localhost:3000
    ```
4.  Add this shortcut to the **Startup** folder so it launches on boot.

### Linux

Edit the autostart file (`/etc/xdg/lxsession/LXDE-pi/autostart` on Pi):

```bash
@chromium-browser --kiosk --incognito http://localhost:3000
```
