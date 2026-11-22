const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const documentService = require('../services/document.service');

const downloadDocument = catchAsync(async (req, res) => {
  const document = await documentService.getDocumentById(
    req.laboratoryId,
    req.params.id,
    req.user,
    req
  );

  // If storageKey is a file on disk or S3 URL, we could pipe it or send download headers.
  // Here we provide metadata and content headers
  res.setHeader('Content-Type', document.mimeType || 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);

  return sendSuccess(res, 200, 'Document download authorized', {
    documentId: document._id,
    fileName: document.fileName,
    type: document.type,
    downloadCount: document.downloadCount,
    downloadUrl: `/api/v1/documents/${document._id}/download`,
  });
});

module.exports = {
  downloadDocument,
};
