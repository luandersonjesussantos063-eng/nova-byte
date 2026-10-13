# NPlay — processador privado de importação magnet

Este componente precisa rodar em um servidor Python com espaço temporário, acesso à rede BitTorrent e credenciais próprias. GitHub Pages e Cloudflare R2 não executam torrents. **Não há processador em execução somente por adicionar estes arquivos.**

1. Instale Python 3.11 e dependências em `requirements.txt` em um servidor com suporte a libtorrent.
2. Configure as variáveis de `.env.example` em um gerenciador de segredos, nunca no repositório.
3. Execute `python worker.py` com uma conta de serviço restrita e monitore os logs.
4. No painel, registre o magnet e a licença. O processo consulta os jobs pendentes, verifica aprovação administrativa e baixa o conteúdo. A publicação na NPlay exige revisão separada.

O servidor precisa das credenciais de Supabase (service role) e Cloudflare R2 (S3). Não cole segredos no frontend. Não ative este worker para arquivos sem direitos de distribuição. O processador não faz bypass de DRM, não acessa Netflix e não altera `is_published`.
