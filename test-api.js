const fetch = require('node-fetch');

// ⚠️ COLE SEU TOKEN AQUI
const API_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOnsiaWRfYnNvZnQiOiJBMDg3RkY2N0M2QTEiLCJ0YWciOiJFVEwyNzciLCJ1c3VhcmlvIjoiTUFUSEVVUyIsImhvc3RuYW1lIjoiRjQ3MkU4NEEyNzBGMDA2Q0Q1NDEyMjEwNkJGMjY1IiwiZGF0YWJhc2UiOiJCQUJENjU4NUFENDQzNkNFN0ZCNTQ2RUUwNTJBQzk2NERDMTEzOEVFMUREOTFEQzFBNTk1OERFQjEyMDUwQjA5NkVFQTYwRTI1QkQwNEVDOTQ3MkU1OEJGQzNDQUI0QkVBMTgwRkY3QUZGNjJFMDVFRjA3RUZBNzY4QkYyMDUwRTc2RkY3MkUwNjFGRjBFMDcxMjExMzMzNDIzNTZBMSIsImVtcHJlc2EiOjEsInZlcnNhbyI6IjkzOSIsInJlc3RyaWNvZXMiOiJ7XCJlbmRwb2ludHNfbGliZXJhZG9zXCI6W10sXCJlbWJhcmNhZG9yZXNfY25walwiOltdfSJ9LCJ0eXBlIjoiYWNjZXNzIiwiZnJlc2giOnRydWUsImlhdCI6MTc3MDgxOTMyNSwiZXhwIjoxNzcwODIyOTI1LCJuYmYiOjE3NzA4MTkzMjQsImp0aSI6ImIxMzNlM2MzLTUyN2UtNDlhMS1iYmM4LTJhMmVkN2VlOTg1NCJ9.XUQXzllVt8MxiY1nB5fVqbnk4CCl7acwInCZ4ghrWvo';

async function testarAPI() {
    console.log('\n🔍 TESTANDO CONEXÃO COM A API BSOFT\n');
    console.log('='.repeat(80));
    
    // Teste 1: Endpoint de Ocorrências
    console.log('\n📋 TESTE 1: /cte/ocorrencias');
    console.log('-'.repeat(80));
    
    try {
        const url1 = 'https://api.bsoft.com.br/sistema/v2/cte/ocorrencias?nota_fiscal=564199';
        console.log(`URL: ${url1}`);
        console.log(`Token: ${API_TOKEN.substring(0, 30)}...`);
        
        const response1 = await fetch(url1, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log(`Status: ${response1.status} ${response1.statusText}`);
        
        const responseText1 = await response1.text();
        console.log(`Resposta (primeiros 500 chars):\n${responseText1.substring(0, 500)}`);
        
        if (response1.status === 401) {
            console.log('\n❌ ERRO 401 - Token inválido ou sem permissão');
        } else if (response1.ok) {
            console.log('\n✅ SUCESSO - Token válido para /cte/ocorrencias');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
    
    // Teste 2: Endpoint de CT-e (listar todos)
    console.log('\n\n📋 TESTE 2: /cte (listar)');
    console.log('-'.repeat(80));
    
    try {
        const url2 = 'https://api.bsoft.com.br/sistema/v2/cte';
        console.log(`URL: ${url2}`);
        
        const response2 = await fetch(url2, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Status: ${response2.status} ${response2.statusText}`);
        
        const responseText2 = await response2.text();
        console.log(`Resposta (primeiros 500 chars):\n${responseText2.substring(0, 500)}`);
        
        if (response2.status === 401) {
            console.log('\n❌ ERRO 401 - Token inválido ou sem permissão');
        } else if (response2.ok) {
            console.log('\n✅ SUCESSO - Token válido para /cte');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
    
    // Teste 3: Sem Bearer (formato incorreto)
    console.log('\n\n📋 TESTE 3: Testando sem "Bearer" prefix');
    console.log('-'.repeat(80));
    
    try {
        const url3 = 'https://api.bsoft.com.br/sistema/v2/cte/ocorrencias?nota_fiscal=564199';
        
        const response3 = await fetch(url3, {
            method: 'GET',
            headers: {
                'Authorization': API_TOKEN, // SEM "Bearer"
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Status: ${response3.status} ${response3.statusText}`);
        
        if (response3.ok) {
            console.log('✅ Funciona SEM "Bearer"');
        } else {
            console.log('❌ NÃO funciona sem "Bearer"');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n🏁 TESTES FINALIZADOS\n');
}

testarAPI();
