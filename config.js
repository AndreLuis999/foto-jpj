/**
 * Arquivo de Configuração - Foto Telão
 * Sistema de Apresentação Automática de Fotos para Eventos
 *
 * Instruções:
 * 1. LINK_PASTA_DRIVE: Cole o link público da sua pasta do Google Drive.
 * 2. ENABLE_QRCODE: true para exibir o QR Code no telão, false para ocultar.
 * 3. QRCODE_URL: Deixe vazio ("") para apontar automaticamente para a página galeria.html.
 */
const CONFIG = {
    // Cole aqui o link completo da sua pasta pública do Google Drive
    LINK_PASTA_DRIVE: "COLOCAR_LINK_DA_PASTA_AQUI",

    // Ativar (true) ou Desativar (false) o QR Code no telão
    ENABLE_QRCODE: true,

    // URL personalizada do QR Code (deixe vazio para gerar o link da galeria.html automaticamente)
    QRCODE_URL: "",

    // Intervalo de verificação por novas fotos no Drive (em ms) - 5000 = 5 segundos
    INTERVALO_ATUALIZACAO: 5000,

    // Tempo de exibição de cada foto no slideshow (em ms) - 7000 = 7 segundos
    TEMPO_EXIBICAO: 7000,

    // Nome do Evento exibido na abertura do telão e na galeria
    NOME_EVENTO: "Nosso Evento Especial",

    // Mensagem de status inicial na tela de abertura
    MENSAGEM_INICIAL: "Preparando apresentação...",

    // Efeitos visuais do slideshow
    FUNDO_DESFOCADO: true,
    EFEITO_ZOOM: true
};
