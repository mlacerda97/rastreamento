const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors({origin: 'https://www.e4log.com.br'}));
app.use(express.static('.'));

// ==================================================================
// 🔧 SEUS TOKENS AQUI
// ==================================================================
const API_TOKENS = [
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOnsiaWRfYnNvZnQiOiJDRTU2QzhBRkJFQjkiLCJ0YWciOiJFVEwyNzciLCJ1c3VhcmlvIjoiTUFUSEVVUyIsImhvc3RuYW1lIjoiQjFCNkFDOEZFMjQzM0MyMDAxNzRGNzZBQ0Q1MUM3IiwiZGF0YWJhc2UiOiI2OUNDNzZCNDdEQjVBMTUyRkMzN0M5NkE5RTQwRTMwRTcyODRCNTUwRkMzOUZFMjMwNzc3RUIwODc2RTkyRTM0MzMyMTE2MUMwMjY5RDY0MDMxMzQ1RUI5RDkyMzFGMjUxQTE5MDY3MEY1NzRGMjZDRkU2MDlDRDUyQjUyQTJBMUUxNDMzMTIxMjEzRkNGNDVEMDUwRjI3NEUzMTk2MiIsImVtcHJlc2EiOjEsInZlcnNhbyI6IjkzOSIsInJlc3RyaWNvZXMiOiJ7XCJlbmRwb2ludHNfbGliZXJhZG9zXCI6W10sXCJlbWJhcmNhZG9yZXNfY25walwiOltdfSJ9LCJ0eXBlIjoiYWNjZXNzIiwiZnJlc2giOnRydWUsImlhdCI6MTc3MDg5NTE4OCwiZXhwIjoxNzcwODk4Nzg4LCJuYmYiOjE3NzA4OTUxODcsImp0aSI6ImFiYmEzOGJiLWUwOWMtNDM3NS1hZTE3LTEwNjNjNTM5YmRiOCJ9.23sJ8BtvJzADA0VXcmtIXkZ40dz7vw8aMzoeSv5m0Aw', // Troque pelo seu token real
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOnsiaWRfYnNvZnQiOiI5Rjg2Rjg3RUVGNzciLCJ0YWciOiJFVEwyNzciLCJ1c3VhcmlvIjoiTUFUSEVVUyIsImhvc3RuYW1lIjoiMDM2MERBNUNENTUwQzNBRjkyODVFNjVEREU0NjMwIiwiZGF0YWJhc2UiOiIxMDZCOTA1MUUxMTA3QThBQTQ1RjkxQjU0MkU3MEIyNzE5MkREQzA5MjdDNzZGQjNCN0E3OUJEOTI0MUI3RDg3RUM2QkUwNjNEQjRGMzAyQjI0MDMwRDBBMEU3N0UzNkVEMTUxQ0U0OUNDQUVCNEFCQkRBMkRFMTI2N0FFREU2NEFDQjVBRjlGQTNCRDRDQzE1RkU2NkRDRTRDQTFEQSIsImVtcHJlc2EiOjEsInZlcnNhbyI6IjkzOSIsInJlc3RyaWNvZXMiOiJ7XCJlbmRwb2ludHNfbGliZXJhZG9zXCI6W10sXCJlbWJhcmNhZG9yZXNfY25walwiOltdfSJ9LCJ0eXBlIjoiYWNjZXNzIiwiZnJlc2giOnRydWUsImlhdCI6MTc3MDgzNTEwMywiZXhwIjoxNzcwODM4NzAzLCJuYmYiOjE3NzA4MzUxMDIsImp0aSI6ImFhZDEwODdiLTIzMDYtNDk3NS1iNWYwLTcxMDI3MGNiNGMxMCJ9.vjoqOvrAaVu5nMkWDk74AUaLtk-zUgjwoRGxU6bojBM'  // Troque pelo seu token real
];

const API_BASE = 'https://api.bsoft.com.br/sistema/v2';

// Função para extrair tag específica do XML
function extrairTagXML(xml, tagName) {
    const parts = tagName.split('/');
    try {
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
    } catch (e) { return null; }
}

