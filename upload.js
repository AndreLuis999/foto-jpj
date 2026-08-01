/**
 * ==========================================================================
 * Upload Page JS - Envio de Fotos pelos Participantes
 * Integração com Google Identity Services (OAuth 2.0) e Google Drive API v3
 * ==========================================================================
 */

class FotoUploadApp {
    constructor() {
        this.config = typeof CONFIG !== 'undefined' ? CONFIG : {};
        this.accessToken = null;
        this.selectedFiles = [];
        this.tokenClient = null;

        this.dom = {
            eventTitle: document.getElementById('upload-event-title'),
            authCard: document.getElementById('auth-card'),
            googleLoginBox: document.getElementById('google-login-box'),
            btnLogin: document.getElementById('btn-google-login'),
            userProfileBar: document.getElementById('user-profile-bar'),
            userAvatar: document.getElementById('user-avatar'),
            userName: document.getElementById('user-name'),
            userEmail: document.getElementById('user-email'),
            btnLogout: document.getElementById('btn-logout'),

            uploadCard: document.getElementById('upload-card'),
            btnSelectFiles: document.getElementById('btn-select-files'),
            fileInput: document.getElementById('file-input'),
            dropzone: document.getElementById('dropzone'),
            previewGrid: document.getElementById('preview-grid'),

            progressContainer: document.getElementById('progress-container'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            btnSubmit: document.getElementById('btn-upload-submit'),

            successCard: document.getElementById('success-card'),
            btnUploadMore: document.getElementById('btn-upload-more')
        };

        this.init();
    }

    init() {
        if (this.config.NOME_EVENTO) {
            this.dom.eventTitle.textContent = this.config.NOME_EVENTO;
        }

        this.setupEventListeners();
        this.initGoogleOAuth();
    }

    /* ==========================================================================
       1. Autenticação Google OAuth 2.0
       ========================================================================== */
    initGoogleOAuth() {
        const clientId = this.config.GOOGLE_CLIENT_ID;

        // Se o Client ID não estiver preenchido, habilita o modo de demonstração
        if (!clientId || clientId.includes("COLOCAR_CLIENT_ID")) {
            console.warn("Google Client ID não configurado no config.js");
            return;
        }

        // Aguarda o script gsi/client carregar
        const checkGIS = setInterval(() => {
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                clearInterval(checkGIS);
                
                this.tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/oauth2/v3/userinfo',
                    callback: async (response) => {
                        if (response.error) {
                            alert("Erro na autenticação Google: " + response.error);
                            return;
                        }
                        this.accessToken = response.access_token;
                        await this.fetchUserProfile();
                        this.enableUploadCard();
                    }
                });
            }
        }, 300);
    }

    loginWithGoogle() {
        const clientId = this.config.GOOGLE_CLIENT_ID;
        if (!clientId || clientId.includes("COLOCAR_CLIENT_ID")) {
            // Simulação para testes de UI se o Client ID ainda não foi gerado no Google Cloud
            alert("Modo Demo: Para conectar a uma conta Google real, configure o GOOGLE_CLIENT_ID no arquivo config.js.");
            this.accessToken = "demo_token";
            this.dom.userAvatar.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80";
            this.dom.userName.textContent = "Participante Convidado";
            this.dom.userEmail.textContent = "participante@evento.com";
            this.dom.googleLoginBox.classList.add('hidden');
            this.dom.userProfileBar.classList.remove('hidden');
            this.enableUploadCard();
            return;
        }

        if (this.tokenClient) {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    }

    async fetchUserProfile() {
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            if (res.ok) {
                const info = await res.json();
                this.dom.userAvatar.src = info.picture || '';
                this.dom.userName.textContent = info.name || 'Convidado';
                this.dom.userEmail.textContent = info.email || '';
                
                this.dom.googleLoginBox.classList.add('hidden');
                this.dom.userProfileBar.classList.remove('hidden');
            }
        } catch (err) {
            console.error("Erro ao obter perfil:", err);
        }
    }

    logout() {
        this.accessToken = null;
        this.dom.userProfileBar.classList.add('hidden');
        this.dom.googleLoginBox.classList.remove('hidden');
        this.dom.uploadCard.classList.add('disabled');
        this.selectedFiles = [];
        this.renderPreviews();
    }

    enableUploadCard() {
        this.dom.uploadCard.classList.remove('disabled');
    }

    /* ==========================================================================
       2. Gerenciamento de Arquivos & Preview
       ========================================================================== */
    setupEventListeners() {
        this.dom.btnLogin.addEventListener('click', () => this.loginWithGoogle());
        this.dom.btnLogout.addEventListener('click', () => this.logout());

        this.dom.btnSelectFiles.addEventListener('click', () => this.dom.fileInput.click());
        this.dom.fileInput.addEventListener('change', (e) => this.handleFileSelection(e.target.files));

        // Drag & Drop
        this.dom.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dom.dropzone.classList.add('dragover');
        });
        this.dom.dropzone.addEventListener('dragleave', () => {
            this.dom.dropzone.classList.remove('dragover');
        });
        this.dom.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dom.dropzone.classList.remove('dragover');
            if (e.dataTransfer.files) {
                this.handleFileSelection(e.dataTransfer.files);
            }
        });

        this.dom.btnSubmit.addEventListener('click', () => this.uploadFilesToDrive());
        this.dom.btnUploadMore.addEventListener('click', () => this.resetForm());
    }

    handleFileSelection(fileList) {
        const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
        const files = Array.from(fileList);

        const validFiles = files.filter(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            const isValidExt = validExtensions.includes(ext);
            const isValidType = f.type.startsWith('image/');
            return isValidExt || isValidType;
        });

        if (validFiles.length < files.length) {
            alert("Alguns arquivos foram ignorados. Envie apenas imagens (.jpg, .jpeg, .png, .webp).");
        }

        // Adiciona à lista de selecionados
        this.selectedFiles = [...this.selectedFiles, ...validFiles];
        this.renderPreviews();
    }

    renderPreviews() {
        this.dom.previewGrid.innerHTML = "";

        if (this.selectedFiles.length === 0) {
            this.dom.btnSubmit.disabled = true;
            return;
        }

        this.dom.btnSubmit.disabled = false;

        this.selectedFiles.forEach((file, index) => {
            const card = document.createElement('div');
            card.className = 'preview-item';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove-preview';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', () => {
                this.selectedFiles.splice(index, 1);
                this.renderPreviews();
            });

            card.appendChild(img);
            card.appendChild(removeBtn);
            this.dom.previewGrid.appendChild(card);
        });
    }

    /* ==========================================================================
       3. Upload Multipart para o Google Drive
       ========================================================================== */
    async uploadFilesToDrive() {
        if (this.selectedFiles.length === 0 || !this.accessToken) return;

        // Determina pasta de destino (Uploads ou Fotos_Publicas)
        const targetFolder = this.config.UPLOAD_FOLDER_ID && !this.config.UPLOAD_FOLDER_ID.includes("COLOCAR_ID")
            ? this.config.UPLOAD_FOLDER_ID
            : this.config.DRIVE_FOLDER_ID;

        this.dom.btnSubmit.disabled = true;
        this.dom.progressContainer.classList.remove('hidden');

        // Em modo demonstração (sem token real), simula o envio
        if (this.accessToken === "demo_token") {
            for (let i = 1; i <= this.selectedFiles.length; i++) {
                const percent = Math.round((i / this.selectedFiles.length) * 100);
                this.dom.progressFill.style.width = `${percent}%`;
                this.dom.progressText.textContent = `Enviando foto ${i} de ${this.selectedFiles.length}...`;
                await new Promise(r => setTimeout(r, 600));
            }
            this.showSuccess();
            return;
        }

        let uploadedCount = 0;
        const total = this.selectedFiles.length;

        for (let i = 0; i < total; i++) {
            const file = this.selectedFiles[i];
            this.dom.progressText.textContent = `Enviando foto ${i + 1} de ${total}...`;

            try {
                await this.uploadSingleFile(file, targetFolder);
                uploadedCount++;
                const percent = Math.round((uploadedCount / total) * 100);
                this.dom.progressFill.style.width = `${percent}%`;
            } catch (error) {
                console.error(`Erro ao enviar foto ${file.name}:`, error);
                alert(`Erro ao enviar a foto ${file.name}. Verifique a conexão.`);
            }
        }

        if (uploadedCount > 0) {
            this.showSuccess();
        } else {
            this.dom.btnSubmit.disabled = false;
            this.dom.progressContainer.classList.add('hidden');
        }
    }

    uploadSingleFile(file, folderId) {
        return new Promise((resolve, reject) => {
            const metadata = {
                name: file.name,
                mimeType: file.type || 'image/jpeg',
                parents: folderId ? [folderId] : []
            };

            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            formData.append('file', file);

            fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                },
                body: formData
            }).then(response => {
                if (response.ok) {
                    resolve(response.json());
                } else {
                    reject(new Error(`HTTP ${response.status}`));
                }
            }).catch(reject);
        });
    }

    showSuccess() {
        this.dom.authCard.classList.add('hidden');
        this.dom.uploadCard.classList.add('hidden');
        this.dom.successCard.classList.remove('hidden');
    }

    resetForm() {
        this.selectedFiles = [];
        this.renderPreviews();
        this.dom.progressContainer.classList.add('hidden');
        this.dom.progressFill.style.width = '0%';
        this.dom.authCard.classList.remove('hidden');
        this.dom.uploadCard.classList.remove('hidden');
        this.dom.successCard.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.fotoUpload = new FotoUploadApp();
});
