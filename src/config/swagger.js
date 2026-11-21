const swaggerJsDoc = require('swagger-jsdoc');
const path = require('path');
const env = require('./env');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cell Cited Pathology Lab (CCPL) API',
      version: '1.0.0',
      description:
        'Production-ready REST API for Cell Cited Pathology Lab (CCPL) Barabanki. Features role-based access control, tenant isolation, clinical immutability, frozen referral snapshots, and audit logging.',
      contact: {
        name: 'Cell Cited Pathology Lab',
        email: 'ccpath11@gmail.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token to authenticate',
        },
      },
      schemas: {
        StandardSuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
            meta: {
              type: 'object',
              properties: {
                requestId: { type: 'string', example: 'req-c7a6e124-7e89-4bc6-a94f' },
              },
            },
          },
        },
        StandardErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                details: { type: 'array', items: { type: 'object' } },
              },
            },
            meta: {
              type: 'object',
              properties: {
                requestId: { type: 'string', example: 'req-c7a6e124-7e89-4bc6-a94f' },
              },
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'CCPL@2026' },
          },
        },
        PatientRequest: {
          type: 'object',
          required: ['name', 'age', 'gender'],
          properties: {
            title: { type: 'string', example: 'Mr.' },
            name: { type: 'string', example: 'Jigyasa' },
            age: { type: 'number', example: 23 },
            ageUnit: { type: 'string', enum: ['Years', 'Months', 'Days'], example: 'Years' },
            gender: { type: 'string', enum: ['Male', 'Female', 'Other'], example: 'Male' },
            mobile: { type: 'string', example: '9554448906' },
            address: { type: 'string', example: 'Shop No. 17, City Trade Centre, Barabanki' },
            doctorId: { type: 'string', example: '673d32847a9ef02bc4501a1e' },
            testGroupIds: { type: 'array', items: { type: 'string' }, example: ['cbc', 'diabetes'] },
            testIds: { type: 'array', items: { type: 'string' }, example: [] },
          },
        },
        DoctorRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Dr. P.S. Patel' },
            specialty: { type: 'string', example: 'General Physician' },
            mobile: { type: 'string', example: '9876543210' },
            address: { type: 'string', example: 'Civil Lines, Barabanki' },
            referralPercentage: { type: 'number', minimum: 0, maximum: 100, example: 60 },
          },
        },
        TestRequest: {
          type: 'object',
          required: ['name', 'referenceRange'],
          properties: {
            code: { type: 'string', example: 'HB' },
            name: { type: 'string', example: 'Haemoglobin' },
            category: { type: 'string', example: 'Haematology' },
            unit: { type: 'string', example: 'g/dL' },
            referenceRange: { type: 'string', example: '12.00–15.00' },
            rate: { type: 'number', example: 120 },
            alertable: { type: 'boolean', example: true },
          },
        },
        TestGroupRequest: {
          type: 'object',
          required: ['code', 'name'],
          properties: {
            code: { type: 'string', example: 'CBC' },
            name: { type: 'string', example: 'Complete Blood Count (CBC)' },
            description: { type: 'string', example: 'Core blood count with differential and platelets' },
            category: { type: 'string', example: 'Haematology' },
            testNames: {
              type: 'array',
              items: { type: 'string' },
              example: ['Haemoglobin', 'Packed Cell Volume (PCV)', 'RBC Count'],
            },
          },
        },
        ReportCreateRequest: {
          type: 'object',
          required: ['patientId'],
          properties: {
            patientId: { type: 'string', example: '673d32847a9ef02bc4501a1e' },
            doctorId: { type: 'string', example: '673d32847a9ef02bc4501a1f' },
            testGroupIds: { type: 'array', items: { type: 'string' }, example: ['cbc'] },
            testIds: { type: 'array', items: { type: 'string' }, example: ['Glucose Fasting'] },
            feeOverride: { type: 'number', nullable: true, example: 500 },
          },
        },
        ResultsUpdateRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  testName: { type: 'string', example: 'Haemoglobin' },
                  value: { type: 'string', example: '13.5' },
                  unit: { type: 'string', example: 'g/dL' },
                  referenceRange: { type: 'string', example: '12.00–15.00' },
                  remark: { type: 'string', example: 'Normal' },
                },
              },
            },
          },
        },
        FinalizeReportRequest: {
          type: 'object',
          properties: {
            expectedVersion: { type: 'number', example: 1 },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  testName: { type: 'string', example: 'Haemoglobin' },
                  value: { type: 'string', example: '13.5' },
                },
              },
            },
          },
        },
        ReopenReportRequest: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: {
              type: 'string',
              example: 'Pathologist request: Repeat blood count sample required to verify low platelet count observation.',
            },
          },
        },
        PaymentRequest: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: { type: 'number', minimum: 0.01, example: 350 },
            method: { type: 'string', enum: ['Cash', 'UPI', 'Card', 'Net Banking', 'Other'], example: 'Cash' },
            reference: { type: 'string', example: 'UPI-REF-9812479' },
            notes: { type: 'string', example: 'Advance received at sample collection' },
          },
        },
      },
    },
  },
  apis: [
    path.resolve(__dirname, '../routes/*.js').replace(/\\/g, '/'),
    path.resolve(__dirname, '../docs/*.js').replace(/\\/g, '/'),
  ],
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

module.exports = {
  swaggerOptions,
  swaggerSpec,
};
