const Laboratory = require('./Laboratory');
const User = require('./User');
const Patient = require('./Patient');
const Doctor = require('./Doctor');
const Test = require('./Test');
const TestGroup = require('./TestGroup');
const Report = require('./Report');
const { ReportItem } = require('./ReportItem');
const Invoice = require('./Invoice');
const Payment = require('./Payment');
const Document = require('./Document');
const AuditEvent = require('./AuditEvent');

module.exports = {
  Laboratory,
  User,
  Patient,
  Doctor,
  Test,
  TestGroup,
  Report,
  ReportItem,
  Invoice,
  Payment,
  Document,
  AuditEvent,
};
