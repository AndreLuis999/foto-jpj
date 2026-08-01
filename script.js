/**
 * ==========================================================================
 * Foto Telão - Sistema de Apresentação Automática para Eventos
 * Leitura de Pasta Pública do Google Drive Sem Chave de API
 * Atualização Automática Silenciosa, Sem Repetição Sequencial & QR Code Opcional
 * ==========================================================================
 */

class FotoTelaoApp {
    constructor() {
        this.config = this.loadConfig();

        // Estado do Slideshow
        this.allPhotos = [];          // Fotos atualmente existentes na pasta
        this.queue = [];              // Fila de exibição
        this.seenIds = this.loadSeenIds(); // Set de IDs já exibidos
        this.currentPhoto = null;
        this.activeLayerIndex = 1;
        this.isPlaying = true;
        this.isDemoMode = false;
        
        // Timers
        this.slideshowTimer = null;
        this.checkDriveTimer = null;
        this.idleTimer = null;

        // Elementos DOM
        this.dom = {
            splashScreen: document.getElementById('splash-screen'),
            splashTitle: document.getElementById('splash-event-title'),
            splashSubtitle: document.getElementById('splash-event-subtitle'),
            splashStatusText: document.getElementById('splash-status-text'),
            splashSpinner: document.getElementById('splash-spinner'),
            btnStart: document.getElementById('btn-start-presentation'),
            
            slideshowContainer: document.getElementById('slideshow-container'),
            slideLayers: [
                document.getElementById('slide-layer-1'),
                document.getElementById('slide-layer-2')
            ],
            slideImages: [
                document.getElementById('slide-img-1'),
                document.getElementById('slide-img-2')
            ],
            ambientBgs: [
                document.getElementById('ambient-bg-1'),
                document.getElementById('ambient-bg-2')
            ],
            
            statusToast: document.getElementById('status-toast'),
            toastDot: document.getElementById('toast-dot'),
            toastMessage: document.getElementById('toast-message'),
            
            qrBadge: document.getElementById('qrcode-badge'),
            qrContainer: document.getElementById('qrcode-container'),
            qrTitle: document.getElementById('qr-title-text'),
            qrSubtitle: document.getElementById('qr-subtitle-text'),

            controlsBar: document.getElementById('controls-bar'),
            btnPrev: document.getElementById('btn-prev'),
            btnNext: document.getElementById('btn-next'),
            btnTogglePause: document.getElementById('btn-toggle-pause'),
            iconPause: document.getElementById('icon-pause'),
            iconPlay: document.getElementById('icon-play'),
            btnFullscreen: document.getElementById('btn-fullscreen'),
            btnOpenAdmin: document.getElementById('btn-open-admin'),

            adminModal: document.getElementById('admin-modal'),
            btnCloseAdmin: document.getElementById('btn-close-admin'),
            inputDriveUrl: document.getElementById('admin-drive-url'),
            inputEnableQrCode: document.getElementById('admin-enable-qrcode'),
            inputQrUrl: document.getElementById('admin-qr-url'),
            btnSaveAdmin: document.getElementById('btn-save-admin'),
            btnResetCache: document.getElementById('btn-reset-cache'),
            
            statDisplayed: document.getElementById('stat-displayed'),
            statQueued: document.getElementById('stat-queued'),
            statTotal: document.getElementById('stat-total')
        };

        this.init();
    }

