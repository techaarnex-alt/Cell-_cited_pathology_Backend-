const REPORT_STATUS = {
  DRAFT: 'Draft',
  FINAL: 'Final',
};

const INVOICE_STATUS = {
  PENDING: 'Pending',
  PARTIAL: 'Partial',
  PAID: 'Paid',
};

const PAYMENT_METHODS = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  NET_BANKING: 'Net Banking',
  OTHER: 'Other',
};

const DOCUMENT_TYPES = {
  REPORT_WITH_LETTERHEAD: 'report_with_letterhead',
  REPORT_WITHOUT_LETTERHEAD: 'report_without_letterhead',
  INVOICE: 'invoice',
};

module.exports = {
  REPORT_STATUS,
  INVOICE_STATUS,
  PAYMENT_METHODS,
  DOCUMENT_TYPES,
};
