// netlify/functions/upload-file.js
const { google } = require('googleapis');
const formidable = require('formidable');
const fs = require('fs');

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

    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB limit
      keepExtensions: true
    });

    const [fields, files] = await form.parse(event);
    const uploadedFile = files.file[0];

    if (!uploadedFile) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No file provided' })
      };
    }

    // Upload file to Google Drive
    const fileMetadata = {
      name: uploadedFile.originalFilename || uploadedFile.newFilename,
      parents: [folderId]
    };

    const media = {
      mimeType: uploadedFile.mimetype,
      body: fs.createReadStream(uploadedFile.filepath)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, size, mimeType'
    });

    // Clean up temporary file
    fs.unlinkSync(uploadedFile.filepath);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        file: {
          id: response.data.id,
          name: response.data.name,
          size: response.data.size,
          type: 'file'
        }
      })
    };

  } catch (error) {
    console.error('Error uploading file:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to upload file' })
    };
  }
};