    /* ==========================================================================
       1. Inicialização & Setup
       ========================================================================== */
    init() {
        this.setupUI();
        this.setupEventListeners();
        this.setupIdleDetector();
        this.renderQRCode();

        this.showToast("Carregando fotos...", "info");

        // Inicia consulta inicial à pasta do Google Drive
        this.checkDrivePhotos().then(() => {
            this.dom.splashSpinner.style.display = 'none';
            this.dom.btnStart.style.display = 'inline-block';
            this.dom.splashStatusText.textContent = this.isDemoMode 
                ? "Modo Demonstração (Cole o link da sua pasta no config.js)" 
                : `${this.allPhotos.length} foto(s) carregada(s) com sucesso!`;
            
            setTimeout(() => {
                this.startPresentation();
            }, 2200);
        });

        // Agenda verificações periódicas automáticas por novas fotos na pasta do Drive (sem toasts na tela)
        const intervalMs = Math.max(3000, parseInt(this.config.INTERVALO_ATUALIZACAO) || 5000);
        this.checkDriveTimer = setInterval(() => {
            if (!this.isDemoMode) {
                this.checkDrivePhotos(true);
            }
        }, intervalMs);
    }

    loadConfig() {
        const base = typeof CONFIG !== 'undefined' ? CONFIG : {};
        const saved = JSON.parse(localStorage.getItem('foto_telao_config') || '{}');
        return {
            LINK_PASTA_DRIVE: saved.LINK_PASTA_DRIVE || base.LINK_PASTA_DRIVE || "COLOCAR_LINK_DA_PASTA_AQUI",
            ENABLE_QRCODE: saved.ENABLE_QRCODE !== undefined ? saved.ENABLE_QRCODE : (base.ENABLE_QRCODE !== false),
            QRCODE_URL: saved.QRCODE_URL !== undefined ? saved.QRCODE_URL : (base.QRCODE_URL || ""),
            INTERVALO_ATUALIZACAO: saved.INTERVALO_ATUALIZACAO || base.INTERVALO_ATUALIZACAO || 5000,
            TEMPO_EXIBICAO: saved.TEMPO_EXIBICAO || base.TEMPO_EXIBICAO || 7000,
            NOME_EVENTO: saved.NOME_EVENTO || base.NOME_EVENTO || "Nosso Evento Especial",
            MENSAGEM_INICIAL: saved.MENSAGEM_INICIAL || base.MENSAGEM_INICIAL || "Preparando apresentação...",
            FUNDO_DESFOCADO: base.FUNDO_DESFOCADO !== false,
            EFEITO_ZOOM: base.EFEITO_ZOOM !== false
        };
    }

    loadSeenIds() {
        try {
            const data = localStorage.getItem('foto_telao_seen_ids');
            return data ? new Set(JSON.parse(data)) : new Set();
        } catch (e) {
            return new Set();
        }
    }

    saveSeenIds() {
        try {
            localStorage.setItem('foto_telao_seen_ids', JSON.stringify(Array.from(this.seenIds)));
            if (this.currentPhoto) {
                localStorage.setItem('foto_telao_last_id', this.currentPhoto.id);
            }
        } catch (e) {
            console.warn("Erro ao salvar cache no localStorage", e);
        }
    }

    setupUI() {
        this.dom.splashTitle.textContent = this.config.NOME_EVENTO;
        this.dom.splashSubtitle.textContent = this.config.MENSAGEM_INICIAL;
        
        if (this.dom.inputDriveUrl) this.dom.inputDriveUrl.value = this.config.LINK_PASTA_DRIVE;
        if (this.dom.inputEnableQrCode) this.dom.inputEnableQrCode.checked = this.config.ENABLE_QRCODE;
        if (this.dom.inputQrUrl) this.dom.inputQrUrl.value = this.config.QRCODE_URL;
    }

    extractFolderId(urlOrId) {
        if (!urlOrId || typeof urlOrId !== 'string') return null;
        const clean = urlOrId.trim();
        if (clean === "COLOCAR_LINK_DA_PASTA_AQUI" || clean === "") return null;

        const match = clean.match(/folders\/([a-zA-Z0-9_-]+)/) ||
                      clean.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                      clean.match(/^([a-zA-Z0-9_-]{20,})$/);
        return match ? match[1] : null;
    }

