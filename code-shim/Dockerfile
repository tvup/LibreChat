FROM python:3.12-slim

# docker CLI so we can spawn ephemeral exec containers via the host socket.
# Pulled directly from Docker's static binaries to avoid dragging in dockerd.
ARG DOCKER_VERSION=27.3.1
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz" \
       | tar -xzC /usr/local/bin --strip-components=1 docker/docker \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

EXPOSE 8080

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
