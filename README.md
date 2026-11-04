# 霓虹打磚塊

以 Phaser 3、TypeScript 與 Vite 製作的跨裝置無盡打磚塊遊戲。

## 本機執行

需要 Node.js 22 或更新版本。

```bash
pnpm install
pnpm dev
```

## 驗證與建置

```bash
pnpm test
pnpm build
pnpm preview
```

## 操作

- 桌機：方向鍵或 A/D 移動，也可以用滑鼠控制橫桿。
- 手機：拖曳控制橫桿。
- 空白鍵、滑鼠點擊或觸碰畫面發球。

推送至 `main` 後，GitHub Actions 會自動測試、建置並部署到 GitHub Pages。
