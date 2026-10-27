# -*- coding: utf-8 -*-
"""
大福食刻 · 食物贴纸自动制作脚本（规格书 §8.3 手账 AI 自动抠图的离线实现）
基于 rembg（U2Net 人像/物体分割模型）批量抠图：
    输入食物照片 → 抠除背景 → 按透明像素收紧裁边 → 方形画布居中 → 输出透明底贴纸 PNG
用法：
    python make-stickers.py --src <照片目录或单文件> --out <输出目录> [--size 256] [--pad 8]
示例（用原型日历贴纸源图制作项目贴纸库）：
    python make-stickers.py --src "G:/.../原型HTML/assets" --out "G:/.../frontend/public/assets/food-stickers"
依赖：pip install rembg onnxruntime pillow（首次运行自动下载 u2net 模型约 170MB）
"""
import argparse
from pathlib import Path

from PIL import Image
from rembg import remove, new_session

# 复用同一个分割模型会话，多图处理更快
SESSION = new_session("u2net")

# 允许输入的图片格式
SRC_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def tighten_and_square(img: Image.Image, size: int, pad: int) -> Image.Image:
    """按透明像素收紧裁边（bbox），再放进方形画布居中缩放，保证贴纸边缘干净不粘连"""
    # 已有透明通道时先按 alpha 收紧；纯背景图经 rembg 后 alpha 也在同一通道
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    # 等比缩到 (size - pad*2) 内
    inner = size - pad * 2
    img.thumbnail((inner, inner), Image.LANCZOS)
    # 方形透明画布居中
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    return canvas


def make_sticker(src: Path, out: Path, size: int, pad: int) -> bool:
    """
    单张抠图：读取 → rembg 去背景 → 收紧方画布 → 保存
    已是透明底贴纸的（alpha 边缘已有透明）直接复制，避免二次抠图损失
    """
    img = Image.open(src).convert("RGBA")
    alpha = img.getchannel("A")
    lo, hi = alpha.getextrema()
    if lo < 8:  # 边缘已存在透明像素 → 认为已是贴纸
        img.save(out)
        return False
    cut = remove(img, session=SESSION)
    tighten_and_square(cut, size, pad).save(out)
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="食物照片 → 透明底贴纸（rembg 批量抠图）")
    parser.add_argument("--src", required=True, help="源照片目录或单个文件")
    parser.add_argument("--out", required=True, help="输出贴纸目录")
    parser.add_argument("--size", type=int, default=256, help="输出画布边长（默认 256）")
    parser.add_argument("--pad", type=int, default=8, help="画布内边距（默认 8）")
    parser.add_argument("--prefix", default="sticker", help="输出文件名前缀")
    args = parser.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # 收集源文件：目录则取全部图片；单文件直接用
    files = sorted([p for p in src.iterdir() if p.suffix.lower() in SRC_EXTS]) if src.is_dir() else [src]
    if not files:
        raise SystemExit(f"源目录没有可用图片：{src}")

    ok_count = 0
    for i, f in enumerate(files, 1):
        dst = out / f"{args.prefix}-{i:02d}{f.suffix.lower() if f.suffix.lower() == '.png' else '.png'}"
        cut = make_sticker(f, dst, args.size, args.pad)
        ok_count += 1 if cut else 0
        print(f"[{i}/{len(files)}] {f.name} -> {dst.name}{'（抠图）' if cut else '（已是贴纸，直接复制）'}")

    print(f"完成：{ok_count} 张抠图 / {len(files)} 张处理，输出目录 {out}")


if __name__ == "__main__":
    main()
