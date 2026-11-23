# Máy dựng video của Crewzy (Cloudflare Containers): HyperFrames (HTML → MP4, Apache 2.0) + FFmpeg (ghép giọng, nhạc, phụ đề).
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates fonts-noto-core fonts-noto-color-emoji fontconfig \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Ghim phiên bản khi lên chạy thật (HYPERFRAMES_VERSION); chrome-headless-shell tải sẵn vào ảnh để dựng không phải chờ.
ARG HYPERFRAMES_VERSION=latest
RUN npm install -g hyperframes@${HYPERFRAMES_VERSION} && hyperframes browser ensure
COPY server.mjs ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
