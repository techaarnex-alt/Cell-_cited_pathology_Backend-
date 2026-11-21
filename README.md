# Cell Cited Pathology Lab (CCPL) - Backend API

Production-ready backend for **Cell Cited Pathology Lab (CCPL)**, Barabanki.
Built with Node.js, Express.js, MongoDB Atlas, Mongoose, and Strict MVC Architecture.

---

## Table of Contents

1. [Architectural Overview](#architectural-overview)
2. [Folder Structure](#folder-structure)
3. [Core Technologies](#core-technologies)
4. [Database Models & Tenancy](#database-models--tenancy)
5. [API Modules & Endpoints](#api-modules--endpoints)
6. [Business Logic & Invariants](#business-logic--invariants)
7. [Security & Performance Optimizations](#security--performance-optimizations)
8. [Swagger & OpenAPI 3.0 Automation](#swagger--openapi-30-automation)
9. [Environment Variables](#environment-variables)
10. [Installation & Execution](#installation--execution)
11. [Testing & Verification](#testing--verification)

---

## 1. Architectural Overview

The backend adheres strictly to the **MVC (Model-View-Controller)** pattern with a dedicated **Service Layer**:

- **Models**: Mongoose schemas with compound indexes, timestamps, soft-delete flags, and schema-level validation.
- **Controllers**: Handle HTTP requests and responses, delegate orchestration to services, and format standardized responses.
- **Services**: Encapsulate all business logic, transactions, demographic/pricing snapshots, and audit trail events.
- **Routes**: RESTful endpoint declarations with JSDoc OpenAPI 3.0 annotations and middleware chains.
- **Middlewares**: JWT authentication, role-based authorization, request ID tracking (`X-Request-Id`), Joi schema validation, and centralized error handling.
- **Config**: Connection-pooled MongoDB Atlas configuration with DNS resolution resilience and Swagger options.
- **Utils**: Custom operational errors (`ApiError`), structured logging (`logger`), response formatters, and reference range interpreters.

---

## 2. Folder Structure

```text
Cell_cited_Backend/
│
├── src/
│   ├── config/
│   │   ├── db.js               # MongoDB connection pooling & DNS fallback
│   │   ├── env.js              # Environment variable loading & validation
│   │   └── swagger.js          # Swagger JSDoc / OpenAPI 3.0 configuration
│   │
│   ├── constants/
│   │   ├── errorCodes.js       # Standardized error codes
│   │   ├── roles.js            # Laboratory user roles
│   │   └── status.js           # Report, Invoice & Payment statuses
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── billing.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── doctor.controller.js
│   │   ├── document.controller.js
│   │   ├── health.controller.js
│   │   ├── laboratory.controller.js
│   │   ├── patient.controller.js
│   │   ├── report.controller.js
│   │   ├── test.controller.js
│   │   └── testGroup.controller.js
│   │
│   ├── middlewares/
│   │   ├── auth.js             # authenticate & authorize middlewares
│   │   ├── errorHandler.js     # Centralized error handler
│   │   ├── notFoundHandler.js  # 404 handler
│   │   ├── requestId.js        # Request ID tracking (X-Request-Id)
│   │   └── validate.js         # Joi schema validation middleware
│   │
│   ├── models/
│   │   ├── AuditEvent.js       # Immutable audit log
│   │   ├── Doctor.js           # Referring doctors directory
│   │   ├── Document.js         # Report & Invoice PDF document artifacts
│   │   ├── Invoice.js          # Billing invoices
│   │   ├── Laboratory.js       # Laboratory profile & tenancy boundary
│   │   ├── Patient.js          # Patient demographics & index
│   │   ├── Payment.js          # Append-only payment ledger
│   │   ├── Report.js           # Investigation reports & snapshots
│   │   ├── ReportItem.js       # Investigation test snapshots & results
│   │   ├── Test.js             # Catalogue investigations master
│   │   ├── TestGroup.js        # Panels / Profiles (CBC, LFT, etc.)
│   │   ├── User.js             # Laboratory staff accounts & bcrypt auth
│   │   └── index.js            # Model exports aggregator
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── billing.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── doctor.routes.js
│   │   ├── document.routes.js
│   │   ├── health.routes.js
│   │   ├── laboratory.routes.js
│   │   ├── patient.routes.js
│   │   ├── report.routes.js
│   │   ├── test.routes.js
│   │   ├── testGroup.routes.js
│   │   └── index.js            # API v1 route aggregator
│   │
│   ├── services/
│   │   ├── audit.service.js
│   │   ├── auth.service.js
│   │   ├── billing.service.js
│   │   ├── dashboard.service.js
│   │   ├── doctor.service.js
│   │   ├── document.service.js
│   │   ├── laboratory.service.js
│   │   ├── patient.service.js
│   │   ├── report.service.js
│   │   ├── test.service.js
│   │   └── testGroup.service.js
│   │
│   ├── utils/
│   │   ├── ApiError.js         # Operational error class
│   │   ├── catchAsync.js       # Async handler wrapper
│   │   ├── logger.js           # Redacted structured logger
│   │   ├── referenceRange.js   # Biological range parsing & flags
│   │   ├── response.js         # Standard success and error responses
│   │   └── seeder.js           # Initial database seeder
│   │
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── billing.validator.js
│   │   ├── doctor.validator.js
│   │   ├── patient.validator.js
│   │   ├── report.validator.js
│   │   ├── test.validator.js
│   │   └── testGroup.validator.js
│   │
│   ├── app.js                  # Express app setup & middleware pipeline
│   └── server.js               # Server bootstrap & graceful shutdown
│
├── scripts/
│   └── generateSwagger.js      # Swagger JSON generator script
│
├── swagger/
│   └── swagger.json            # Auto-generated OpenAPI 3.0 specification
│
├── tests/
│   └── runner.js               # 25-step automated integration test suite
│
├── .env                        # Active environment configuration
├── .env.example                # Sample environment template
├── .gitignore
├── package.json
└── README.md
```

---

## 3. Core Technologies

- **Runtime**: Node.js (v20+)
- **Framework**: Express.js
- **Database**: MongoDB Atlas via Mongoose
- **Language**: JavaScript (ES6+ CommonJS)
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
- **Validation**: `joi`
- **API Documentation**: `swagger-ui-express` & `swagger-jsdoc` (OpenAPI 3.0)
- **Security**: `helmet`, `cors`, `express-rate-limit`, `compression`, `morgan`
- **Testing**: `supertest` with custom assertion runner

---

## 4. Database Models & Tenancy

All operational models carry `laboratoryId` to guarantee laboratory-level data isolation.

| # | Model | Collection | Primary Responsibility |
|---|-------|------------|------------------------|
| 1 | `Laboratory` | `laboratories` | Establishment credentials, letterhead/watermark assets, Barabanki registration. |
| 2 | `User` | `users` | Staff credentials with bcrypt hashing and RBAC (`administrator`, `pathologist`, `technician`, `receptionist`, `billing`, `read-only auditor`). |
| 3 | `Patient` | `patients` | Patient demographics (`CCPL-0001`), compound text search indexes on name and mobile. |
| 4 | `Doctor` | `doctors` | Directory of referring clinicians (`DR-001`) with agreed referral percentage. |
| 5 | `Test` | `tests` | Master catalogue of laboratory investigations with ranges, units, rates, alertable flags. |
| 6 | `TestGroup` | `testgroups` | Predefined investigation panels (CBC, LFT, RFT, Lipid, Diabetes, Thyroid, etc.). |
| 7 | `Report` | `reports` | Clinical investigation reports (`CCPL-R-0001`) with frozen patient and doctor snapshots. |
| 8 | `ReportItem` | Embedded / `reportitems` | Immutable clinical snapshot of test definition, pricing, observed value, and out-of-range flag. |
| 9 | `Invoice` | `invoices` | Billing tax invoices (`CCPL/INV/0001`) linked to reports with balance tracking. |
| 10 | `Payment` | `payments` | Append-only payment ledger entries with methods (Cash, UPI, Card, Net Banking). |
| 11 | `Document` | `documents` | PDF render requests and downloadable artifacts with audit trails. |
| 12 | `AuditEvent` | `auditevents` | Append-only clinical and billing audit logs capturing actor, action, before/after JSON. |

---

## 5. API Modules & Endpoints

Base URL prefix: `/api/v1`

### Authentication
- `POST /api/v1/auth/login` - Staff login; returns JWT access token.
- `GET /api/v1/me` - Read current user profile and laboratory context.

### Patients
- `GET /api/v1/patients` - List/search patients with pagination (`search`, `page`, `limit`).
- `POST /api/v1/patients` - Register patient; supports atomic Draft report creation when tests are selected.
- `GET /api/v1/patients/:id` - Read patient demographics and report history.
- `PATCH /api/v1/patients/:id` - Update patient demographics.

### Doctors & Earnings
- `GET /api/v1/doctors` - List referring doctors directory.
- `POST /api/v1/doctors` - Register new referring doctor.
- `PATCH /api/v1/doctors/:id` - Update doctor details and referral percentage.
- `GET /api/v1/doctors/:id/earnings` - Calculate historical referral earnings strictly from snapshot percentages.

### Tests Catalogue & Panels
- `GET /api/v1/tests` - List available catalogue investigations.
- `POST /api/v1/tests` - Add test to catalogue (Admin/Pathologist).
- `PATCH /api/v1/tests/:id` - Edit test metadata or rates.
- `DELETE /api/v1/tests/:id` - Soft-delete/retire test from active catalogue.
- `GET /api/v1/test-groups` - List investigation panels (CBC, Diabetes, LFT, etc.).
- `POST /api/v1/test-groups` - Create new test group/panel.

### Reports & Observations
- `GET /api/v1/reports` - List reports filtered by status (`Draft`, `Final`), patient, doctor, or date.
- `POST /api/v1/reports` - Create Draft report with expanded panels and snapshot test rates.
- `GET /api/v1/reports/:id` - Retrieve full report with observations and invoice.
- `PATCH /api/v1/reports/:id/results` - Save observation results (Rejects if report is Final).
- `POST /api/v1/reports/:id/finalize` - Finalize report (Pathologist/Admin only; requires all values).
- `POST /api/v1/reports/:id/reopen` - Reopen report for corrections (Pathologist/Admin only; reason required).
- `POST /api/v1/reports/:id/documents` - Request PDF document generation with or without letterhead.

### Documents
- `GET /api/v1/documents/:id/download` - Authorize and log document download.

### Invoices & Billing
- `GET /api/v1/invoices` - List invoices and balances.
- `POST /api/v1/invoices` - Create invoice for report.
- `POST /api/v1/invoices/:id/payments` - Record append-only payment; prevents overpayment.
- `GET /api/v1/billing/summary` - Real-time financial summary (billed, collected, outstanding).

### Dashboard & System
- `GET /api/v1/dashboard/stats` - Aggregated operational metrics and recent activity.
- `GET /api/v1/health` - System health and MongoDB Atlas connectivity status.

---

## 6. Business Logic & Invariants

1. **Atomic Visit Creation**: Registering a patient with selected investigations atomically creates the patient record, expands group panels, snapshots test rates/ranges, creates the Draft report, and generates the initial invoice shell in a single database transaction.
2. **Clinical Immutability**: Once a report is finalised, its test results cannot be modified directly via results PATCH. Corrections must follow the authorized reopen route (`POST /reports/:id/reopen`) requiring a clinical reason and recording an audit event.
3. **Completeness Check**: A report cannot be finalised without an observed value for every included investigation.
4. **Historical Earnings Preservation**: When calculating doctor referral earnings, the system uses `report.doctorSnapshot.referralPercentage` stored at report creation time, guaranteeing that future changes to a doctor's master commission rate never retroactively alter historical payout reports.
5. **Append-Only Payment Ledger**: Payments are recorded as discrete ledger entries. The remaining balance is computed server-side, and overpayment beyond the invoice total is strictly rejected.

---

## 7. Security & Performance Optimizations

- **MongoDB Connection Pooling**: Configured with `maxPoolSize: 50`, `minPoolSize: 10`, `serverSelectionTimeoutMS: 5000`, `socketTimeoutMS: 45000`, and `maxIdleTimeMS: 30000`.
- **DNS Resilience**: Configured with fallback public DNS resolvers (`8.8.8.8`, `1.1.1.1`) to resolve MongoDB SRV records reliably on Windows environments.
- **Read Query Optimization**: Read-only endpoints use `.lean()` and explicit field `.select()`.
- **Compound Indexes**: Applied on frequently queried fields (`{ laboratoryId: 1, reportNumber: 1 }`, `{ laboratoryId: 1, patientNumber: 1 }`, `{ laboratoryId: 1, name: 1 }`).
- **Standardized Response Envelopes**:
  - Success: `{ success: true, message: "...", data: {}, meta: { requestId: "..." } }`
  - Error: `{ success: false, message: "...", error: { code: "..." }, meta: { requestId: "..." } }`
- **Security Middlewares**: `helmet` headers, configurable CORS, and rate limiting (`express-rate-limit`).

---

## 8. Swagger & OpenAPI 3.0 Automation

Swagger documentation is fully automated. The specification is generated directly from JSDoc annotations across all route files.

- Interactive Swagger UI: `http://localhost:5000/api-docs`
- Raw OpenAPI 3.0 JSON: `http://localhost:5000/api-docs.json`

To regenerate `swagger/swagger.json` automatically:

```bash
npm run swagger
```

---

## 9. Environment Variables

Create `.env` in the root of `Cell_cited_Backend`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/cell_cited?retryWrites=true&w=majority
JWT_SECRET=cell_cited_pathology_lab_super_secret_jwt_key_2026
JWT_EXPIRES_IN=1d
CLIENT_URL=http://localhost:5173,http://localhost:3000
```

---

## 10. Installation & Execution

### Prerequisites
- Node.js v20+ and npm

### Installation
```bash
cd Cell_cited_Backend
npm install
```

### Seed Default Database Records
Seeds the default laboratory, administrator account (`admin` / `CCPL@2026`), pathologist, default referring doctors, and curated test catalogue:
```bash
npm run seed
```

### Generate Swagger Documentation
```bash
npm run swagger
```

### Start Development Server
```bash
npm run dev
```

### Start Production Server
```bash
npm start
```

---

## 11. Testing & Verification

Run the automated integration test suite:

```bash
npm test
```

### Test Suite Coverage:
- ✓ MongoDB Atlas connection pooling & database seeding
- ✓ Health check & uptime statistics
- ✓ OpenAPI 3.0 JSON specification generation
- ✓ JWT authentication (login, invalid password rejection, `/me` profile)
- ✓ Role-based authorization checks
- ✓ Joi request validation & error formatting
- ✓ Doctors directory CRUD & historical referral earnings calculation
- ✓ Catalogue investigations & panel availability
- ✓ Atomic patient registration with test panel selection
- ✓ Observation result entry & out-of-range biological flags
- ✓ Incomplete report finalization rejection
- ✓ Authorized finalization by Pathologist/Administrator
- ✓ Final report immutability enforcement
- ✓ Controlled report reopening with mandatory clinical reason & audit trail
- ✓ Invoice generation & ledger validation
- ✓ Overpayment rejection
- ✓ Real-time dashboard statistics aggregation
- ✓ Financial billing summary aggregation
- ✓ Graceful connection shutdown

**Test Suite Status**: 25/25 Tests Passing.
