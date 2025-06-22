# Bootstrapping

```sh
# React + TypeScript setup
npx create-react-app video-labeling-app --template typescript
cd video-labeling-app
npm install axios react-player
```

Note: Do not try to fix the audit vulnerabilities. It breaks the system, see https://www.reddit.com/r/reactjs/comments/qezs0q/how_to_solve_critical_react_scripts/

## Moving to Client

It's easier to instead move the `.git` directory.

```sh
cd ..
mv video-labeling-app client
mkdir video-label
mv client video-label
cd video-label
mv client/.git .
git add .
```

