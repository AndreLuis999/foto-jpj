# 📸 Foto Telão & Galeria do Evento (Sem API Key)

Sistema web completo, elegante e 100% gratuito para exibição de fotos em tempo real em telões/projetores e disponibilização de galeria para os participantes baixarem as fotos do evento.

---

## 🌟 Principais Recursos

- 🚀 **Zero Configuração no Google Cloud**: Não exige chaves de API nem cadastro no Google Cloud Console.
- 📂 **Pasta Única Pública**: Todas as fotos ficam armazenadas em uma única pasta pública do Google Drive.
- 🔢 **Contador de Fotos Preciso & Deduplicação**: Exibe exatamente o número de fotos reais na pasta (ex: 24 fotos na pasta = 24 fotos no sistema).
- 🕒 **Ordenação por Data de Criação (`createdTime`)**: Fotos são exibidas estritamente da mais antiga para a mais nova.
- 📱 **Galeria de Fotos para Download (`galeria.html`)**:
  - Os participantes escaneiam o QR Code e acessam a galeria com todas as fotos do evento no celular.
  - Visualização em alta definição com botão **"⬇️ Baixar Foto"**.
- ⚙️ **QR Code Opcional**: Ative (`ENABLE_QRCODE: true`) ou desative (`ENABLE_QRCODE: false`) o QR Code no telão via `config.js`.
- 💾 **Cache Inteligente (`LocalStorage`)**: Registra fotos vistas e sincroniza em tempo real caso fotos sejam removidas da pasta.

---

## 📁 Estrutura de Arquivos

```
/foto-telao
│
├── index.html        # Página principal do Telão (Slideshow + QR Code + Admin)
├── galeria.html      # Página de Galeria para os convidados visualizarem e baixarem fotos
├── style.css         # Estilização (Dark Mode, Glassmorphism, Responsive Grid, Lightbox)
├── script.js         # Leitor público do Google Drive + Motor do Slideshow (Deduplicação & Ordenação)
├── galeria.js        # Lógica da Galeria (Carregamento das fotos + Modal Lightbox + Download)
├── config.js         # Configurações do evento, pasta e chave do QR Code
└── README.md         # Manual de uso
```

---

## 🛠️ Configuração Básica

Abra o arquivo `config.js` e configure sua pasta:

```javascript
const CONFIG = {
    // Cole aqui o link público da sua pasta do Google Drive
    LINK_PASTA_DRIVE: "https://drive.google.com/drive/folders/SUA_PASTA_AQUI",

    // Ativar (true) ou Desativar (false) o QR Code no telão
    ENABLE_QRCODE: true,

    // URL personalizada do QR Code (deixe vazio para gerar o link da galeria.html automaticamente)
    QRCODE_URL: "",

    // Intervalo de verificação no telão (5000 = 5 segundos)
    INTERVALO_ATUALIZACAO: 5000,

    // Tempo de cada foto na tela (7000 = 7 segundos)
    TEMPO_EXIBICAO: 7000,

    // Nome do seu Evento
    NOME_EVENTO: "Casamento de Maria & João"
};
```

---

## 🚀 Publicação no GitHub Pages

1. Envie todos os arquivos do projeto para o seu repositório no GitHub.
2. No repositório, vá em **Settings** > **Pages**.
3. Em **Branch**, selecione `main` e a pasta `/ (root)`.
4. Clique em **Save**.
5. O seu telão estará no ar em: `https://seu-usuario.github.io/foto-telao/`
6. A galeria para download estará em: `https://seu-usuario.github.io/foto-telao/galeria.html`

---

## 🛡️ Licença
Projeto de código aberto sob licença MIT. Livre para uso pessoal e comercial em eventos.
