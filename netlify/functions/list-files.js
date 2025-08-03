// netlify/functions/list-files.js
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
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const drive = getDriveService();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // Get files and folders from the specified folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink)',
      orderBy: 'folder,name'
    });

    const files = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      size: file.size ? parseInt(file.size) : 0,
      modified: file.modifiedTime,
      downloadUrl: file.webViewLink,
      thumbnailUrl: file.thumbnailLink
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    };

  } catch (error) {
    console.error('Error listing files:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to list files' })
    };
  }
};
