// api/rastreamento.js
const fetch = require('node-fetch');

const API_BASE = 'https://api.bsoft.com.br/sistema/v2';

// Função auxiliar para extrair tags XML
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

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { nota_fiscal, cnpjCpf } = req.query;
    const API_TOKEN = process.env.BSOFT_API_TOKEN;

    // Validações
    if (!API_TOKEN) {
        console.error('❌ Token não configurado nas variáveis de ambiente');
        return res.status(500).json({ error: 'Configuração inválida do servidor' });
    }

    if (!nota_fiscal) {
        return res.status(400).json({ error: 'Nota fiscal não informada' });
    }

    if (!cnpjCpf) {
        return res.status(400).json({ error: 'CNPJ/CPF não informado' });
    }

    try {
        console.log(`🔍 [${new Date().toISOString()}] NF: ${nota_fiscal} | CNPJ/CPF: ${cnpjCpf}`);

        // ========================================
        // PASSO 1: Buscar Ocorrências
        // ========================================
        const ocorrenciasUrl = `${API_BASE}/cte/ocorrencias?nota_fiscal=${nota_fiscal}`;
        console.log(`📡 Buscando: ${ocorrenciasUrl}`);

        const ocorrenciasResponse = await fetch(ocorrenciasUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log(`📊 Status: ${ocorrenciasResponse.status}`);

        if (!ocorrenciasResponse.ok) {
            if (ocorrenciasResponse.status === 404) {
                return res.status(404).json({ error: 'Nota fiscal não encontrada' });
            }
            if (ocorrenciasResponse.status === 401) {
                console.error('❌ Token inválido ou expirado');
                return res.status(401).json({ error: 'Erro de autenticação. Contate o suporte.' });
            }
            return res.status(ocorrenciasResponse.status).json({ 
                error: `Erro ao buscar dados: ${ocorrenciasResponse.status}` 
            });
        }

        const ocorrenciasData = await ocorrenciasResponse.json();

        if (!ocorrenciasData || !Array.isArray(ocorrenciasData) || ocorrenciasData.length === 0) {
            console.log('⚠️ Nenhuma ocorrência encontrada');
            return res.status(404).json({ error: 'Nenhuma ocorrência encontrada para esta nota fiscal' });
        }

        console.log(`✅ ${ocorrenciasData.length} CT-e(s) encontrado(s)`);

        // ========================================
        // PASSO 2: Validar CNPJ/CPF em cada CT-e
        // ========================================
        const cnpjCpfLimpo = cnpjCpf.replace(/\D/g, '');
        let cteAutorizado = null;

        for (const itemOcorrencia of ocorrenciasData) {
            const cteOcorrencia = itemOcorrencia.cte;
            if (!cteOcorrencia || !cteOcorrencia.id) {
                console.log('⚠️ Item sem ID, pulando...');
                continue;
            }

            const cteId = cteOcorrencia.id;
            console.log(`🔐 Validando CT-e ID: ${cteId}`);

            // Buscar XML do CT-e
            const xmlUrl = `${API_BASE}/cte/${cteId}/xml`;
            const xmlResponse = await fetch(xmlUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Accept': 'application/xml, text/xml, */*'
                }
            });

            if (!xmlResponse.ok) {
                console.log(`⚠️ Erro ao buscar XML: ${xmlResponse.status}`);
                continue;
            }

            const xmlText = await xmlResponse.text();
            console.log(`📄 XML obtido (${xmlText.length} chars)`);

            // Extrair dados do destinatário e previsão
            const nomeDestinatario = extrairTagXML(xmlText, 'xNome') || 'Não informado';
            const dataPrevisao = extrairTagXML(xmlText, 'dPrev');

            console.log(`👤 Nome: ${nomeDestinatario}`);
            console.log(`📅 Previsão: ${dataPrevisao || 'N/A'}`);

            // Extrair todos os CPFs/CNPJs do XML
            const documentos = [];
            const regexCNPJ = /<CNPJ>(\d+)<\/CNPJ>/g;
            const regexCPF = /<CPF>(\d+)<\/CPF>/g;
            
            let match;
            while ((match = regexCNPJ.exec(xmlText)) !== null) {
                documentos.push(match[1]);
            }
            while ((match = regexCPF.exec(xmlText)) !== null) {
                documentos.push(match[1]);
            }

            const documentosUnicos = [...new Set(documentos)];
            console.log(`📝 Documentos: [${documentosUnicos.join(', ')}]`);
            console.log(`🔍 Buscando: ${cnpjCpfLimpo}`);

            // Verificar se o CNPJ/CPF está autorizado
            if (documentosUnicos.includes(cnpjCpfLimpo)) {
                console.log('✅ AUTORIZADO!');
                
                // Adicionar informações extras ao objeto
                itemOcorrencia.cte.nomeDestinatario = nomeDestinatario;
                itemOcorrencia.cte.previsaoEntrega = dataPrevisao;
                
                cteAutorizado = itemOcorrencia;
                break;
            } else {
                console.log('❌ Não autorizado para este CT-e');
            }
        }

        if (!cteAutorizado) {
            console.log('❌ CNPJ/CPF não autorizado para nenhum CT-e desta NF');
            return res.status(403).json({ 
                error: 'CNPJ/CPF não autorizado a consultar esta nota fiscal. Verifique se você é o destinatário ou remetente.'
            });
        }

        console.log('✅ Retornando dados do CT-e autorizado');
        return res.status(200).json([cteAutorizado]);

    } catch (error) {
        console.error('❌ ERRO:', error.message);
        console.error('Stack:', error.stack);
        return res.status(500).json({ 
            error: 'Erro ao processar requisição. Tente novamente.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
