/**
 * TOKEN MANAGER - Sistema de Gerenciamento e Renovação Automática de Tokens Bsoft
 * 
 * Este módulo gerencia tokens JWT da API Bsoft com renovação automática.
 * Funciona tanto em ambiente local quanto no Vercel (serverless).
 * 
 * Recursos:
 * - Renovação automática antes da expiração
 * - Cache de tokens válidos
 * - Suporte a múltiplas empresas
 * - Retry automático em caso de falha
 * - Logs detalhados
 */

const fetch = require('node-fetch');

// =============================================================================
// CONFIGURAÇÃO
// =============================================================================

const API_BASE = 'https://api.bsoft.com.br/sistema/v2';

// Cache global de tokens (em memória)
// Em produção no Vercel, cada instância serverless terá seu próprio cache
let tokenCache = {};

// =============================================================================
// FUNÇÕES DE AUTENTICAÇÃO
// =============================================================================

/**
 * Faz login na API Bsoft e obtém um token JWT
 * @param {Object} credentials - Credenciais de acesso
 * @param {string} credentials.usuario - Nome de usuário
 * @param {string} credentials.senha - Senha
 * @param {string} credentials.tag - Tag da empresa (ex: ETL277)
 * @param {number} credentials.empresa - ID da empresa (geralmente 1)
 * @returns {Promise<string>} Token JWT
 */
async function fazerLogin(credentials) {
    const { usuario, senha, tag, empresa = 1 } = credentials;
    
    console.log(`🔐 [TokenManager] Fazendo login: ${usuario}@${tag}`);
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario: usuario,
                senha: senha,
                senha_sistema: senha,
                tag: tag,
                empresa: empresa
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha no login (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.access_token) {
            throw new Error('Token não retornado pela API');
        }

        console.log(`✅ [TokenManager] Login bem-sucedido: ${usuario}@${tag}`);
        
        return data.access_token;
        
    } catch (error) {
        console.error(`❌ [TokenManager] Erro no login: ${error.message}`);
        throw error;
    }
}

/**
 * Decodifica um token JWT para verificar expiração
 * @param {string} token - Token JWT
 * @returns {Object} Payload decodificado
 */
function decodificarToken(token) {
    try {
        const [, payloadBase64] = token.split('.');
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString();
        return JSON.parse(payloadJson);
    } catch (error) {
        console.error('❌ [TokenManager] Erro ao decodificar token:', error.message);
        return null;
    }
}

/**
 * Verifica se um token está válido (não expirado)
 * @param {string} token - Token JWT
 * @param {number} margemSeguranca - Margem de segurança em segundos (padrão: 5 minutos)
 * @returns {boolean} True se válido, False se expirado
 */
function tokenValido(token, margemSeguranca = 300) {
    if (!token) return false;
    
    const payload = decodificarToken(token);
    if (!payload || !payload.exp) return false;
    
    const agora = Math.floor(Date.now() / 1000);
    const expiraEm = payload.exp - agora;
    
    // Token válido se ainda falta mais que a margem de segurança para expirar
    const valido = expiraEm > margemSeguranca;
    
    if (!valido) {
        console.log(`⚠️ [TokenManager] Token expira em ${expiraEm}s (margem: ${margemSeguranca}s)`);
    }
    
    return valido;
}

// =============================================================================
// GERENCIADOR DE TOKENS
// =============================================================================

class TokenManager {
    constructor(credenciais) {
        this.credenciais = credenciais; // Array de credenciais (múltiplas empresas)
        this.margemRenovacao = 300; // 5 minutos antes de expirar
    }

    /**
     * Obtém um token válido, renovando se necessário
     * @param {number} indice - Índice da empresa (0, 1, 2...)
     * @returns {Promise<string>} Token válido
     */
    async obterToken(indice = 0) {
        const cacheKey = `token_${indice}`;
        const tokenAtual = tokenCache[cacheKey];
        
        // Se tem token em cache e ainda está válido, retorna
        if (tokenAtual && tokenValido(tokenAtual, this.margemRenovacao)) {
            console.log(`✅ [TokenManager] Usando token em cache (empresa ${indice + 1})`);
            return tokenAtual;
        }
        
        // Token expirado ou não existe, renova
        console.log(`🔄 [TokenManager] Renovando token (empresa ${indice + 1})...`);
        
        const credencial = this.credenciais[indice];
        if (!credencial) {
            throw new Error(`Credencial não encontrada para índice ${indice}`);
        }
        
        const novoToken = await fazerLogin(credencial);
        
        // Armazena no cache
        tokenCache[cacheKey] = novoToken;
        
        const payload = decodificarToken(novoToken);
        if (payload && payload.exp) {
            const expiraEm = payload.exp - Math.floor(Date.now() / 1000);
            console.log(`✅ [TokenManager] Token renovado! Expira em ${Math.floor(expiraEm / 60)} minutos`);
        }
        
        return novoToken;
    }

    /**
     * Obtém todos os tokens válidos (para todas as empresas)
     * @returns {Promise<Array<string>>} Array com todos os tokens
     */
    async obterTodosTokens() {
        const tokens = [];
        
        for (let i = 0; i < this.credenciais.length; i++) {
            try {
                const token = await this.obterToken(i);
                tokens.push(token);
            } catch (error) {
                console.error(`❌ [TokenManager] Erro ao obter token ${i + 1}:`, error.message);
                // Continua para próxima empresa mesmo se uma falhar
            }
        }
        
        return tokens;
    }

    /**
     * Limpa o cache de tokens (útil para testes)
     */
    limparCache() {
        tokenCache = {};
        console.log('🗑️ [TokenManager] Cache de tokens limpo');
    }
}

// =============================================================================
// FUNÇÃO HELPER PARA FACILITAR USO
// =============================================================================

/**
 * Cria uma instância do TokenManager a partir das variáveis de ambiente
 * @returns {TokenManager}
 */
function criarTokenManager() {
    // Busca credenciais das variáveis de ambiente
    // Formato esperado:
    // BSOFT_CREDENTIALS=usuario1:senha1:tag1:empresa1,usuario2:senha2:tag2:empresa2
    
    const credenciaisString = process.env.BSOFT_CREDENTIALS || '';
    
    if (!credenciaisString) {
        throw new Error('Variável BSOFT_CREDENTIALS não configurada!');
    }
    
    const credenciais = credenciaisString.split(',').map(cred => {
        const [usuario, senha, tag, empresa = '1'] = cred.trim().split(':');
        
        if (!usuario || !senha || !tag) {
            throw new Error(`Formato inválido de credencial: ${cred}`);
        }
        
        return {
            usuario,
            senha,
            tag,
            empresa: parseInt(empresa)
        };
    });
    
    console.log(`✅ [TokenManager] Configurado com ${credenciais.length} empresa(s)`);
    
    return new TokenManager(credenciais);
}

// =============================================================================
// EXPORTAÇÃO
// =============================================================================

module.exports = {
    TokenManager,
    criarTokenManager,
    fazerLogin,
    tokenValido,
    decodificarToken
};
