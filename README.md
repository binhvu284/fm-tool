# FM Tool

A PDF Watermark and Digital Signature tool.

## Stack

- Backend: Node.js, Express, Sequelize (MySQL), pdf-lib, node-signpdf, Multer, JWT
- Frontend: React (Vite) + Material UI

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

## API

- POST /api/auth/register
- POST /api/auth/login
- POST /api/files/upload (auth, multipart)
- GET /api/files (auth)
- POST /api/watermark/apply (auth)
- POST /api/signature/sign (auth)
- POST /api/reviews/:fileId/submit (auth)
- POST /api/reviews/:fileId/approve (approver)
- POST /api/reviews/:fileId/reject (approver)

## Notes

- For dev, Sequelize syncs schema. For prod, use migrations via sequelize-cli.
- Static files served at /static.
