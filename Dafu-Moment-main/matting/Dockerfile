# 自动抠图微服务：rembg(U2Net) 分割模型，为手账贴纸提供线上抠图
FROM python:3.11-slim
WORKDIR /app
# 先装依赖再拷代码，充分利用构建缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
# 模型缓存落卷（u2net 约 170MB，首次启动自动下载，之后秒起）
ENV U2NET_HOME=/models
VOLUME ["/models"]
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
