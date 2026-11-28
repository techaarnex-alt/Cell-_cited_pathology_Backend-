const { connectDB, disconnectDB } = require('../src/config/db');
const TestGroup = require('../models/TestGroup');

const alignHemoglobin = async () => {
  try {
    await connectDB();
    console.log('Connected to DB for Hemoglobin rate alignment...');

    const TARGET_TEST_ID = 'a9711c08ba316a1f4dd00de0';
    const groups = await TestGroup.find({ 'tests.id': TARGET_TEST_ID });

    if (!groups.length) {
      console.log('No TestGroup found with tests.id = ' + TARGET_TEST_ID + '. Trying _id matching...');
    }

    let updatedCount = 0;
    const allGroups = await TestGroup.find({});
    for (const group of allGroups) {
      let modified = false;
      if (Array.isArray(group.tests)) {
        for (const t of group.tests) {
          if (String(t.id || t._id) === TARGET_TEST_ID || (t.name && t.name.toLowerCase() === 'hemoglobin')) {
            console.log(`Found Hemoglobin in [${group.name}]: current rate = ${t.rate}. Setting to 500.`);
            t.rate = 500;
            if (Array.isArray(t.parameters) && t.parameters.length > 0) {
              t.parameters[0].rate = 500;
            }
            modified = true;
            updatedCount++;
          }
        }
      }
      if (modified) {
        group.markModified('tests');
        await group.save();
        console.log(`Updated group "${group.name}".`);
      }
    }

    console.log(`Alignment completed. Updated ${updatedCount} Hemoglobin definitions to ₹500.`);
  } catch (err) {
    console.error('Error during Hemoglobin alignment:', err.message);
  } finally {
    await disconnectDB().catch(() => {});
  }
};

if (require.main === module) {
  alignHemoglobin();
}

module.exports = { alignHemoglobin };
