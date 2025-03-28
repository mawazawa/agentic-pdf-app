import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Base URL for the orchestration service
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { path } = req.query;

    if (!path || !Array.isArray(path)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const apiPath = path.join('/');
    const method = req.method || 'GET';
    const url = `${API_BASE_URL}/${apiPath}`;

    // Forward the request to the backend service
    const response = await axios({
      method: method as any,
      url,
      data: method !== 'GET' ? req.body : undefined,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('API error:', error);

    // Forward error status if available
    if (error.response) {
      return res.status(error.response.status || 500).json(error.response.data || { error: 'Internal server error' });
    }

    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}