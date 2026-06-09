# 苏东坡美食诗词地图

一个基于 Vite + Three.js 的 3D 地球项目，用苏轼的行旅坐标串联美食、诗词和地方风物。

## 功能

- 可拖拽、缩放、自动旋转的 3D 地球
- 地球光点与地点列表联动
- JSON 数据驱动，便于继续扩展地点
- 图片资源统一放在 `public/images` 文件夹
- 响应式页面，适配桌面与移动端

## 项目结构

```text
public/
  data/
    su-dongpo-food-poems.json  # 地点、美食、诗词、坐标数据
  images/                      # 页面使用的图片资源
src/
  main.js                      # Three.js 地球与页面交互
  styles.css                   # 页面样式
```

## 运行

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
```

## 扩展数据

继续补充地点时，在 `public/data/su-dongpo-food-poems.json` 的 `places` 数组中新增对象，并把对应图片放入 `public/images`，再把 `image` 字段指向 `/images/your-image.svg` 或其他图片文件即可。
