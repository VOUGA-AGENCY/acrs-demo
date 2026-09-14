# ACRS — demo operacional

Versão com a identificação, os nomes, as empresas e os dados existentes no projeto original. Os dados extraídos em JSON e a documentação estão incluídos. Não foram anonimizados.

Os ficheiros Excel e Power BI foram excluídos deste pacote. A exclusão destes anexos não remove os seus dados já extraídos para a aplicação ou descritos na documentação.

## Executar

Instalar Node.js 22 e pnpm. Nesta pasta:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abrir http://127.0.0.1:3000.

```sh
pnpm test
pnpm build
pnpm start
```

`start` serve a versão compilada; repetir `build` depois de alterações. A demo não tem backend nem base de dados; os registos da sessão são repostos ao recarregar.

## Documentação

Consultar [manual completo](docs/manual-completo-sistema-demo.md).

## GitHub

Criar um repositório novo apenas a partir desta pasta. Não copiar dependências, compilações ou histórico Git da pasta original. O `.gitignore` exclui Excel e Power BI de futuras adições normais. Não usar `git add -f` para esses ficheiros.
