# FM Tool

A comprehensive PDF Watermark and Digital Signature tool with modern web interface.

## Features

### 📄 File Management
- Drag & drop PDF upload with queue management
- Advanced filtering (time-based, status, watermark, signature)
- Bulk operations and file organization
- Real-time file status tracking

### 🏷️ Watermark Module
- **Text Watermarks**: Custom text with full styling control
- **Image Watermarks**: Upload images with percentage-based sizing (10%-200%)
- **Advanced Positioning**: 9-point grid positioning system
- **Rotation & Transparency**: Full rotation (0-360°) with opacity control
- **Mosaic Mode**: Pattern-based watermark application
- **Reset Functionality**: One-click return to default settings

### ✍️ Digital Signature Module  
- **Simple Signature**: Image-based signatures for internal use
- **Digital Signature**: Certificate-based, legally compliant (eIDAS, ESIGN & UETA)
- **Multiple Signature Fields**: Add unlimited signature fields per document
- **Interactive Positioning**: Drag & drop signature field placement
- **Field Customization**: Text, font, size, style, color control
- **Real-time Preview**: Visual signature field positioning

## Stack

- **Backend**: Node.js, Express, Sequelize (MySQL), pdf-lib, node-signpdf, Multer, JWT
- **Frontend**: React (Vite), Material UI, React Router, Drag & Drop
- **PDF Processing**: Advanced PDF manipulation with signature and watermark support

## Setup

### One command (root workspace)

From the project root you can now run both backend and frontend together:

1. Install all dependencies (uses workspaces):

- npm install

2. Start both dev servers:

- npm run rundev

This runs backend (port 4000) and frontend (Vite on 5173 with proxy) concurrently.

### Individual (legacy) setup

Backend:

- Copy `.env.example` to `.env` and set DB creds, JWT_SECRET, PFX_PATH, etc.
- cd backend && npm install && npm run dev

Frontend:

- cd frontend && npm install && npm run dev

## Test credentials (for quick demo)

In development, the JSON database seeds a default admin account you can use to sign in immediately:

- Admin login
  - Email (username): admin
  - Password: 12345

After logging in as admin, open the “Agent” page in the sidebar to create agent accounts (name, email, password). Agent users will log in and see the Dashboard, Watermark, and Signature pages only.

Notes
- If you enable DISABLE_AUTH=true for local experiments, the app bypasses login and treats you as admin. For testing the login flow, keep DISABLE_AUTH unset or false.
- The JSON DB lives at `backend/data/database.json`. In dev, file changes are picked up automatically.

## API

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login with JWT token

### File Management  
- `POST /api/files/upload` - Upload PDF files (auth, multipart)
- `GET /api/files` - List user files (auth)
- `GET /api/files/:id/preview` - Get file preview for signature positioning
- `GET /api/files/:id/download` - Download specific file
- `DELETE /api/files/:id` - Delete specific file
- `POST /api/files/bulk/delete` - Bulk delete files
- `POST /api/files/bulk/download` - Bulk download as ZIP

### Watermark Operations
- `POST /api/watermark/apply` - Apply text/image watermarks (auth)
  - Supports text styling, positioning, rotation, transparency
  - Image watermarks with percentage-based sizing
  - Mosaic pattern application

### Digital Signature Operations  
- `POST /api/signature/sign` - Apply signatures to PDF (auth)
  - `signatureType`: 'simple' | 'digital'
  - `fields`: Array of signature field objects with positioning and styling
- `GET /api/signature/info/:fileId` - Get signature information for file

### Review System (Future Enhancement)
- `POST /api/reviews/:fileId/submit` - Submit for review (auth)
- `POST /api/reviews/:fileId/approve` - Approve document (approver)
- `POST /api/reviews/:fileId/reject` - Reject document (approver)

## Notes

- For dev, Sequelize syncs schema. For prod, use migrations via sequelize-cli.
- Static files served at /static.
