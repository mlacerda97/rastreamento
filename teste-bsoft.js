const fetch = require('node-fetch'); // Certifique-se de ter dado 'npm install node-fetch' antes

// --- CONFIGURE AQUI ---
const SEU_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOnsiaWRfYnNvZnQiOiI2MkMxQjVCQUIzQjQiLCJ0YWciOiJFVEwyNzciLCJ1c3VhcmlvIjoiTUFUSEVVUyIsImhvc3RuYW1lIjoiOTA5NThERUU0MjI0MUYwMzdFRTk0REM3QTA4N0YxIiwiZGF0YWJhc2UiOiI4QkVFMTREMjFGRDM0NkZFMkZFNTE2M0VDQTZDOTc1MkNFNjM4QUJDNkI4QjUzOTc5MzgzRkY3QzgyRjUxQTE4MUYxRDEyMTAwRTFEMDI3REYyNzI5Q0ZCMUM2MURENjREQjQ3MzgyMjI3MEIwOTc2RTg3NjgyRkY3NTk4RTg2QUFBOEJGOTY4RTg3Nzg3OUVCQkJBNTlEMjQwQjVDRSIsImVtcHJlc2EiOjEsInZlcnNhbyI6IjkzOSIsInJlc3RyaWNvZXMiOiJ7XCJlbmRwb2ludHNfbGliZXJhZG9zXCI6W10sXCJlbWJhcmNhZG9yZXNfY25walwiOltdfSJ9LCJ0eXBlIjoiYWNjZXNzIiwiZnJlc2giOnRydWUsImlhdCI6MTc3MDg5OTIzNCwiZXhwIjoxNzcwOTAyODM0LCJuYmYiOjE3NzA4OTkyMzMsImp0aSI6ImNlNmExZjc4LWNmMzQtNDIzOS05YWVlLTRmNjAwYzhiNDY4NyJ9.ml4Q4XuFx2VnDAD1z2xRJZ_xWe8Gwl6l3Fbf8TnMk6g';
const NOTA_FISCAL = '62332'; // O número da nota que está dando erro
// ----------------------

const API_BASE = 'https://api.bsoft.com.br/sistema/v2';

async function testarApi() {
    console.log('🚀 Iniciando teste direto com a Bsoft...');
    console.log(`🔎 Buscando NF: ${NOTA_FISCAL}`);

    // TESTE 1: Endpoint de Ocorrências (O que estamos usando hoje)
    console.log('\n[TESTE 1] Tentando buscar Ocorrências direto...');
    try {
        const resp1 = await fetch(`${API_BASE}/cte/ocorrencias?nota_fiscal=${NOTA_FISCAL}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${SEU_TOKEN}`, 'Content-Type': 'application/json' }
        });

        console.log(`Status: ${resp1.status}`);
        if (resp1.ok) {
            const data = await resp1.json();
            console.log('✅ SUCESSO! Ocorrências encontradas:', JSON.stringify(data, null, 2));
        } else {
            const erro = await resp1.text();
            console.log('❌ FALHA. A API respondeu:', erro);
        }
    } catch (e) { console.log('Erro de conexão:', e.message); }

    // TESTE 2: Endpoint de Listagem de CTe (Alternativa mais robusta)
    console.log('\n[TESTE 2] Tentando buscar o CT-e pelo número da nota...');
    try {
        const resp2 = await fetch(`${API_BASE}/cte?nota_fiscal=${NOTA_FISCAL}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${SEU_TOKEN}`, 'Content-Type': 'application/json' }
        });

        console.log(`Status: ${resp2.status}`);
        if (resp2.ok) {
            const data = await resp2.json();
            console.log('✅ SUCESSO! CT-e encontrado:', data.total > 0 ? 'Sim' : 'Não (Lista vazia)');
            if (data.content) console.log(data.content);
        } else {
            const erro = await resp2.text();
            console.log('❌ FALHA. A API respondeu:', erro);
        }
    } catch (e) { console.log('Erro de conexão:', e.message); }
}

testarApi();