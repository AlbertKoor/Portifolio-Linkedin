# Albert Kooro — Portfólio

Landing page pessoal em HTML, CSS e JavaScript puros (sem build, sem dependências).

## Estrutura

- `index.html` — conteúdo e seções (hero, sobre, skills, projetos, formação, contato)
- `styles.css` — tema visual (dark mode, gradientes, animações de reveal)
- `script.js` — menu mobile e animação de entrada ao rolar a página

## Rodar localmente

Abra `index.html` direto no navegador, ou sirva a pasta com qualquer servidor estático:

```
npx serve .
```

## Publicar no GitHub Pages

1. Crie um repositório vazio no GitHub (sugestão: `albertkooro.github.io` para ficar disponível na raiz do domínio).
2. `git remote add origin <url-do-repo>`
3. `git push -u origin master`
4. Em **Settings → Pages**, defina a origem como o branch `master` (pasta raiz `/`).
