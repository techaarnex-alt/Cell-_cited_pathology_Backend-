const ROLES = {
  ADMINISTRATOR: 'administrator',
  RECEPTIONIST: 'receptionist',
  TECHNICIAN: 'technician',
  PATHOLOGIST: 'pathologist',
  BILLING: 'billing',
  AUDITOR: 'read-only auditor',
};

const ALL_ROLES = Object.values(ROLES);

module.exports = {
  ROLES,
  ALL_ROLES,
};
