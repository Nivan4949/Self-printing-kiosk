# Self-Service Printing Kiosk

A modern, secure, and user-friendly self-service printing kiosk application. Built with Node.js, Express, and SQLite, featuring mobile uploads via QR code, document preview, and an admin dashboard.

![Kiosk Preview](https://via.placeholder.com/800x400?text=Kiosk+Home+Screen)

## Features

- **User Interface**:
  - Upload files directly from the kiosk.
  - **Mobile Upload**: Scan a QR code to upload files from your phone instantly.
  - **Quick Print**: Access pre-uploaded standard forms for immediate printing.
  - **Document Preview**: Verify your document before printing.
  - **Secure Session**: Each user gets a unique, temporary session.

- **Admin Dashboard**:
  - **Statistics**: Track revenue, total prints, and success rates.
  - **Printer Management**: View connected printers (Mock/IPP).
  - **Pricing Config**: Set prices for B&W and Color prints.
  - **Prepared Files**: Upload and manage standard forms for "Quick Print".
  - **Secure Login**: Token-based authentication (Default: admin/admin).

- **Technical**:
  - **Backend**: Node.js + Express.
  - **Database**: SQLite (Zero configuration).
  - **File Support**: PDF, JPG, PNG (Images auto-converted to PDF).
  - **Remote Access**: Integrated `localtunnel` for public mobile access.

## Installation

1.  **Clone the Repository**:

    ```bash
    git clone <repository-url>
    cd employee-self-service-kiosk
    ```

2.  **Install Dependencies**:

    ```bash
    npm install
    ```

3.  **Environment Setup**:
    - Create a `.env` file (optional, defaults provided):
      ```env
      PORT=3000
      SESSION_SECRET=your_secret_key
      ADMIN_PASSWORD=admin
      ENABLE_TUNNEL=true
      ```

## Usage

1.  **Start the Server**:

    ```bash
    npm run dev
    ```

    - The server will start at `http://localhost:3000`.
    - If `ENABLE_TUNNEL=true`, a public URL will be generated for mobile access.

2.  **Access points**:
    - **Kiosk Interface**: `http://localhost:3000`
    - **Admin Panel**: `http://localhost:3000/admin` (Login: `admin` / `admin`)

3.  **Printing**:
    - This system uses a **Mock Printer** by default for development.
    - Check the server console logs to see "Printing..." messages.

## Project Structure

- `server/`: Backend logic (Controllers, Models, Routes).
- `client/`: Frontend static files (HTML, CSS, JS).
- `uploads/`: Temporary storage for uploaded documents.
- `database/`: SQLite database file (`kiosk.sqlite`).

## Tech Stack

- **Frontend**: HTML5, TailwindCSS, Vanilla JS.
- **Backend**: Node.js, Express.js.
- **Database**: SQLite3.
- **Utilities**: `pdf-lib` (PDF manipulation), `localtunnel` (Tunneling), `multer` (File upload).
