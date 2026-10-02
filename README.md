# 広島Unity勉強会 公式サイト

広島Unity勉強会の公式サイト（[hiro-uni.github.io](https://hiro-uni.github.io/)）のリポジトリです。Astro（Content Layer API）とMDXを使用して構築されています。

## 🛠 技術スタック

- **Framework**: [Astro](https://astro.build/) (v5+ / Content Layer API)
- **Content**: [MDX](https://mdxjs.com/) (`@astrojs/mdx`)
- **3D Graphics**: Three.js
- **SEO & Sitemap**: `@astrojs/sitemap`
- **Hosting / CI/CD**: GitHub Pages + GitHub Actions (Node.js 22)

---

## 🚀 ローカルでの開発・確認方法

### 1. 動作要件
Node.js（v22 推奨 / LTS）がインストールされていることを確認してください。

- **macOS**: Homebrew を使用してインストール
  ```sh
  brew install node
  ```
- **Windows**: winget を使用してインストール
  ```sh
  winget install OpenJS.NodeJS
  ```

### 2. インストール
リポジトリのルートディレクトリで依存関係をインストールします。
```sh
npm install
```

### 3. コマンド一覧

| コマンド | 説明 |
| :--- | :--- |
| `npm run dev` | 開発サーバーを起動（起動前に `fetch-ogp` が自動実行されます） |
| `npm run build` | プロダクションビルド（`dist/` ディレクトリに静的出力） |
| `npm run preview` | ビルド成果物のローカルプレビュー |
| `npm run fetch-ogp` | 記事内の OGP メタデータを取得してキャッシュを更新 |

### 4. ローカルサーバーの起動
以下のコマンドを実行して開発サーバーを起動します。
```sh
npm run dev
```
起動後、ターミナルに表示される URL（通常は `http://localhost:4321/`）をブラウザで開きます。ファイルを編集するとホットリロードにより自動反映されます。

---

## 📝 ニュース・お知らせの追加方法

新しいニュースやお知らせは `src/content/news/` ディレクトリに **MDX（.mdx）** または Markdown（.md）ファイルを追加します。

### 1. ファイルの作成
`src/content/news/` 内に新しいファイルを作成します。  
ファイル名は `YYYY-MM-DD-slug.mdx` の形式を推奨します。

例: `2026-10-03-autumn-event.mdx`

### 2. フロントマターの記述 (Frontmatter)
ファイルの先頭に、記事のメタデータをハイフン3つ（`---`）で囲んで記述します。

```markdown
---
title: "記事のタイトル"
pubDate: 2026-10-03
description: "記事の概要（一覧ページやSNS共有時に表示されます）"
image: "../../assets/gjt/banner_2026.png"  # 任意: サムネイル画像
author: "執筆者名"                         # 任意
tags: ["Unity", "イベント"]                # 任意
---
```

> **Note**: メタデータのスキーマは `src/content.config.ts` で定義されています。

### 3. 本文の記述
フロントマターの下に、Markdown 形式で本文を記述します。MDX では JSX や Astro コンポーネントも利用できます。

---

## 🎨 記事内でのコンポーネント・アセット利用

### 1. 外部サイトのブログカード（OGP）表示
記事内で外部サイトのリンクをリッチなブログカード形式で表示できます。

```mdx
import OGP from "../../layouts/OGP.astro";

<OGP url="https://example.com/article" />
```

> **OGPキャッシュの仕組み**:
> - `npm run dev` 実行時、または CI/CD ビルド時に `scripts/fetch-ogp.mjs` が走り、URL からタイトル・概要・画像を自動取得して `src/data/ogp-cache.json` にキャッシュ保存します。
> - 手動でキャッシュを更新したい場合は `npm run fetch-ogp` を実行してください。

### 2. 画像の最適化表示 (`astro:assets`)
ローカル画像（`src/assets/` 配下）をインポートして最適化表示できます。

```mdx
import { Image } from 'astro:assets';
import bannerImg from '../../assets/gjt/banner_2026.png';

<Image src={bannerImg} alt="バナー画像" />
```

---

## 📁 プロジェクト構造

```text
/
├── .github/
│   └── workflows/
│       └── astro.yml          <-- GitHub Actions 自動デプロイ設定
├── public/                    <-- 静的公開ファイル（favicon, robots.txt 等）
├── scripts/
│   └── fetch-ogp.mjs          <-- OGP情報スクレイピング & キャッシュスクリプト
├── src/
│   ├── assets/                <-- 最適化対象の画像アセット
│   ├── components/            <-- 再利用可能な Astro コンポーネント
│   ├── content/
│   │   └── news/              <-- ニュース記事（.mdx / .md）
│   ├── content.config.ts      <-- Content Layer スキーマ定義
│   ├── data/
│   │   └── ogp-cache.json     <-- OGP メタデータキャッシュ
│   ├── layouts/               <-- 共通レイアウト (Layout.astro, OGP.astro)
│   └── pages/                 <-- サイトルート・個別ページルーティング
├── astro.config.mjs           <-- Astro 設定ファイル（MDX, sitemap 等）
├── package.json               <-- npm スクリプトおよび依存関係
└── tsconfig.json              <-- TypeScript 設定
```

---

## 🚢 デプロイ（公開）

`main` ブランチに変更をプッシュすると、GitHub Actions（`.github/workflows/astro.yml`）が自動で実行されます。  
OGP メタデータの更新・サイトビルドが行われ、数分で GitHub Pages へデプロイされます。

---

## 📄 ライセンス

本プロジェクトのライセンスについては、[LICENSE.md](./LICENSE.md) を参照してください。
