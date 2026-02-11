// api/rastreamento.js (Node.js)
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Permitir CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { documentNumber, cnpjCpf } = req.query;
    const API_TOKEN = process.env.BSOFT_API_TOKEN; // Variável de ambiente

    try {
        const response = await fetch(
            `https://api.bsoft.com.br/sistema/v2/ocorrencias?numeroDocumento=${documentNumber}&cnpjCpf=${cnpjCpf}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