    /* ==========================================================================
       2. Leitura da Pasta do Google Drive (Conexão Direta e Limpa)
       ========================================================================== */
    async checkDrivePhotos(isPeriodicCheck = false) {
        const folderId = this.extractFolderId(this.config.LINK_PASTA_DRIVE);

        if (!folderId) {
            this.isDemoMode = true;
            this.loadDemoPhotos();
            if (!isPeriodicCheck) {
                this.showToast("Modo Demonstração (Cole o link da pasta no config.js)", "warning", 6000);
            }
            return;
        }

        try {
            // URL limpa sem parâmetros inválidos que possam ser rejeitados pelo Google Drive
            const targetUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}`;
            const timestamp = Date.now();
            
            const proxies = [
                `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}&_cb=${timestamp}`,
                `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
            ];

            let htmlText = null;
            for (const proxyUrl of proxies) {
                try {
                    const res = await fetch(proxyUrl, { cache: 'no-store' });
                    if (res.ok) {
                        htmlText = await res.text();
                        if (htmlText && htmlText.length > 500) break;
                    }
                } catch (e) {
                    console.warn("Proxy falhou, tentando o próximo...", e);
                }
            }

            if (!htmlText) {
                throw new Error("Não foi possível carregar o conteúdo da pasta do Drive");
            }

            // Extração de fotos com data de criação e deduplicação estrita
            const extractedPhotos = this.parsePhotosFromHtml(htmlText);

            if (extractedPhotos.length === 0) {
                if (!isPeriodicCheck) {
                    this.showToast("Aguardando fotos na pasta...", "warning", 5000);
                }
                return;
            }

            this.isDemoMode = false;
            this.processFetchedPhotos(extractedPhotos, isPeriodicCheck);

        } catch (error) {
            console.error("Erro ao ler pasta do Google Drive:", error);
            if (!isPeriodicCheck) {
                this.showToast("Erro ao conectar com Google Drive. Ativando modo demo.", "error", 6000);
                this.isDemoMode = true;
                this.loadDemoPhotos();
            }
        }
    }

    /**
     * Parser avançado que extrai IDs únicos e datas de criação (createdTime)
     */
    parsePhotosFromHtml(html) {
        const photoMap = new Map();
        let orderIndex = 0;

        // 1. Extração via estruturas JSON do Google Drive (AF_initDataCallback / viewerData)
        const jsonMatch = html.match(/AF_initDataCallback\s*\(\s*\{[^}]*data:\s*([\s\S]*?)\}\s*\)\s*;/g);

        if (jsonMatch) {
            jsonMatch.forEach(block => {
                const idRegex = /"([a-zA-Z0-9_-]{25,45})"/g;
                let m;
                while ((m = idRegex.exec(block)) !== null) {
                    const candidateId = m[1];
                    if (!candidateId.startsWith("drive") && !candidateId.includes("http") && !photoMap.has(candidateId)) {
                        orderIndex++;
                        photoMap.set(candidateId, {
                            id: candidateId,
                            name: `Foto ${candidateId.substring(0, 5)}`,
                            url: `https://lh3.googleusercontent.com/d/${candidateId}`,
                            fallbackUrl: `https://drive.google.com/uc?export=view&id=${candidateId}`,
                            createdTime: orderIndex
                        });
                    }
                }
            });
        }

        // 2. Fallback via regex DOM caso a estrutura JSON não retorne itens
        if (photoMap.size === 0) {
            const regexes = [
                /\/file\/d\/([a-zA-Z0-9_-]{25,45})/g,
                /id="item-([a-zA-Z0-9_-]{25,45})"/g,
                /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{25,45})/g
            ];

            regexes.forEach(regex => {
                let match;
                while ((match = regex.exec(html)) !== null) {
                    const id = match[1];
                    if (!photoMap.has(id)) {
                        orderIndex++;
                        photoMap.set(id, {
                            id: id,
                            name: `Foto ${id.substring(0, 5)}`,
                            url: `https://lh3.googleusercontent.com/d/${id}`,
                            fallbackUrl: `https://drive.google.com/uc?export=view&id=${id}`,
                            createdTime: orderIndex
                        });
                    }
                }
            });
        }

        const photoList = Array.from(photoMap.values());
        photoList.sort((a, b) => a.createdTime - b.createdTime);

        return photoList;
    }

    /**
     * Processa as fotos recebidas, sincroniza a contagem e evita repetição de fotos seguidas
     */
    processFetchedPhotos(fetchedPhotos, isPeriodicCheck) {
        const validIdsSet = new Set(fetchedPhotos.map(p => p.id));

        // Limpa fotos removidas do cache 'seenIds'
        Array.from(this.seenIds).forEach(id => {
            if (!validIdsSet.has(id)) {
                this.seenIds.delete(id);
            }
        });
        this.saveSeenIds();

        // Atualiza a lista total de fotos ativas
        this.allPhotos = fetchedPhotos;

        // Fotos novas ainda não exibidas
        const newlyAdded = fetchedPhotos.filter(p => !this.seenIds.has(p.id));

        // Adiciona fotos realmente novas à fila existente sem duplicar
        if (newlyAdded.length > 0) {
            newlyAdded.forEach(p => {
                if (!this.queue.some(q => q.id === p.id)) {
                    this.queue.push(p);
                }
            });
        }

        // Se a fila estiver vazia, reinicia com todas as fotos sem repetir a foto atual seguidamente
        if (this.queue.length === 0 && fetchedPhotos.length > 0) {
            this.queue = [...fetchedPhotos];
            if (this.currentPhoto && this.queue.length > 1 && this.queue[0].id === this.currentPhoto.id) {
                this.queue.push(this.queue.shift());
            }
        }

        // Atualiza estatísticas no DOM silenciosamente
        this.updateStatsUI();

        // SEM popups durante verificação periódica em segundo plano para não poluir o telão
        if (!isPeriodicCheck) {
            this.showToast(`${fetchedPhotos.length} foto(s) encontrada(s)`, "info", 3000);
        }
    }

    loadDemoPhotos() {
        const demoList = [
            { id: 'demo-1', name: 'Foto 1', url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1920&q=80', createdTime: 1 },
            { id: 'demo-2', name: 'Foto 2', url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1920&q=80', createdTime: 2 },
            { id: 'demo-3', name: 'Foto 3', url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1080&q=80', createdTime: 3 },
            { id: 'demo-4', name: 'Foto 4', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1920&q=80', createdTime: 4 }
        ];

        this.allPhotos = demoList;
        const unshown = demoList.filter(p => !this.seenIds.has(p.id));
        this.queue = unshown.length > 0 ? unshown : [...demoList];
        this.updateStatsUI();
    }

    /* ==========================================================================
       3. Engine do Slideshow (Garantia Anti-Repetição Seguidas)
       ========================================================================== */
    startPresentation() {
        this.dom.splashScreen.classList.add('hidden');
        this.isPlaying = true;
        this.showNextSlide();
        this.startSlideshowLoop();
    }

    startSlideshowLoop() {
        this.stopSlideshowLoop();
        const displayTime = Math.max(3000, parseInt(this.config.TEMPO_EXIBICAO) || 7000);
        this.slideshowTimer = setInterval(() => {
            if (this.isPlaying) {
                this.showNextSlide();
            }
        }, displayTime);
    }

    stopSlideshowLoop() {
        if (this.slideshowTimer) {
            clearInterval(this.slideshowTimer);
            this.slideshowTimer = null;
        }
    }

    showNextSlide(isManual = false) {
        if (this.queue.length === 0) {
            if (this.allPhotos.length > 0) {
                this.queue = [...this.allPhotos];
                // Evita repetir a foto atual seguidamente ao reiniciar a fila
                if (this.currentPhoto && this.queue.length > 1 && this.queue[0].id === this.currentPhoto.id) {
                    this.queue.push(this.queue.shift());
                }
            } else {
                return;
            }
        }

        const photo = this.queue.shift();

        // Verificação adicional anti-repetição contígua
        if (this.currentPhoto && photo.id === this.currentPhoto.id && this.queue.length > 0) {
            this.queue.push(photo);
            this.showNextSlide(isManual);
            return;
        }

        this.currentPhoto = photo;
        this.seenIds.add(photo.id);
        this.saveSeenIds();
        this.updateStatsUI();

        const nextIndex = this.activeLayerIndex === 0 ? 1 : 0;
        const currentLayer = this.dom.slideLayers[this.activeLayerIndex];
        const nextLayer = this.dom.slideLayers[nextIndex];
        const nextImg = this.dom.slideImages[nextIndex];
        const currentAmbient = this.dom.ambientBgs[this.activeLayerIndex];
        const nextAmbient = this.dom.ambientBgs[nextIndex];

        const tempImg = new Image();
        tempImg.onload = () => {
            nextImg.src = photo.url;
            
            if (this.config.FUNDO_DESFOCADO) {
                nextAmbient.style.backgroundImage = `url('${photo.url}')`;
                nextAmbient.classList.add('active');
                if (currentAmbient) currentAmbient.classList.remove('active');
            }

            if (this.config.EFEITO_ZOOM) {
                nextImg.classList.add('ken-burns');
            } else {
                nextImg.classList.remove('ken-burns');
            }

            nextLayer.classList.add('active');
            currentLayer.classList.remove('active');

            this.activeLayerIndex = nextIndex;
        };

        tempImg.onerror = () => {
            if (photo.fallbackUrl && tempImg.src !== photo.fallbackUrl) {
                tempImg.src = photo.fallbackUrl;
            } else {
                console.warn("Falha ao carregar imagem:", photo);
                if (!isManual) this.showNextSlide();
            }
        };

        tempImg.src = photo.url;
    }

    showPrevSlide() {
        if (this.allPhotos.length < 2) return;
        
        const currentIndex = this.allPhotos.findIndex(p => p.id === this.currentPhoto?.id);
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) prevIndex = this.allPhotos.length - 1;
        
        const prevPhoto = this.allPhotos[prevIndex];
        if (prevPhoto) {
            this.queue.unshift(prevPhoto);
            this.showNextSlide(true);
        }
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this.dom.iconPause.style.display = 'block';
            this.dom.iconPlay.style.display = 'none';
            this.showToast("Slideshow Continuado", "info", 2000);
            this.startSlideshowLoop();
        } else {
            this.dom.iconPause.style.display = 'none';
            this.dom.iconPlay.style.display = 'block';
            this.showToast("Slideshow Pausado", "warning", 3000);
        }
    }

    /* ==========================================================================
       4. Renderização do QR Code
       ========================================================================== */
    renderQRCode() {
        if (this.config.ENABLE_QRCODE === false) {
            this.dom.qrBadge.classList.add('hidden');
            return;
        }

        let qrTargetUrl = this.config.QRCODE_URL;
        if (!qrTargetUrl || qrTargetUrl.trim() === "") {
            const loc = window.location;
            const basePath = loc.pathname.substring(0, loc.pathname.lastIndexOf('/') + 1);
            qrTargetUrl = `${loc.origin}${basePath}galeria.html`;
        }

        this.dom.qrBadge.classList.remove('hidden');
        this.dom.qrContainer.innerHTML = "";

        if (typeof QRCode !== 'undefined') {
            new QRCode(this.dom.qrContainer, {
                text: qrTargetUrl,
                width: 76,
                height: 76,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        } else {
            const img = document.createElement('img');
            img.src = `https://quickchart.io/qr?text=${encodeURIComponent(qrTargetUrl)}&size=150`;
            img.alt = "QR Code Galeria de Fotos";
            this.dom.qrContainer.appendChild(img);
        }
    }

    showToast(message, type = 'info', duration = 3500) {
        this.dom.toastMessage.textContent = message;
        this.dom.statusToast.className = `visible ${type}`;
        this.dom.toastDot.className = `toast-dot ${type} pulse`;

        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.dom.statusToast.className = "hidden";
        }, duration);
    }

    updateStatsUI() {
        this.dom.statDisplayed.textContent = this.seenIds.size;
        this.dom.statQueued.textContent = this.queue.length;
        this.dom.statTotal.textContent = this.allPhotos.length;
    }

    /* ==========================================================================
       5. Atalhos de Teclado & Eventos
       ========================================================================== */
    setupEventListeners() {
        this.dom.btnStart.addEventListener('click', () => this.startPresentation());

        this.dom.btnTogglePause.addEventListener('click', () => this.togglePlayPause());
        this.dom.btnPrev.addEventListener('click', () => this.showPrevSlide());
        this.dom.btnNext.addEventListener('click', () => this.showNextSlide(true));
        this.dom.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
        this.dom.btnOpenAdmin.addEventListener('click', () => this.openAdminModal());
        this.dom.btnCloseAdmin.addEventListener('click', () => this.closeAdminModal());
        
        this.dom.btnSaveAdmin.addEventListener('click', () => this.saveAdminConfig());
        this.dom.btnResetCache.addEventListener('click', () => this.resetCache());

        window.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                if (e.key === 'Escape') this.closeAdminModal();
                return;
            }

            switch (e.key) {
                case 'F11':
                    this.toggleFullscreen();
                    break;
                case 'Escape':
                    this.closeAdminModal();
                    break;
                case ' ':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'ArrowLeft':
                    this.showPrevSlide();
                    break;
                case 'ArrowRight':
                    this.showNextSlide(true);
                    break;
                case 'a':
                case 'A':
                case 'm':
                case 'M':
                    this.openAdminModal();
                    break;
                case 'c':
                case 'C':
                    this.resetCache();
                    break;
            }
        });
    }

    setupIdleDetector() {
        const resetIdle = () => {
            document.body.classList.remove('user-idle');
            if (this.idleTimer) clearTimeout(this.idleTimer);
            
            this.idleTimer = setTimeout(() => {
                if (this.isPlaying && !this.isAdminOpen) {
                    document.body.classList.add('user-idle');
                }
            }, 3500);
        };

        window.addEventListener('mousemove', resetIdle);
        window.addEventListener('mousedown', resetIdle);
        window.addEventListener('touchstart', resetIdle);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn("Erro ao entrar em Tela Cheia:", err);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    openAdminModal() {
        this.isAdminOpen = true;
        this.dom.adminModal.classList.add('visible');
        this.updateStatsUI();
    }

    closeAdminModal() {
        this.isAdminOpen = false;
        this.dom.adminModal.classList.remove('visible');
    }

    saveAdminConfig() {
        const newDriveUrl = this.dom.inputDriveUrl.value.trim();
        const enableQr = this.dom.inputEnableQrCode ? this.dom.inputEnableQrCode.checked : true;
        const newQrUrl = this.dom.inputQrUrl ? this.dom.inputQrUrl.value.trim() : "";

        this.config.LINK_PASTA_DRIVE = newDriveUrl;
        this.config.ENABLE_QRCODE = enableQr;
        this.config.QRCODE_URL = newQrUrl;

        localStorage.setItem('foto_telao_config', JSON.stringify({
            LINK_PASTA_DRIVE: newDriveUrl,
            ENABLE_QRCODE: enableQr,
            QRCODE_URL: newQrUrl
        }));

        this.closeAdminModal();
        this.renderQRCode();
        this.showToast("Configurações salvas!", "info");
        
        this.isDemoMode = false;
        this.checkDrivePhotos();
    }

    resetCache() {
        this.seenIds.clear();
        localStorage.removeItem('foto_telao_seen_ids');
        localStorage.removeItem('foto_telao_last_id');
        this.queue = [...this.allPhotos];
        this.updateStatsUI();
        this.showToast("Cache de fotos limpo!", "info");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.fotoTelao = new FotoTelaoApp();
});
