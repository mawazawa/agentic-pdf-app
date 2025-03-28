import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

// Disable the default body parser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Base URL for the document extraction service
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the form with formidable
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true,
    });

    // Parse the incoming form
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve([fields, files]);
      });
    });

    if (!files.document) {
      return res.status(400).json({ error: 'No document provided' });
    }

    // Access the file
    const file = Array.isArray(files.document) ? files.document[0] : files.document;

    // Create form data to forward to the backend
    const formData = new FormData();
    formData.append('document', fs.createReadStream(file.filepath), {
      filename: file.originalFilename || 'document.pdf',
      contentType: file.mimetype || 'application/octet-stream',
    });

    // Forward the file to the document extraction service
    const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Upload error:', error);

    // Forward error status if available
    if (error.response) {
      return res.status(error.response.status || 500).json(error.response.data || { error: 'Internal server error' });
    }

    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}