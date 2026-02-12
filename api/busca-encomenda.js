const fetch = require('node-fetch');

const API_BASE = 'https://api.bsoft.com.br/sistema/v2';

const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

function extrairTagXML(xml, tagName) {
    const parts = tagName.split('/');
    if (parts.length > 1) {
        const parentRegex = new RegExp(`<${parts[0]}>([\\s\\S]*?)<\\/${parts[0]}>`, 'i');
        const parentMatch = xml.match(parentRegex);
        if (parentMatch) {
            const childRegex = new RegExp(`<${parts[1]}>([^<]*)<\\/${parts[1]}>`, 'i');
            const childMatch = parentMatch[1].match(childRegex);
            return childMatch ? childMatch[1].trim() : null;
        }
        return null;
    } else {
        const match = xml.match(new RegExp(`<${tagName}>([^<]*)<\\/${tagName}>`, 'i'));
        return match ? match[1].trim() : null;
    }
}

const handler = async (req, res) => {
    const { nota_fiscal, cnpjCpf } = req.query;
    
    // ===== MUDANÇA 1: Validar variável de ambiente =====
    const TOKENS_STRING = process.env.BSOFT_API_TOKEN || '';
    const TOKENS = TOKENS_STRING.split(',').map(t => t.trim()).filter(t => t);

    console.log(`🔍 [DEBUG] Tokens configurados: ${TOKENS.length}`);

    if (TOKENS.length === 0) {
        console.error('❌ ERRO CRÍTICO: Nenhum token configurado no Vercel!');
        console.error('Configure a variável de ambiente BSOFT_API_TOKEN');
        return res.status(500).json({ 
            error: 'Erro de configuração no servidor. Entre em contato com o suporte.',
            details: 'Tokens não configurados'
        });
    }

    if (!nota_fiscal || !cnpjCpf) {
        return res.status(400).json({ error: 'Dados incompletos. Informe a Nota Fiscal e o CNPJ/CPF.' });
    }

    const cnpjCpfLimpo = cnpjCpf.replace(/\D/g, '');
    
    // ===== MUDANÇA 2: Validar tamanho do documento =====
    if (cnpjCpfLimpo.length !== 11 && cnpjCpfLimpo.length !== 14) {
        return res.status(400).json({ error: 'CNPJ/CPF inválido. Verifique o formato.' });
    }

    let resultadoFinal = null;
    let tentativasRealizadas = 0;
    let errosEncontrados = [];

    console.log(`🔍 Iniciando busca | NF: ${nota_fiscal} | Doc: ${cnpjCpfLimpo}`);

    // Loop pelos tokens (empresas)
    for (let i = 0; i < TOKENS.length; i++) {
        const tokenAtual = TOKENS[i];
        tentativasRealizadas++;
        
        try {
            // ===== MUDANÇA 3: Tentar múltiplos endpoints =====
            
            // TENTATIVA 1: Endpoint de ocorrências
            console.log(`\n📡 Empresa ${i+1}: Tentando endpoint /cte/ocorrencias`);
            let ocorrenciasResponse = await fetch(
                `${API_BASE}/cte/ocorrencias?nota_fiscal=${nota_fiscal}`,
                {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${tokenAtual}`,
                        'Content-Type': 'application/json' 
                    }
                }
            );

            let listaOcorrencias = [];

            if (ocorrenciasResponse.ok) {
                const ocorrenciasData = await ocorrenciasResponse.json();
                listaOcorrencias = Array.isArray(ocorrenciasData) 
                    ? ocorrenciasData 
                    : (ocorrenciasData.content || []);
                console.log(`✅ Endpoint ocorrências: ${listaOcorrencias.length} resultados`);
            } else {
                console.log(`⚠️ Endpoint ocorrências falhou: ${ocorrenciasResponse.status}`);
                
                // TENTATIVA 2: Endpoint alternativo /cte (mais genérico)
                console.log(`📡 Tentando endpoint alternativo /cte`);
                const cteResponse = await fetch(
                    `${API_BASE}/cte?nota_fiscal=${nota_fiscal}`,
                    {
                        method: 'GET',
                        headers: { 
                            'Authorization': `Bearer ${tokenAtual}`,
                            'Content-Type': 'application/json' 
                        }
                    }
                );

                if (cteResponse.ok) {
                    const cteData = await cteResponse.json();
                    listaOcorrencias = cteData.content || [];
                    console.log(`✅ Endpoint /cte: ${listaOcorrencias.length} resultados`);
                } else {
                    console.log(`❌ Ambos endpoints falharam para empresa ${i+1}`);
                    errosEncontrados.push(`Empresa ${i+1}: Status ${cteResponse.status}`);
                    continue;
                }
            }

            if (listaOcorrencias.length === 0) {
                console.log(`⚠️ Empresa ${i+1}: Nenhum CT-e encontrado`);
                continue;
            }

            // ===== MUDANÇA 4: Melhor tratamento de cada CT-e =====
            for (const item of listaOcorrencias) {
                const cte = item.cte || item;
                
                if (!cte || !cte.id) {
                    console.log(`⚠️ Item sem ID, pulando...`);
                    continue;
                }

                console.log(`🔐 Validando CT-e ID: ${cte.id}`);

                // Lista de documentos autorizados
                let documentosPermitidos = [];
                let nomeDest = 'Cliente';
                let prevEntrega = null;

                // Tentar buscar XML
                const xmlResp = await fetch(
                    `${API_BASE}/cte/${cte.id}/xml`,
                    { headers: { 'Authorization': `Bearer ${tokenAtual}` } }
                );

                if (xmlResp.ok) {
                    const xmlText = await xmlResp.text();
                    
                    // Extrair TODOS os documentos do XML
                    const regexDocs = /<(?:CNPJ|CPF)>(\d+)<\/(?:CNPJ|CPF)>/g;
                    let match;
                    while ((match = regexDocs.exec(xmlText)) !== null) {
                        documentosPermitidos.push(match[1]);
                    }

                    // Dados extras
                    nomeDest = extrairTagXML(xmlText, 'dest/xNome') || nomeDest;
                    const dPrev = extrairTagXML(xmlText, 'dPrev');
                    if (dPrev) {
                        const p = dPrev.split('-');
                        if (p.length === 3) prevEntrega = `${p[2]}/${p[1]}/${p[0]}`;
                    }

                    console.log(`📋 Documentos no XML: [${documentosPermitidos.join(', ')}]`);
                } else {
                    // ===== MUDANÇA 5: Fallback robusto com JSON =====
                    console.log(`⚠️ XML indisponível, usando dados do JSON`);
                    
                    if (cte.destinatario?.cnpj_cpf) 
                        documentosPermitidos.push(cte.destinatario.cnpj_cpf.replace(/\D/g, ''));
                    if (cte.remetente?.cnpj_cpf) 
                        documentosPermitidos.push(cte.remetente.cnpj_cpf.replace(/\D/g, ''));
                    if (cte.pagador?.cnpj_cpf) 
                        documentosPermitidos.push(cte.pagador.cnpj_cpf.replace(/\D/g, ''));
                    if (cte.expedidor?.cnpj_cpf) 
                        documentosPermitidos.push(cte.expedidor.cnpj_cpf.replace(/\D/g, ''));
                    if (cte.recebedor?.cnpj_cpf) 
                        documentosPermitidos.push(cte.recebedor.cnpj_cpf.replace(/\D/g, ''));

                    if (cte.destinatario?.nome) nomeDest = cte.destinatario.nome;
                    
                    console.log(`📋 Documentos do JSON: [${documentosPermitidos.join(', ')}]`);
                }

                // Remove duplicados
                documentosPermitidos = [...new Set(documentosPermitidos)];

                // ===== MUDANÇA 6: Validação e resposta =====
                console.log(`🔎 Verificando se ${cnpjCpfLimpo} está autorizado...`);
                
                if (documentosPermitidos.includes(cnpjCpfLimpo)) {
                    console.log(`✅ SUCESSO! Documento autorizado.`);
                    
                    resultadoFinal = {
                        ...item,
                        nome_destinatario_xml: nomeDest,
                        previsao_entrega: prevEntrega || item.previsao_entrega || null,
                        _debug: {
                            empresa_encontrada: i + 1,
                            total_empresas: TOKENS.length,
                            cte_id: cte.id
                        }
                    };
                    break;
                } else {
                    console.log(`⛔ Documento não autorizado neste CT-e`);
                }
            }

            if (resultadoFinal) break;

        } catch (error) {
            console.error(`❌ Erro crítico empresa ${i+1}:`, error.message);
            errosEncontrados.push(`Empresa ${i+1}: ${error.message}`);
        }
    }

    // ===== MUDANÇA 7: Resposta detalhada =====
    if (resultadoFinal) {
        console.log(`\n✅ RETORNANDO RESULTADO`);
        return res.status(200).json([resultadoFinal]);
    } else {
        console.log(`\n❌ BUSCA FINALIZADA SEM RESULTADOS`);
        console.log(`Tentativas: ${tentativasRealizadas}`);
        console.log(`Erros: ${errosEncontrados.join(', ')}`);
        
        return res.status(404).json({ 
            error: 'Nota fiscal não encontrada ou você não tem permissão para consultá-la.',
            details: {
                nota_fiscal: nota_fiscal,
                tentativas: tentativasRealizadas,
                sugestoes: [
                    'Verifique se o número da nota fiscal está correto',
                    'Confirme se o CNPJ/CPF é o destinatário ou remetente da nota',
                    'A nota pode não estar disponível no sistema ainda',
                    'Entre em contato com a transportadora para mais informações'
                ]
            }
        });
    }
};

module.exports = allowCors(handler);
