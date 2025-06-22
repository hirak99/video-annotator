# Bootstrapping

```sh
# React + TypeScript setup
npx create-react-app video-labeling-app --template typescript
cd video-labeling-app
npm install axios react-player
```

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

