# U1 Doctor, local and read-only. Build:  docker build -t u1-doctor .
# Run:    docker run --rm -p 127.0.0.1:8765:8765 -v u1doctor-data:/data u1-doctor
# Then open http://127.0.0.1:8765  (publish on 127.0.0.1 only: the app has no login, do not expose it on a network).

FROM node:22-slim AS web
WORKDIR /w/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 U1DOCTOR_HOST=0.0.0.0 U1DOCTOR_PORT=8765 U1DOCTOR_DB=/data/u1doctor.sqlite3
WORKDIR /app
COPY backend/pyproject.toml backend/pyproject.toml
COPY backend/app backend/app
RUN pip install --no-cache-dir -e backend
COPY knowledge knowledge
COPY rulesets rulesets
COPY fixtures fixtures
COPY schemas schemas
COPY --from=web /w/frontend/dist frontend/dist
RUN useradd --create-home --uid 10001 u1doctor && mkdir /data && chown u1doctor /data
USER u1doctor
VOLUME /data
EXPOSE 8765
WORKDIR /app/backend
CMD ["python", "-m", "app"]
