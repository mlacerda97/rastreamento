const fetch = require('node-fetch');

const API_BASE = 'https://api.bsoft.com.br/sistema/v2';

// --- WRAPPER CORS ---
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

function extrairTagXML(xml, tagName) {
    const parts = tagName.split('/');
    if (parts.length > 1) {
        const parentTag = parts[0];
        const childTag = parts[1];
        const parentRegex = new RegExp(`<${parentTag}>([\\s\\S]*?)<\/${parentTag}>`, 'i');
        const parentMatch = xml.match(parentRegex);
        if (parentMatch) {
            const childRegex = new RegExp(`<${childTag}>([^<]*)<\/${childTag}>`, 'i');
            const childMatch = parentMatch[1].match(childRegex);
            return childMatch ? childMatch[1].trim() : null;
        }
        return null;
    } else {
        const pattern = new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`, 'i');
        const match = xml.match(pattern);
        return match ? match[1].trim() : null;
    }
}

const handler = async (req, res) => {
    const { nota_fiscal, cnpjCpf } = req.query;
    
    // Pega Tokens (suporta múltiplos separados por vírgula)
    const TOKENS_STRING = process.env.BSOFT_API_TOKEN || '';
    const TOKENS = TOKENS_STRING.split(',').map(t => t.trim()).filter(t => t);

    if (TOKENS.length === 0) {
        console.error('❌ ERRO: Nenhum token configurado.');
        return res.status(500).json({ error: 'Erro de configuração no servidor.' });
    }

    if (!nota_fiscal || !cnpjCpf) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    const cnpjCpfLimpo = cnpjCpf.replace(/\D/g, '');
    let resultadoFinal = null;

    console.log(`🔍 Iniciando busca | NF: ${nota_fiscal} | Doc: ${cnpjCpfLimpo}`);

    // --- LOOP PELAS EMPRESAS ---
    for (let i = 0; i < TOKENS.length; i++) {
        const tokenAtual = TOKENS[i];
        
        try {
            // 1. Busca Ocorrências
            const ocorrenciasUrl = `${API_BASE}/cte/ocorrencias?nota_fiscal=${nota_fiscal}`;
            const ocorrenciasResponse = await fetch(ocorrenciasUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${tokenAtual}`, 'Content-Type': 'application/json' }
            });

            if (!ocorrenciasResponse.ok) {
                console.log(`⚠️ Empresa ${i+1}: Erro ${ocorrenciasResponse.status}`);
                continue; 
            }

            const ocorrenciasData = await ocorrenciasResponse.json();
            // Garante que é array
            const listaOcorrencias = Array.isArray(ocorrenciasData) ? ocorrenciasData : (ocorrenciasData.content || []);

            console.log(`📦 Empresa ${i+1}: Encontrou ${listaOcorrencias.length} itens.`);

            if (listaOcorrencias.length === 0) continue;

            // 2. Itera sobre CADA item encontrado (aqui estava o problema antes)
            for (const item of listaOcorrencias) {
                const cte = item.cte || item; 
                
                // Se não tem ID, pula
                if (!cte || !cte.id) continue;

                // Valida se esse item realmente pertence à nota fiscal buscada
                // (Às vezes a API traz lixo de outras notas parecidas)
                if (cte.nota_fiscal && cte.nota_fiscal.numero && String(cte.nota_fiscal.numero) !== String(nota_fiscal)) {
                    // Se o número da nota no objeto for diferente do buscado, pula
                    // Mas cuidado: nem sempre esse campo vem preenchido, então só pulamos se tiver certeza que é diferente.
                    // console.log(`Ignorando CT-e da NF ${cte.nota_fiscal.numero}`);
                    // continue;
                }

                console.log(`🔐 Validando CT-e ID: ${cte.id} (NF: ${cte.numero})`);

                // Busca XML
                const xmlResp = await fetch(`${API_BASE}/cte/${cte.id}/xml`, {
                    headers: { 'Authorization': `Bearer ${tokenAtual}` }
                });

                if (xmlResp.ok) {
                    const xmlText = await xmlResp.text();
                    const xmlLimpo = xmlText.replace(/\D/g, '');
                    
                    // Validação de Segurança: O CPF/CNPJ digitado EXISTE no XML?
                    if (xmlLimpo.includes(cnpjCpfLimpo)) {
                        console.log('✅ SUCESSO! Documento autorizado.');
                        
                        // Formata o retorno
                        item.nome_destinatario_xml = extrairTagXML(xmlText, 'dest/xNome') || 'Cliente';
                        item.previsao_entrega = extrairTagXML(xmlText, 'dPrev');
                        
                        resultadoFinal = item;
                        break; // Sai do loop de validação
                    } else {
                        console.log('❌ Documento não consta neste XML.');
                    }
                } else {
                    console.log('⚠️ Falha ao baixar XML.');
                }
            }

            if (resultadoFinal) break; // Sai do loop de empresas

        } catch (error) {
            console.error(`Erro crítico empresa ${i+1}:`, error);
        }
    }

    if (resultadoFinal) {
        return res.status(200).json([resultadoFinal]);
    } else {
        console.log('🚫 Fim da busca: Nada encontrado ou não autorizado.');
        return res.status(404).json({ error: 'Nota fiscal não encontrada. Verifique se o número e o CNPJ/CPF estão corretos.' });
    }
};

module.exports = allowCors(handler);