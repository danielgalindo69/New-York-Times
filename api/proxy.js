/**
 * daniel galindo autor
 * Vercel Serverless Function — Proxy seguro para la API del New York Times
 *
 * Esta función actúa como intermediario entre el frontend y la NYT API.
 * La API_KEY NUNCA se expone al navegador; solo vive en las variables
 * de entorno del servidor de Vercel.
 *
 * Uso desde el frontend:
 *   fetch('/api/proxy?path=/svc/books/v3/lists/overview.json')
 *
 * La función añade automáticamente el api-key antes de reenviar la petición.
 */
export default async function handler(req, res) {
  // Solo permitir peticiones GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const API_KEY = process.env.NYT_API_KEY;


  
  if (!API_KEY) {
    return res.status(500).json({
      error: 'API Key no configurada en el servidor. Revisa las variables de entorno en Vercel.'
    });
  }

  // El frontend envía el "path" del endpoint NYT que quiere consultar
  // Ejemplo: /svc/books/v3/lists/overview.json
  const { path, ...otherParams } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Parámetro "path" requerido.' });
  }

  // Construir la URL final hacia la NYT API
  const nytBase = 'https://api.nytimes.com';
  const queryParams = new URLSearchParams({ ...otherParams, 'api-key': API_KEY });
  const targetUrl = `${nytBase}${path}?${queryParams.toString()}`;

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Error de la API NYT: ${response.status}`,
        detail: errorText
      });
    }

    const data = await response.json();

    // Headers de caché para evitar peticiones repetidas (5 minutos)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: 'Error al conectar con la API del NYT.',
      detail: error.message
    });
  }
}
