// netlify/functions/create-folder.js
const { google } = require('googleapis');

// Initialize Google Drive API
const getDriveService = () => {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  
  return google.drive({ version: 'v3', auth });
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const drive = getDriveService();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const { folderName } = JSON.parse(event.body);

    if (!folderName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Folder name is required' })
      };
    }

    // Create folder in Google Drive
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [folderId]
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name'
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        folder: {
          id: response.data.id,
          name: response.data.name,
          type: 'folder'
        }
      })
    };

  } catch (error) {
    console.error('Error creating folder:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create folder' })
    };
  }
};
