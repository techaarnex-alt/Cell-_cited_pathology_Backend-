const fs = require('fs');
const path = require('path');
const swaggerJsDoc = require('swagger-jsdoc');
const { swaggerOptions } = require('../src/config/swagger');

const generateSwaggerJson = () => {
  try {
    const spec = swaggerJsDoc(swaggerOptions);
    const outputDir = path.resolve(__dirname, '../swagger');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'swagger.json');
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');

    console.log(`[Swagger] Successfully generated OpenAPI 3.0 specification at: ${outputPath}`);
    return spec;
  } catch (error) {
    console.error('[Swagger] Error generating swagger.json:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  generateSwaggerJson();
}

module.exports = generateSwaggerJson;
