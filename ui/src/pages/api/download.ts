import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { Stream } from 'stream';
import { promisify } from 'util';

// Base URL for the form filling service
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
const pipeline = promisify(Stream.pipeline);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { path } = req.query;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Path parameter is required and must be a string'
      });
    }

    try {
      // Forward the request to download the file
      const response = await axios.get(`${API_BASE_URL}/download`, {
        params: { path },
        responseType: 'stream',
        timeout: 10000 // 10 second timeout
      });

      // Set content type and disposition headers
      const contentType = response.headers['content-type'] || 'application/pdf';
      const contentDisposition = response.headers['content-disposition'] || `attachment; filename="${path.split('/').pop()}"`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', contentDisposition);

      // Stream the file to the client
      await pipeline(response.data, res);
    } catch (error: any) {
      console.error('Download stream error:', error);

      // If headers haven't been sent yet, send error response
      if (!res.headersSent) {
        if (axios.isAxiosError(error)) {
          // Handle axios-specific errors
          if (error.code === 'ECONNABORTED') {
            return res.status(504).json({
              error: 'Download timeout',
              message: 'The download request timed out. Please try again later.'
            });
          }

          if (!error.response) {
            return res.status(503).json({
              error: 'Service unavailable',
              message: 'Could not connect to the file server. Please try again later.'
            });
          }

          // Forward the status and message from the server
          return res.status(error.response.status || 500).json({
            error: 'Download failed',
            message: error.response.data?.message || error.message,
            details: error.response.data
          });
        }

        // Generic error
        return res.status(500).json({
          error: 'Download failed',
          message: error.message || 'An unknown error occurred during download'
        });
      }
    }
  } catch (error: any) {
    console.error('General download error:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Download failed',
        message: error.message || 'An unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  }
}