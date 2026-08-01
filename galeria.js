/**
 * ==========================================================================
 * Galeria de Fotos do Evento (galeria.js)
 * Lista as fotos da pasta pública do Google Drive para visualização e download
 * Ordenação rigorosa por Data de Criação (createdTime)
 * ==========================================================================
 */

class FotoGaleriaApp {
    constructor() {
        this.config = typeof CONFIG !== 'undefined' ? CONFIG : {};
        this.photos = [];
        this.currentIndex = 0;

        this.dom = {
            eventTitle: document.getElementById('gallery-event-title'),
            counterBadge: document.getElementById('gallery-counter'),
            grid: document.getElementById('gallery-grid'),
            
            modal: document.getElementById('lightbox-modal'),
            modalImg: document.getElementById('lightbox-img'),
            modalClose: document.getElementById('lightbox-close'),
            modalDownloadBtn: document.getElementById('btn-lightbox-download'),
            modalPrevBtn: document.getElementById('btn-lightbox-prev'),
            modalNextBtn: document.getElementById('btn-lightbox-next')
        };

        this.init();
    }

    init() {
        if (this.config.NOME_EVENTO) {
            this.dom.eventTitle.textContent = this.config.NOME_EVENTO;
        }

        this.setupEventListeners();
        this.loadGalleryPhotos();
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

    async loadGalleryPhotos() {
        const folderId = this.extractFolderId(this.config.LINK_PASTA_DRIVE);

        if (!folderId) {
            this.loadDemoGallery();
            return;
        }

        try {
            const targetUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}`;
            const proxies = [
                `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
                `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`
            ];

            let htmlText = null;
            for (const proxyUrl of proxies) {
                try {
                    const res = await fetch(proxyUrl);
                    if (res.ok) {
                        htmlText = await res.text();
                        if (htmlText && htmlText.length > 500) break;
                    }
                } catch (e) {
                    console.warn("Proxy falhou, tentando o próximo...", e);
                }
            }

            if (!htmlText) throw new Error("Falha ao carregar a galeria");

            const fetched = this.parsePhotosFromHtml(htmlText);

            if (fetched.length === 0) {
                this.dom.counterBadge.textContent = "Nenhuma foto encontrada";
                this.dom.grid.innerHTML = `<div class="gallery-empty"><p>Aguardando novas fotos...</p></div>`;
                return;
            }

            this.photos = fetched;
            this.dom.counterBadge.textContent = `${fetched.length} foto(s) disponível(is)`;
            this.renderGrid();

        } catch (error) {
            console.error("Erro na galeria:", error);
            this.loadDemoGallery();
        }
    }

    parsePhotosFromHtml(html) {
        const photoMap = new Map();
        let orderIndex = 0;

        const jsonMatch = html.match(/AF_initDataCallback\s*\(\s*\{[^}]*data:\s*([\s\S]*?)\}\s*\)\s*;/g);

        if (jsonMatch) {
            jsonMatch.forEach(block => {
                const idRegex = /"([a-zA-Z0-9_-]{25,45})"/g;
                let m;
                while ((m = idRegex.exec(block)) !== null) {
                    const id = m[1];
                    if (!id.startsWith("drive") && !photoMap.has(id)) {
                        orderIndex++;
                        photoMap.set(id, {
                            id: id,
                            name: `Foto ${orderIndex}`,
                            url: `https://lh3.googleusercontent.com/d/${id}`,
                            downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`,
                            createdTime: orderIndex
                        });
                    }
                }
            });
        }

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
                            name: `Foto ${orderIndex}`,
                            url: `https://lh3.googleusercontent.com/d/${id}`,
                            downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`,
                            createdTime: orderIndex
                        });
                    }
                }
            });
        }

        const list = Array.from(photoMap.values());
        list.sort((a, b) => a.createdTime - b.createdTime);
        return list;
    }

    loadDemoGallery() {
        const demoList = [
            { id: 'demo-1', name: 'Foto 1', url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80', downloadUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622' },
            { id: 'demo-2', name: 'Foto 2', url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80', downloadUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30' },
            { id: 'demo-3', name: 'Foto 3', url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80', downloadUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552' },
            { id: 'demo-4', name: 'Foto 4', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80', downloadUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745' }
        ];
        this.photos = demoList;
        this.dom.counterBadge.textContent = `${demoList.length} foto(s) de demonstração`;
        this.renderGrid();
    }

    renderGrid() {
        this.dom.grid.innerHTML = "";

        this.photos.forEach((photo, index) => {
            const card = document.createElement('div');
            card.className = 'gallery-card';

            const img = document.createElement('img');
            img.src = photo.url;
            img.alt = photo.name;
            img.loading = 'lazy';

            const overlay = document.createElement('div');
            overlay.className = 'gallery-card-overlay';
            overlay.innerHTML = `<span class="btn-download-icon">⬇️ Baixar</span>`;

            card.appendChild(img);
            card.appendChild(overlay);

            card.addEventListener('click', () => this.openLightbox(index));

            this.dom.grid.appendChild(card);
        });
    }

    /* ==========================================================================
       Lightbox Modal
       ========================================================================== */
    openLightbox(index) {
        this.currentIndex = index;
        const photo = this.photos[index];

        this.dom.modalImg.src = photo.url;
        this.dom.modalDownloadBtn.href = photo.downloadUrl || photo.url;
        this.dom.modal.classList.remove('hidden');
    }

    closeLightbox() {
        this.dom.modal.classList.add('hidden');
    }

    setupEventListeners() {
        this.dom.modalClose.addEventListener('click', () => this.closeLightbox());
        
        this.dom.modalPrevBtn.addEventListener('click', () => {
            this.currentIndex = (this.currentIndex - 1 + this.photos.length) % this.photos.length;
            this.openLightbox(this.currentIndex);
        });

        this.dom.modalNextBtn.addEventListener('click', () => {
            this.currentIndex = (this.currentIndex + 1) % this.photos.length;
            this.openLightbox(this.currentIndex);
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeLightbox();
            if (e.key === 'ArrowLeft') this.dom.modalPrevBtn.click();
            if (e.key === 'ArrowRight') this.dom.modalNextBtn.click();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.fotoGaleria = new FotoGaleriaApp();
});