app.get('/api/rastreamento', async (req, res) => {
    const { nota_fiscal, cnpjCpf } = req.query;
    console.log('\n' + '='.repeat(80));
    console.log(`🚀 NOVA REQUISIÇÃO | NF: ${nota_fiscal} | Buscando: ${cnpjCpf}`);
    
    if (!nota_fiscal || !cnpjCpf) return res.status(400).json({ error: 'Dados incompletos' });

    const cnpjCpfLimpo = cnpjCpf.replace(/\D/g, '');
    let resultadoFinal = null;

    // LOOP PELAS EMPRESAS (TOKENS)
    for (let i = 0; i < API_TOKENS.length; i++) {
        const tokenAtual = API_TOKENS[i];
        console.log(`\n🏢 EMPRESA ${i + 1} (Token final ...${tokenAtual.slice(-6)})`);

        try {
            // 1. BUSCA OCORRÊNCIAS
            const urlSearch = `${API_BASE}/cte/ocorrencias?nota_fiscal=${nota_fiscal}`;
            const response = await fetch(urlSearch, {
                headers: { 'Authorization': `Bearer ${tokenAtual}` }
            });

            if (!response.ok) {
                console.log(`   ❌ Status ${response.status} ao buscar ocorrências.`);
                continue;
            }

            const data = await response.json();
            const listaCtes = Array.isArray(data) ? data : (data.content || []);

            if (listaCtes.length === 0) {
                console.log(`   ⚠️ Nenhum CT-e encontrado com este token.`);
                continue;
            }

            console.log(`   📦 Encontrados ${listaCtes.length} CT-e(s). Analisando cada um...`);

            // 2. ANALISA CADA CT-E
            for (const item of listaCtes) {
                const cte = item.cte || item;
                if (!cte || !cte.id) continue;

                console.log(`      ---------------------------------------------------`);
                console.log(`      🔍 CT-e ID: ${cte.id} | Número: ${cte.numero}`);
                
                let documentosPermitidos = [];
                let nomeDest = 'Cliente Indefinido';
                let prevEntrega = null;
                let fonteDados = '';

                // TENTA BAIXAR XML
                const xmlResp = await fetch(`${API_BASE}/cte/${cte.id}/xml`, {
                    headers: { 'Authorization': `Bearer ${tokenAtual}` }
                });

                if (xmlResp.ok) {
                    fonteDados = 'XML';
                    const xmlText = await xmlResp.text();
                    
                    // Extrai TODOS os CNPJs/CPFs do XML
                    const regexDocs = /<(?:CNPJ|CPF)>(\d+)<\/(?:CNPJ|CPF)>/g;
                    let match;
                    while ((match = regexDocs.exec(xmlText)) !== null) {
                        documentosPermitidos.push(match[1]);
                    }

                    // Dados Extras
                    nomeDest = extrairTagXML(xmlText, 'dest/xNome') || nomeDest;
                    const dPrev = extrairTagXML(xmlText, 'dPrev');
                    if (dPrev) {
                        const p = dPrev.split('-');
                        if(p.length === 3) prevEntrega = `${p[2]}/${p[1]}/${p[0]}`;
                    }
                } else {
                    fonteDados = 'JSON (Fallback)';
                    console.log(`      ⚠️ XML falhou (${xmlResp.status}). Usando dados parciais do JSON.`);
                    
                    // FALLBACK: PEGA DO JSON (Incluindo Pagador/Expedidor agora!)
                    if(cte.destinatario?.cnpj_cpf) documentosPermitidos.push(cte.destinatario.cnpj_cpf.replace(/\D/g,''));
                    if(cte.remetente?.cnpj_cpf) documentosPermitidos.push(cte.remetente.cnpj_cpf.replace(/\D/g,''));
                    if(cte.pagador?.cnpj_cpf) documentosPermitidos.push(cte.pagador.cnpj_cpf.replace(/\D/g,''));
                    if(cte.expedidor?.cnpj_cpf) documentosPermitidos.push(cte.expedidor.cnpj_cpf.replace(/\D/g,''));
                    if(cte.recebedor?.cnpj_cpf) documentosPermitidos.push(cte.recebedor.cnpj_cpf.replace(/\D/g,''));

                    if(cte.destinatario?.nome) nomeDest = cte.destinatario.nome;
                }

                // REMOVE DUPLICADOS
                documentosPermitidos = [...new Set(documentosPermitidos)];

                console.log(`      📋 Docs no CT-e: [${documentosPermitidos.join(', ')}]`);
                console.log(`      👤 Buscando por: ${cnpjCpfLimpo}`);

                // VALIDAÇÃO
                if (documentosPermitidos.includes(cnpjCpfLimpo)) {
                    console.log(`      ✅ SUCESSO! Usuário autorizado.`);
                    resultadoFinal = {
                        ...item,
                        nome_destinatario_xml: nomeDest,
                        previsao_entrega: prevEntrega || item.previsao_entrega || null
                    };
                    break; 
                } else {
                    console.log(`      ⛔ Acesso Negado: Documento não consta neste CT-e.`);
                }
            }

            if (resultadoFinal) break; 

        } catch (error) {
            console.error(`   ❌ Erro crítico:`, error.message);
        }
    }

    if (resultadoFinal) {
        console.log('\n✅ RETORNANDO DADOS PARA O FRONTEND');
        res.json([resultadoFinal]);
    } else {
        console.log('\n❌ FIM: NENHUM CT-E CORRESPONDEU AOS CRITÉRIOS');
        res.status(404).json({ error: 'Nenhuma encomenda encontrada para este CNPJ/CPF.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`📄 Acesse: http://localhost:${PORT}/Rastreamento.html\n`);
});